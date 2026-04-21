export type PaymentMethodsConfig = {
  cash: boolean;
  payhere: boolean;
  card: boolean;
  online: boolean;
};

export type NormalizedPaymentConfig = {
  methods: PaymentMethodsConfig;
};

export type SpecialHoursEntry = {
  openingTimeMinutes?: number;
  closingTimeMinutes?: number;
  /** When true, no orders for this calendar day (in business timezone). */
  closedForDay?: boolean;
  note?: string;
};

export type OperationsCalendar = {
  /** Full-day closures (YYYY-MM-DD in business timezone). */
  closedDates: string[];
  /** Per-date overrides; key is YYYY-MM-DD. */
  specialHours: Record<string, SpecialHoursEntry>;
  /**
   * While server `now` is before this instant (ISO 8601), reject new customer orders
   * (e.g. temporary closure mid-shift). Omit or null = not active.
   */
  emergencyClosureUntil?: string | null;
  emergencyClosureMessage?: string;
};

export const DEFAULT_OPERATIONS_CALENDAR: OperationsCalendar = {
  closedDates: [],
  specialHours: {},
};

export type PublicBusinessSettings = {
  timezone: string;
  openingTimeMinutes: number;
  closingTimeMinutes: number;
  scheduleSameDayOnly: boolean;
  minLeadTimeMinutes: number;
  /** YYYY-MM-DD current ops day in `timezone` (queue / recon defaults). */
  operationalCalendarDate: string;
  businessName: string;
  contactEmail: string;
  replyToEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  /** Storefront VAT rate (e.g. 0.15 for 15%). */
  checkoutVatRate: number;
  deliveryJson: unknown | null;
  paymentJson: unknown | null;
  operationsCalendarJson?: OperationsCalendar | null;
  paymentConfig?: NormalizedPaymentConfig;

  // Computed status
  acceptingOrders: boolean;
  closureReason?: string;
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethodsConfig = {
  cash: true,
  payhere: true,
  card: false,
  online: false,
};

export const DEFAULT_PAYMENT_CONFIG: NormalizedPaymentConfig = {
  methods: DEFAULT_PAYMENT_METHODS,
};
