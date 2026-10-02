export const DAY_MS = 86_400_000;

export function calculateExpirationDate(baseDate: string | number | Date, retentionDays: number) {
  const days = Number(retentionDays);
  if (!Number.isInteger(days) || days <= 0) return null;
  return new Date(new Date(baseDate).getTime() + days * DAY_MS);
}
