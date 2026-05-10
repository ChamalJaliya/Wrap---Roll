import {
  evaluateLineItemReplacementPolicy,
  validateLineItemsReplacementSave,
  evaluateSupportDetailsEditPolicy,
} from '@wrap-roll/contracts';

describe('order-amendment.policy (contracts)', () => {
  it('allows cashier when payment is pending at delivery ready', () => {
    expect(
      evaluateLineItemReplacementPolicy(
        { status: 'ready', paymentStatus: 'pending', fulfillmentType: 'delivery' },
        'CASHIER',
      ).allowed,
    ).toBe(true);
  });

  it('blocks cashier when paid delivery is ready', () => {
    const r = evaluateLineItemReplacementPolicy(
      { status: 'ready', paymentStatus: 'completed', fulfillmentType: 'delivery' },
      'CASHIER',
    );
    expect(r.allowed).toBe(false);
  });

  it('blocks cashier line edits once payment is recorded even if workflow status is still placed/paid', () => {
    expect(
      evaluateLineItemReplacementPolicy(
        { status: 'paid', paymentStatus: 'completed', fulfillmentType: 'dine_in' },
        'CASHIER',
      ).allowed,
    ).toBe(false);
    expect(
      evaluateLineItemReplacementPolicy(
        { status: 'placed', paymentStatus: 'completed', fulfillmentType: 'takeaway' },
        'CASHIER',
      ).allowed,
    ).toBe(false);
  });

  it('lets ADMIN see amend affordance when cashier would be blocked (UI gate)', () => {
    expect(
      evaluateLineItemReplacementPolicy(
        { status: 'in_kitchen', paymentStatus: 'completed', fulfillmentType: 'takeaway' },
        'ADMIN',
      ).allowed,
    ).toBe(true);
  });

  it('requires admin override reason on save when cashier would be blocked', () => {
    const snap = {
      status: 'in_kitchen',
      paymentStatus: 'completed',
      fulfillmentType: 'takeaway',
    };
    expect(validateLineItemsReplacementSave(snap, 'ADMIN', '').allowed).toBe(false);
    expect(
      validateLineItemsReplacementSave(snap, 'ADMIN', '86 chicken — swap to veg').allowed,
    ).toBe(true);
  });

  it('support edit blocked for paid delivery ready (cashier)', () => {
    expect(
      evaluateSupportDetailsEditPolicy(
        { status: 'ready', paymentStatus: 'completed', fulfillmentType: 'delivery' },
        'CASHIER',
      ).allowed,
    ).toBe(false);
  });
});
