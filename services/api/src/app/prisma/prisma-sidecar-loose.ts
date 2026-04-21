/**
 * Narrow struct for `businessSettings` / `paymentEvent` when tooling mis-resolves
 * `PrismaClient` / `TransactionClient` (delegates missing on generics). Runtime is unchanged.
 */

export type LoosePaymentEventTx = {
  paymentEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type LoosePrismaSidecar = {
  businessSettings: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    upsert(args: {
      where: { id: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<unknown>;
  };
  paymentEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  coupon: {
    upsert(args: {
      where: { code: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

export function txPaymentSidecarLoose(tx: unknown): LoosePaymentEventTx {
  return tx as LoosePaymentEventTx;
}

export function prismaSidecarLoose(client: unknown): LoosePrismaSidecar {
  return client as LoosePrismaSidecar;
}
