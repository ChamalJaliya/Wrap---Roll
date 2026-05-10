export type ParsedCashTenderAudit = {
  tenderLkr: number;
  changeLkr: number;
};

/** Matches POS / courier / API notes persisted on `cash_collected` payment events. */
export type CashTenderAuditDetail = {
  cashReceived: number;
  changeReturned: number;
};

/** Append to PATCH `note` so receipts / recon can parse tender + change via {@link parseCashTenderFromAuditNote}. */
export function appendCashTenderAuditToNote(base: string, detail: CashTenderAuditDetail): string {
  const tender = Math.round(detail.cashReceived * 100) / 100;
  const ch = Math.round(detail.changeReturned * 100) / 100;
  return `${base} · Tender Rs ${tender.toFixed(2)} · Change Rs ${ch.toFixed(2)}`;
}

/** Parses till-audit suffix: `… · Tender Rs 1500.00 · Change Rs 0.00` (POS cash collection notes). */
export function parseCashTenderFromAuditNote(note: string | null | undefined): ParsedCashTenderAudit | null {
  if (!note || typeof note !== 'string') return null;
  const tenderM = note.match(/Tender Rs\s+([\d.,]+)/i);
  const changeM = note.match(/Change Rs\s+([\d.,]+)/i);
  if (!tenderM?.[1] || !changeM?.[1]) return null;
  const tenderLkr = Number(String(tenderM[1]).replace(/,/g, ''));
  const changeLkr = Number(String(changeM[1]).replace(/,/g, ''));
  if (!Number.isFinite(tenderLkr) || !Number.isFinite(changeLkr)) return null;
  return { tenderLkr, changeLkr };
}
