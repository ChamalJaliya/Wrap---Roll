import { hashSupervisorPin, verifySupervisorPin } from './supervisor-pin.crypto';

describe('supervisor-pin.crypto', () => {
  it('round-trips hash and verify', async () => {
    const h = await hashSupervisorPin('secret-pin-123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifySupervisorPin('secret-pin-123', h)).toBe(true);
    expect(await verifySupervisorPin('wrong', h)).toBe(false);
  });
});
