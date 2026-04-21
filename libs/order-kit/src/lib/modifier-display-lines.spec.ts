import { getOrderItemModifierDisplayLines } from './modifier-display-lines';

describe('getOrderItemModifierDisplayLines', () => {
  it('does not render flat legacy-only modifier keys (optionGroups required)', () => {
    const raw = {
      base: 'Extra Sauce',
      protein: 'As selected',
      toppings: ['House'],
      extras: [{ name: 'Extra Sauce', price: 50 }],
    };
    expect(getOrderItemModifierDisplayLines(raw)).toEqual([]);
  });

  it('still shows notes on legacy-shaped payloads when notes is set', () => {
    const lines = getOrderItemModifierDisplayLines({
      base: 'ignored',
      notes: 'No onions',
    });
    expect(lines).toEqual([{ label: 'Notes', value: 'No onions' }]);
  });

  it('renders real optionGroups with admin group titles', () => {
    const lines = getOrderItemModifierDisplayLines({
      optionGroups: [
        {
          groupName: 'Enhancements',
          options: [{ label: 'Extra Sauce', priceAdjust: 50 }],
        },
      ],
    });
    const joined = lines.map((l) => `${l.label}: ${l.value}`).join('|');
    expect(joined).toMatch(/Enhancements/i);
    expect(joined).toMatch(/Extra Sauce/);
  });

  it('ignores parallel junk legacy keys when optionGroups is present', () => {
    const lines = getOrderItemModifierDisplayLines({
      base: 'Extra Sauce',
      extras: [{ name: 'Extra Sauce', price: 50 }],
      optionGroups: [
        {
          groupName: 'Enhancements',
          options: [{ label: 'Extra Sauce', priceAdjust: 50 }],
        },
      ],
    });
    const joined = lines.map((l) => `${l.label}: ${l.value}`).join(' | ');
    expect(joined).toMatch(/Enhancements/i);
    expect(joined).not.toMatch(/\bBase:/i);
  });
});
