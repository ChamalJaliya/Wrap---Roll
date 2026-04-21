/** Minimum national significant digits after normalization (e.g. Sri Lanka mobile). */
export const MIN_PHONE_DIGITS = 9;
export const MAX_PHONE_DIGITS = 15;

export function normalizeCashierPhone(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim();
}

export function phoneDigits(raw: string | null | undefined): string {
  return normalizeCashierPhone(raw).replace(/\D/g, '');
}

export function isPhoneIntakeValid(
  intake: 'counter' | 'phone',
  digits: string,
): boolean {
  if (intake !== 'phone') return true;
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}
