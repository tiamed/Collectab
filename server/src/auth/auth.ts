import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { admin, bearer } from 'better-auth/plugins';
import { defaultAc, defaultRoles } from 'better-auth/plugins/admin/access';
import { invite } from 'better-invite';
import bcrypt from 'bcrypt';
import { getDb } from '../database/client.js';
import * as dbSchema from '../database/schema.js';
import { getEnv } from '../config/env.js';

const SALT_ROUNDS = 12;

// Existing users were hashed with bcrypt(12); better-auth defaults to scrypt,
// so override to keep old hashes valid and stay consistent.
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  try {
    return await bcrypt.compare(data.password, data.hash);
  } catch {
    return false;
  }
}

const env = getEnv();
const db = getDb();

const authOptions = {
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema: dbSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: env.INVITE_MODE === 'invite-only',
    password: { hash: hashPassword, verify: verifyPassword },
    sendResetPassword: async ({ user, url }) => {
      const env = getEnv();
      if (env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(env.RESEND_API_KEY);
        void resend.emails.send({
          from: env.RESEND_FROM_EMAIL || 'Collectab <noreply@collectab.app>',
          to: user.email,
          subject: 'Reset your Collectab password',
          html: `Click <a href="${url}">here</a> to reset your password.`,
        });
      } else {
        console.log(`[password-reset] ${user.email}: ${url}`);
      }
    },
  },
  socialProviders: env.OAUTH_GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: env.OAUTH_GOOGLE_CLIENT_ID,
          clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(dbSchema.spaces).values({
            ownerId: user.id,
            name: 'My Space',
            icon: '💼',
            orderIndex: 0,
          });
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: env.RATE_LIMIT_WINDOW_SECONDS,
    max: env.RATE_LIMIT_MAX,
  },
  advanced: {
    defaultCookieAttributes: {
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
    database: {
      // Existing tables use UUID primary keys; better-auth defaults to
      // random alphanumeric IDs which Postgres rejects for UUID columns.
      generateId: 'uuid',
    },
  },
  plugins: [
    admin({
      defaultRole: env.DEFAULT_ROLE,
      adminUserIds: env.ADMIN_USER_IDS,
      roles: {
        guest: defaultAc.newRole({ user: [], session: [] }),
        ...defaultRoles,
      },
    }),
    bearer(),
    invite({
      defaultSenderResponse: 'url',
      defaultSenderResponseRedirect: 'signUp',
      sendUserInvitation: env.RESEND_API_KEY
        ? async ({ email, url }) => {
            const { Resend } = await import('resend');
            const resend = new Resend(getEnv().RESEND_API_KEY!);
            void resend.emails.send({
              from: getEnv().RESEND_FROM_EMAIL || 'Collectab <noreply@collectab.app>',
              to: email,
              subject: 'You are invited to Collectab',
              html: `Click <a href="${url}">here</a> to accept your invitation.`,
            });
          }
        : undefined,
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type AppAuth = typeof auth;
