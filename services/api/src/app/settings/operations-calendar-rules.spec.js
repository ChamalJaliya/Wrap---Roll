"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const operations_calendar_rules_1 = require("./operations-calendar-rules");
describe('normalizeOperationsCalendar', () => {
    it('defaults empty', () => {
        const n = (0, operations_calendar_rules_1.normalizeOperationsCalendar)(null);
        expect(n.closedDates).toEqual([]);
        expect(n.specialHours).toEqual({});
    });
    it('filters invalid closed dates', () => {
        const n = (0, operations_calendar_rules_1.normalizeOperationsCalendar)({
            closedDates: ['2026-12-25', 'bad', '2026-01-02'],
        });
        expect(n.closedDates).toEqual(['2026-12-25', '2026-01-02']);
    });
});
describe('validateCustomerOrderTiming', () => {
    const base = {
        timezone: 'Asia/Colombo',
        openingTimeMinutes: 10 * 60,
        closingTimeMinutes: 23 * 60,
        scheduleSameDayOnly: true,
        minLeadTimeMinutes: 20,
        deliveryJson: { orderCutoffBeforeCloseMinutes: 60 },
        operationsCalendarJson: null,
    };
    it('blocks ASAP on closed date', () => {
        const now = new Date('2026-06-15T14:00:00+05:30');
        const r = (0, operations_calendar_rules_1.validateCustomerOrderTiming)(Object.assign(Object.assign({}, base), { now, requestedTime: null, operationsCalendarJson: { closedDates: ['2026-06-15'], specialHours: {} } }));
        expect(r.ok).toBe(false);
        if (r.ok === false)
            expect(r.message).toMatch(/closed/i);
    });
    it('blocks while emergency active', () => {
        const now = new Date('2026-06-15T14:00:00.000Z');
        const r = (0, operations_calendar_rules_1.validateCustomerOrderTiming)(Object.assign(Object.assign({}, base), { now, requestedTime: null, operationsCalendarJson: {
                closedDates: [],
                specialHours: {},
                emergencyClosureUntil: '2099-01-01T00:00:00.000Z',
                emergencyClosureMessage: 'Kitchen flood',
            } }));
        expect(r.ok).toBe(false);
        if (r.ok === false)
            expect(r.message).toContain('Kitchen flood');
    });
    it('POS bypass: allows ASAP after cutoff / outside hours on closed calendar day', () => {
        const now = new Date('2026-06-15T23:30:00+05:30');
        const r = (0, operations_calendar_rules_1.validateCustomerOrderTiming)(Object.assign(Object.assign({}, base), { now, requestedTime: null, operationsCalendarJson: { closedDates: ['2026-06-15'], specialHours: {} }, bypassOperatingWindowForPos: true }));
        expect(r.ok).toBe(true);
    });
    it('POS bypass: still blocked by emergency closure', () => {
        const now = new Date('2026-06-15T14:00:00.000Z');
        const r = (0, operations_calendar_rules_1.validateCustomerOrderTiming)(Object.assign(Object.assign({}, base), { now, requestedTime: null, bypassOperatingWindowForPos: true, operationsCalendarJson: {
                closedDates: [],
                specialHours: {},
                emergencyClosureUntil: '2099-01-01T00:00:00.000Z',
                emergencyClosureMessage: 'Kitchen flood',
            } }));
        expect(r.ok).toBe(false);
    });
    it('evaluatePublicOrderAcceptance mirrors ASAP', () => {
        const now = new Date('2026-06-15T14:00:00+05:30');
        const a = (0, operations_calendar_rules_1.evaluatePublicOrderAcceptance)({
            now,
            timezone: 'Asia/Colombo',
            openingTimeMinutes: 10 * 60,
            closingTimeMinutes: 23 * 60,
            deliveryJson: { orderCutoffBeforeCloseMinutes: 60 },
            operationsCalendarJson: { closedDates: ['2026-06-15'], specialHours: {} },
        });
        expect(a.accepting).toBe(false);
        expect(a.closureReason).toBeDefined();
    });
});
//# sourceMappingURL=operations-calendar-rules.spec.js.map