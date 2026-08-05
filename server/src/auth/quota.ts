export const ROLE_QUOTAS: Record<string, number> = {
  guest: 10,
  user: 500,
  admin: 10000,
};

export function getQuotaForRole(role: string | null | undefined): number {
  return ROLE_QUOTAS[role ?? 'guest'] ?? ROLE_QUOTAS.guest;
}
