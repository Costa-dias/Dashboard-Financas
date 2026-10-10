export const MAX_AMOUNT = 1_000_000_000_000;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_TRANSACTIONS = 20_000;

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validAmount(value: number): boolean {
  const cents = Math.round(value * 100);
  return Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT && cents > 0 && Number.isSafeInteger(cents);
}

export function amountInput(value: number): string {
  return String(Math.round(value * 100));
}
