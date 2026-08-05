import { getEnv } from '../config/env.js';

const DEFAULT_QUOTAS: Record<string, number> = {
  guest: 10,
  user: 500,
  admin: 10000,
};

export function getQuotaForRole(role: string | null | undefined): number {
  const key = role ?? 'guest';
  const env = getEnv();
  if (env.ROLE_QUOTAS && env.ROLE_QUOTAS[key] !== undefined) {
    return env.ROLE_QUOTAS[key];
  }
  return DEFAULT_QUOTAS[key] ?? DEFAULT_QUOTAS.guest;
}
