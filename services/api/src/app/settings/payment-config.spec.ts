import { normalizePaymentConfig } from './payment-config';

describe('normalizePaymentConfig', () => {
  it('returns defaults for empty payload', () => {
    const cfg = normalizePaymentConfig(null);
    expect(cfg.methods.cash).toBe(true);
    expect(cfg.methods.payhere).toBe(true);
  });

  it('supports legacy provider format', () => {
    const cfg = normalizePaymentConfig({ provider: 'payhere' });
    expect(cfg.methods.payhere).toBe(true);
    expect(cfg.methods.cash).toBe(true);
  });

  it('supports methods object', () => {
    const cfg = normalizePaymentConfig({
      methods: { cash: true, payhere: false, card: false, online: false },
    });
    expect(cfg.methods.cash).toBe(true);
    expect(cfg.methods.payhere).toBe(false);
  });
});

