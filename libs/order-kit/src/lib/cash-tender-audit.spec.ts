import {
  appendCashTenderAuditToNote,
  parseCashTenderFromAuditNote,
} from './cash-tender-audit';

describe('appendCashTenderAuditToNote', () => {
  it('matches parseCashTenderFromAuditNote round-trip', () => {
    const note = appendCashTenderAuditToNote('Collected at door', {
      cashReceived: 2863.5,
      changeReturned: 0,
    });
    expect(parseCashTenderFromAuditNote(note)).toEqual({
      tenderLkr: 2863.5,
      changeLkr: 0,
    });
  });
});

describe('parseCashTenderFromAuditNote', () => {
  it('parses standard POS audit suffix', () => {
    expect(
      parseCashTenderFromAuditNote('POS Pay now cash · Tender Rs 1500.00 · Change Rs 0.00'),
    ).toEqual({ tenderLkr: 1500, changeLkr: 0 });
  });

  it('parses handoff note', () => {
    expect(
      parseCashTenderFromAuditNote('Collected at cashier handoff · Tender Rs 2000.50 · Change Rs 124.50'),
    ).toEqual({ tenderLkr: 2000.5, changeLkr: 124.5 });
  });

  it('returns null when fragments missing', () => {
    expect(parseCashTenderFromAuditNote('cash only')).toBeNull();
    expect(parseCashTenderFromAuditNote('Tender Rs 100')).toBeNull();
    expect(parseCashTenderFromAuditNote(null)).toBeNull();
  });
});
