/**
 * Letterhead for thermal receipts and HTML invoice emails.
 *
 * Resolution order:
 * 1. `RECEIPT_LETTERHEAD_LINES` (pipe-separated) — optional ops override
 * 2. `BusinessSettings` singleton (business name, address, phone, email from Admin)
 * 3. Built-in fallback
 */

export type ReceiptLetterhead = {
  businessName: string;
  lines: string[];
};

/** Fields needed from `BusinessSettings` (singleton id = `singleton`) */
export type BusinessSettingsLetterheadFields = {
  businessName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  contactEmail: string;
};

const FALLBACK_LINES = [
  'Gourmet street food',
  'Colombo · Sri Lanka',
  'Thank you for dining with us',
] as const;

function parseReceiptLetterheadFromEnv(): ReceiptLetterhead | null {
  const raw = process.env.RECEIPT_LETTERHEAD_LINES?.trim();
  if (!raw) return null;
  const segments = raw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length < 1) return null;
  return {
    businessName: segments[0]!,
    lines: segments.slice(1),
  };
}

export function buildReceiptLetterheadFromBusinessSettings(
  row: BusinessSettingsLetterheadFields,
): ReceiptLetterhead {
  const lines: string[] = [];
  const a1 = row.addressLine1?.trim();
  const a2 = row.addressLine2?.trim();
  if (a1) lines.push(a1);
  if (a2) lines.push(a2);
  const phone = row.contactPhone?.trim();
  if (phone) lines.push(phone);
  const email = row.contactEmail?.trim();
  if (email) lines.push(email);
  const name = row.businessName?.trim();
  return {
    businessName: name || 'Wrap & Roll',
    lines,
  };
}

/** Used when DB/env unavailable (e.g. tests calling builders without settings). */
export function getFallbackReceiptLetterhead(): ReceiptLetterhead {
  return {
    businessName: 'Wrap & Roll',
    lines: [...FALLBACK_LINES],
  };
}

/**
 * Letterhead for receipts: env override, then BusinessSettings row, then static fallback.
 */
export function resolveReceiptLetterhead(
  settings: BusinessSettingsLetterheadFields | null | undefined,
): ReceiptLetterhead {
  const fromEnv = parseReceiptLetterheadFromEnv();
  if (fromEnv) return fromEnv;
  if (settings) {
    return buildReceiptLetterheadFromBusinessSettings(settings);
  }
  return getFallbackReceiptLetterhead();
}
