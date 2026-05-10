import {
  DEFAULT_PAYMENT_CONFIG,
  type NormalizedPaymentConfig,
  type PosPaymentControlsConfig,
} from '@wrap-roll/contracts';

export type { NormalizedPaymentConfig };

export function normalizePaymentConfig(raw: unknown): NormalizedPaymentConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_PAYMENT_CONFIG;
  const obj = raw as Record<string, unknown>;
  const methods =
    obj.methods && typeof obj.methods === 'object'
      ? (obj.methods as Record<string, unknown>)
      : null;

  // Backward compatibility for prior schema: { provider: "payhere" }
  const provider =
    typeof obj.provider === 'string' ? obj.provider.toLowerCase().trim() : '';

  let pos: PosPaymentControlsConfig | undefined;
  if (obj.pos && typeof obj.pos === 'object') {
    const p = obj.pos as Record<string, unknown>;
    pos = {
      requireSupervisorForCardCollection:
        p.requireSupervisorForCardCollection === true,
    };
  }

  return {
    methods: {
      cash: methods?.cash === undefined ? true : Boolean(methods.cash),
      payhere:
        methods?.payhere === undefined
          ? provider === 'payhere' || provider.length === 0
          : Boolean(methods.payhere),
      card: methods?.card === undefined ? false : Boolean(methods.card),
      online: methods?.online === undefined ? false : Boolean(methods.online),
    },
    ...(pos ? { pos } : {}),
  };
}

