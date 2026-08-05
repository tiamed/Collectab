import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/collectab'),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
    .default('dev-better-auth-secret-change-in-production-32chars'),
  BETTER_AUTH_URL: z.string().default('http://localhost:3001'),
  CORS_ORIGIN: z.string().default('*'),
  TRUSTED_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  DEFAULT_ROLE: z.enum(['guest', 'user', 'admin']).default('guest'),
  ADMIN_USER_IDS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((id) => id.trim()).filter(Boolean)),
  ROLE_QUOTAS: z
    .string()
    .default('')
    .transform((s) => {
      if (!s.trim()) return undefined;
      const quotas: Record<string, number | null> = {};
      for (const pair of s.split(',')) {
        const [role, value] = pair.split('=').map((x) => x.trim());
        const lowered = value?.toLowerCase();
        if (role && (lowered === 'unlimited' || lowered === 'inf' || value === '-1')) {
          quotas[role] = null;
        } else {
          const num = Number(value);
          if (role && !Number.isNaN(num)) quotas[role] = num;
        }
      }
      return Object.keys(quotas).length > 0 ? quotas : undefined;
    }),
  DISABLE_QUOTAS: z
    .string()
    .default('false')
    .transform((s) => s === 'true' || s === '1'),
  INVITE_MODE: z.enum(['open', 'invite-only']).default('open'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(20),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (env) return env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  env = result.data;
  return env;
}
