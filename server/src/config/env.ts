import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/toby_bookmark'),
  JWT_SECRET: z.string().default('dev-secret-change-in-production-min-32chars'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-in-prod-32chars'),
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().default(900),   // 15 minutes
  JWT_REFRESH_EXPIRY_SECONDS: z.coerce.number().default(604800), // 7 days
  CORS_ORIGIN: z.string().default('*'),
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
