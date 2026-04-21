import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  Availability,
  Prisma,
  InventoryMovementType,
  InventoryReferenceType,
  FulfillmentType,
  PaymentMethod,
  OrderSource,
  OverheadCostType,
  OverheadAllocationScope,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  ORDER_SOURCES,
  PAYMENT_METHODS,
  FULFILLMENT_TYPES,
  SHOPPER_ROLE,
  type ModifierDefaultsByGroup,
} from '@wrap-roll/contracts';
import { prismaSidecarLoose } from './app/prisma/prisma-sidecar-loose';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

function img(url: string) {
  return `${url}?q=80&w=800`;
}

function enhancementsGroup() {
  return {
    groupId: uuidv4(),
    name: 'Enhancements',
    type: 'multi',
    required: false,
    options: [
      { optionId: uuidv4(), label: 'Extra Sauce', priceAdjust: 50 },
      { optionId: uuidv4(), label: 'Double Protein', priceAdjust: 350 },
      { optionId: uuidv4(), label: 'Add Cheese', priceAdjust: 150 },
      { optionId: uuidv4(), label: 'Pickled Jalapeños', priceAdjust: 75 },
      { optionId: uuidv4(), label: 'Fresh Herbs Pack', priceAdjust: 60 },
    ],
  };
}

function sizeGroup() {
  return {
    groupId: uuidv4(),
    name: 'Size',
    type: 'single',
    required: true,
    options: [
      { optionId: uuidv4(), label: 'Regular', priceAdjust: 0 },
      { optionId: uuidv4(), label: 'Large', priceAdjust: 220 },
      { optionId: uuidv4(), label: 'XL Feast', priceAdjust: 420 },
    ],
  };
}

function spiceGroup() {
  return {
    groupId: uuidv4(),
    name: 'Heat',
    type: 'single',
    required: false,
    options: [
      { optionId: uuidv4(), label: 'Mild', priceAdjust: 0 },
      { optionId: uuidv4(), label: 'Medium', priceAdjust: 0 },
      { optionId: uuidv4(), label: 'Fire', priceAdjust: 0 },
      { optionId: uuidv4(), label: 'Extra Fire (+ pickles)', priceAdjust: 50 },
    ],
  };
}

function drinkCustomizeGroup() {
  return {
    groupId: uuidv4(),
    name: 'Drink options',
    type: 'multi',
    required: false,
    options: [
      { optionId: uuidv4(), label: 'Less ice', priceAdjust: 0 },
      { optionId: uuidv4(), label: 'Extra lime', priceAdjust: 40 },
      { optionId: uuidv4(), label: 'Sugar-free syrup', priceAdjust: 50 },
      { optionId: uuidv4(), label: 'Extra shot (coffee)', priceAdjust: 120 },
    ],
  };
}

function bowlBaseGroup() {
  return {
    groupId: uuidv4(),
    name: 'Base',
    type: 'single',
    required: true,
    options: [
      { optionId: uuidv4(), label: 'Jeera Rice', priceAdjust: 0 },
      { optionId: uuidv4(), label: 'Quinoa blend', priceAdjust: 180 },
      { optionId: uuidv4(), label: 'Mixed greens', priceAdjust: 100 },
    ],
  };
}

function modifiersForCategory(cat: string) {
  switch (cat) {
    case 'Wraps':
      return [sizeGroup(), spiceGroup(), enhancementsGroup()];
    case 'Bowls':
      return [bowlBaseGroup(), spiceGroup(), enhancementsGroup()];
    case 'Drinks':
      return [drinkCustomizeGroup(), enhancementsGroup()];
    case 'Sides':
      return [enhancementsGroup()];
    case 'Desserts':
      return [
        {
          groupId: uuidv4(),
          name: 'Toppings',
          type: 'multi',
          required: false,
          options: [
            { optionId: uuidv4(), label: 'Extra drizzle', priceAdjust: 80 },
            { optionId: uuidv4(), label: 'Crushed nuts', priceAdjust: 120 },
          ],
        },
      ];
    case 'Breakfast':
      return [sizeGroup(), enhancementsGroup()];
    case 'Platters':
      return [spiceGroup(), enhancementsGroup()];
    default:
      return [enhancementsGroup()];
  }
}

type ModifierGroupSeed = {
  groupId: string;
  name: string;
  type: 'single' | 'multi';
  required?: boolean;
  options: Array<{
    optionId: string;
    label: string;
    priceAdjust?: number;
    isDefault?: boolean;
  }>;
};

function withModifierDefaults(
  groups: ModifierGroupSeed[],
  defaultsByGroupName: Record<string, string[]>,
): ModifierGroupSeed[] {
  return groups.map((g) => {
    const defaults = new Set(defaultsByGroupName[g.name] ?? []);
    return {
      ...g,
      options: g.options.map((o) => ({
        ...o,
        isDefault: defaults.has(o.label),
      })),
    };
  });
}

function modifiersForMenuItem(
  cat: string,
  defaultsByGroupName: ModifierDefaultsByGroup = {},
) {
  const groups = modifiersForCategory(cat) as ModifierGroupSeed[];
  return withModifierDefaults(groups, defaultsByGroupName);
}

type SeedSelectedOption = {
  optionId: string;
  label: string;
  priceAdjust: number;
};

type SeedSelectedModifierGroup = {
  groupId: string;
  groupName: string;
  options: SeedSelectedOption[];
};

function buildSeededLineModifiers(groups: ModifierGroupSeed[]): SeedSelectedModifierGroup[] {
  return groups
    .map((group) => {
      const options = Array.isArray(group.options) ? group.options : [];
      if (options.length === 0) return null;
      const defaults = options.filter((o) => o.isDefault);
      let selected: typeof options = [];

      if (group.type === 'single') {
        if (defaults.length > 0) selected = [defaults[0]!];
        else if (group.required) selected = [options[0]!];
        else if (Math.random() < 0.5) selected = [pick(options)];
      } else {
        selected = [...defaults];
        for (const opt of options) {
          const already = selected.some((s) => s.optionId === opt.optionId);
          if (!already && Math.random() < 0.2) selected.push(opt);
        }
      }

      if (selected.length === 0) return null;
      return {
        groupId: group.groupId,
        groupName: group.name,
        options: selected.map((opt) => ({
          optionId: opt.optionId,
          label: opt.label,
          priceAdjust: Number(opt.priceAdjust ?? 0),
        })),
      };
    })
    .filter((x): x is SeedSelectedModifierGroup => Boolean(x));
}

function prepTimeForCategory(cat: string) {
  switch (cat) {
    case 'Drinks':
      return 3;
    case 'Desserts':
      return 5;
    case 'Sides':
      return 7;
    case 'Breakfast':
      return 10;
    case 'Bowls':
      return 12;
    case 'Platters':
      return 15;
    case 'Wraps':
    default:
      return 9;
  }
}

async function seedMovement(params: {
  ingredientId: string;
  movementType: InventoryMovementType;
  quantityDelta: number;
  unitCost?: number;
  referenceType: InventoryReferenceType;
  note?: string;
  occurredAt: Date;
}) {
  const ingredient = await prisma.ingredient.findUnique({ where: { id: params.ingredientId } });
  if (!ingredient) throw new Error(`Ingredient not found: ${params.ingredientId}`);

  const currentQty = Number(ingredient.currentStock);
  const currentAvg = Number(ingredient.costPerUnit);
  const nextQty = currentQty + params.quantityDelta;
  if (nextQty < 0) throw new Error(`Negative stock for ingredient: ${ingredient.name}`);

  let nextAvg = currentAvg;
  if (params.movementType === 'PURCHASE') {
    const incoming = params.quantityDelta * Number(params.unitCost ?? 0);
    const current = currentQty * currentAvg;
    nextAvg = nextQty === 0 ? 0 : (current + incoming) / nextQty;
  } else if (nextQty === 0) {
    nextAvg = 0;
  }
  const effectiveUnitCost = params.unitCost ?? currentAvg;
  const totalValueDelta = params.quantityDelta * effectiveUnitCost;

  await prisma.ingredient.update({
    where: { id: ingredient.id },
    data: {
      currentStock: nextQty,
      costPerUnit: nextAvg,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      ingredientId: ingredient.id,
      movementType: params.movementType,
      quantityDelta: params.quantityDelta,
      unitCost: params.unitCost,
      totalValueDelta,
      resultingQty: nextQty,
      resultingAvgCost: nextAvg,
      referenceType: params.referenceType,
      note: params.note,
      occurredAt: params.occurredAt,
    },
  });

  await prisma.ingredientValuationSnapshot.create({
    data: {
      ingredientId: ingredient.id,
      avgUnitCost: nextAvg,
      onHandQty: nextQty,
      inventoryValue: nextQty * nextAvg,
      asOf: params.occurredAt,
    },
  });
}

type SeedAuthUser = {
  email: string;
  password: string;
  role: 'ADMIN' | 'CASHIER' | 'KITCHEN' | 'COURIER' | typeof SHOPPER_ROLE;
  fullName: string;
  phone?: string;
};

async function seedAuthUsers() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    console.warn('⚠️ Skipping auth seed (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing).');
    return [];
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const usersToSeed: SeedAuthUser[] = [
    { email: 'admin@wrapnroll.com', password: 'pass123', role: 'ADMIN', fullName: 'Primary Admin' },

    { email: 'cashier1@wrapnroll.com', password: 'pass123', role: 'CASHIER', fullName: 'Cashier One' },
    { email: 'cashier2@wrapnroll.com', password: 'pass123', role: 'CASHIER', fullName: 'Cashier Two' },

    { email: 'chef1@wrapnroll.com', password: 'pass123', role: 'KITCHEN', fullName: 'Kitchen Chef One' },
    { email: 'chef2@wrapnroll.com', password: 'pass123', role: 'KITCHEN', fullName: 'Kitchen Chef Two' },

    { email: 'delivery1@wrapnroll.com', password: 'pass123', role: 'COURIER', fullName: 'Courier One' },
    { email: 'delivery2@wrapnroll.com', password: 'pass123', role: 'COURIER', fullName: 'Courier Two' },
    { email: 'delivery3@wrapnroll.com', password: 'pass123', role: 'COURIER', fullName: 'Courier Three' },

    { email: 'customer1@wrapnroll.com', password: 'pass123', role: SHOPPER_ROLE, fullName: 'Customer One', phone: '0774000001' },
    { email: 'customer2@wrapnroll.com', password: 'pass123', role: SHOPPER_ROLE, fullName: 'Customer Two', phone: '0774000002' },
    { email: 'customer3@wrapnroll.com', password: 'pass123', role: SHOPPER_ROLE, fullName: 'Customer Three', phone: '0774000003' },
  ];

  console.log(`🔐 Seeding auth users (${usersToSeed.length})...`);

  const { data: listed, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    throw new Error(`Failed to list auth users for seed: ${listError.message}`);
  }
  const existingByEmail = new Map(
    (listed.users ?? [])
      .filter((u) => typeof u.email === 'string' && u.email.length > 0)
      .map((u) => [u.email!.toLowerCase(), u.id]),
  );

  const customerUsers: Array<{
    supabaseUserId: string;
    email: string;
    name: string;
    phone: string | null;
  }> = [];

  for (const user of usersToSeed) {
    const existingId = existingByEmail.get(user.email.toLowerCase());
    if (!existingId) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          role: user.role,
          full_name: user.fullName,
          phone: user.phone,
        },
      });
      if (error) {
        throw new Error(`Failed to create auth user ${user.email}: ${error.message}`);
      }
      const createdId = data.user?.id;
      if (user.role === SHOPPER_ROLE && createdId) {
        customerUsers.push({
          supabaseUserId: createdId,
          email: user.email.toLowerCase(),
          name: user.fullName,
          phone: user.phone ?? null,
        });
      }
      continue;
    }

    const { error } = await adminClient.auth.admin.updateUserById(existingId, {
      password: user.password,
      email_confirm: true,
      user_metadata: {
        role: user.role,
        full_name: user.fullName,
        phone: user.phone,
      },
    });
    if (error) {
      throw new Error(`Failed to update auth user ${user.email}: ${error.message}`);
    }
    if (user.role === SHOPPER_ROLE) {
      customerUsers.push({
        supabaseUserId: existingId,
        email: user.email.toLowerCase(),
        name: user.fullName,
        phone: user.phone ?? null,
      });
    }
  }

  console.log('✅ Auth users seeded/updated (admin + cashier + kitchen + courier + customer).');
  return customerUsers;
}

async function printSeedCoverageReport() {
  const statusCounts = await prisma.order.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const paymentCounts = await prisma.order.groupBy({
    by: ['paymentStatus'],
    _count: { _all: true },
  });
  const fulfillmentCounts = await prisma.order.groupBy({
    by: ['fulfillmentType'],
    _count: { _all: true },
  });
  const sourceCounts = await prisma.order.groupBy({
    by: ['source'],
    _count: { _all: true },
  });

  const [
    totalOrders,
    queueOrders,
    orderFlowPlaced,
    orderFlowKitchen,
    orderFlowDelivery,
    orderFlowCompleted,
    paymentPending,
    paymentCompleted,
    paymentFailed,
    paymentRefunded,
    supportPhoneOrders,
    soldOutItems,
    limitedItems,
    cashierOrders,
    cashierOfflineOrders,
    cashierCashOrders,
    cashierCardOrders,
    cashierPendingPayments,
    payOnDeliveryOrders,
    payOnPickupOrders,
    scheduledOrders,
  ] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: ['paid', 'in_kitchen', 'ready'] } } }),
      prisma.order.count({ where: { status: 'placed' } }),
      prisma.order.count({ where: { status: { in: ['paid', 'in_kitchen', 'ready'] } } }),
      prisma.order.count({ where: { status: 'in_transit' } }),
      prisma.order.count({ where: { status: { in: ['delivered', 'cancelled', 'voided', 'refunded'] } } }),
      prisma.order.count({ where: { paymentStatus: 'pending' } }),
      prisma.order.count({ where: { paymentStatus: 'completed' } }),
      prisma.order.count({ where: { paymentStatus: 'failed' } }),
      prisma.order.count({ where: { paymentStatus: 'refunded' } }),
      prisma.order.count({
        where: {
          customerPhone: {
            in: ['0702839075', '0702839076', '0702839077', '0702839078', '0702839079'],
          },
        },
      }),
      prisma.menuItem.count({ where: { availability: 'sold_out' } }),
      prisma.menuItem.count({ where: { availability: 'limited' } }),
      prisma.order.count({
        where: { source: { in: ['cashier_pos', 'cashier_pos_offline'] } },
      }),
      prisma.order.count({ where: { source: 'cashier_pos_offline' } }),
      prisma.order.count({
        where: { source: { in: ['cashier_pos', 'cashier_pos_offline'] }, paymentMethod: 'cash' },
      }),
      prisma.order.count({
        where: { source: { in: ['cashier_pos', 'cashier_pos_offline'] }, paymentMethod: 'card' },
      }),
      prisma.order.count({
        where: {
          source: { in: ['cashier_pos', 'cashier_pos_offline'] },
          paymentStatus: { in: ['pending', 'failed'] },
        },
      }),
      prisma.order.count({ where: { transactionId: { startsWith: 'ON_DELIVERY_' } } }),
      prisma.order.count({ where: { transactionId: { startsWith: 'ON_PICKUP_' } } }),
      prisma.order.count({ where: { estimatedReadyTime: { not: null } } }),
    ]);

  const printBucket = (title: string, rows: Array<{ key: string; count: number }>) => {
    console.log(`\n   ${title}`);
    for (const row of rows) {
      console.log(`   - ${row.key}: ${row.count}`);
    }
  };

  console.log('\n📊 Seed coverage report');
  console.log(`   totalOrders: ${totalOrders}`);
  console.log(`   activeKdsQueueOrders(paid|in_kitchen|ready): ${queueOrders}`);
  console.log(
    `   orderFlowBoardCoverage: placed=${orderFlowPlaced}, kitchen=${orderFlowKitchen}, delivery=${orderFlowDelivery}, completed=${orderFlowCompleted}`,
  );
  console.log(
    `   paymentFlowBoardCoverage: pending=${paymentPending}, completed=${paymentCompleted}, failed=${paymentFailed}, refunded=${paymentRefunded}`,
  );
  console.log(`   supportSearchPhonesOrders: ${supportPhoneOrders}`);
  console.log(`   menuAvailability: sold_out=${soldOutItems}, limited=${limitedItems}`);
  console.log(
    `   cashierCoverage: total=${cashierOrders}, offline=${cashierOfflineOrders}, cash=${cashierCashOrders}, card=${cashierCardOrders}, pendingOrFailed=${cashierPendingPayments}, onDelivery=${payOnDeliveryOrders}, onPickup=${payOnPickupOrders}`,
  );
  console.log(`   scheduledCoverage: scheduledOrders=${scheduledOrders}`);

  printBucket(
    'statusBreakdown',
    statusCounts.map((x) => ({ key: x.status, count: x._count._all })),
  );
  printBucket(
    'paymentStatusBreakdown',
    paymentCounts.map((x) => ({ key: x.paymentStatus, count: x._count._all })),
  );
  printBucket(
    'fulfillmentBreakdown',
    fulfillmentCounts.map((x) => ({ key: x.fulfillmentType, count: x._count._all })),
  );
  printBucket(
    'sourceBreakdown',
    sourceCounts.map((x) => ({ key: x.source, count: x._count._all })),
  );
}

async function main() {
  console.log('💎 Rich seed — Wrap & Roll (expanded catalog + orders)…');

  // One shot — avoids FK ordering edge cases across partial DB state
  const truncateTargets = [
    'OrderCogsLine',
    'OrderItem',
    'Order',
    'OverheadCostEntry',
    'IngredientValuationSnapshot',
    'InventoryMovement',
    'RecipeIngredient',
    'RestockLog',
    'MenuCategory',
    'MenuItem',
    'Ingredient',
    'Courier',
    'Customer',
    'Coupon',
    'BusinessSettings',
    'PaymentEvent',
  ];
  const existingTablesRaw = (await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  )) as Array<{ table_name?: string | null }>;
  const existing = new Set(
    existingTablesRaw.map((r) => String(r.table_name ?? '')).filter(Boolean),
  );
  const availableTargets = truncateTargets.filter((t) => existing.has(t));
  if (availableTargets.length > 0) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${availableTargets.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
    );
  }

  // Business settings singleton (used by checkout scheduling + contact/footer)
  await prismaSidecarLoose(prisma).businessSettings.create({
    data: {
      id: 'singleton',
      timezone: 'Asia/Colombo',
      openingTimeMinutes: 10 * 60,
      closingTimeMinutes: 23 * 60,
      scheduleSameDayOnly: true,
      minLeadTimeMinutes: 20,
      businessName: 'Wrap & Roll',
      contactEmail: 'hello@wrapandroll.lk',
      replyToEmail: 'hello@wrapandroll.lk',
      contactPhone: '+94 77 123 4567',
      addressLine1: '123 Flavor Street,',
      addressLine2: 'Foodie District, Colombo 03',
      checkoutVatRate: 0.15,
      deliveryJson: {
        enabled: true,
        feeMode: 'distance',
        feeFlat: 0,
        orderCutoffBeforeCloseMinutes: 60,
        originLat: 6.93194,
        originLng: 79.84778,
        distanceBands: [
          { maxKm: 3, fee: 200 },
          { maxKm: null, fee: 400 },
        ],
      },
      paymentJson: {
        methods: {
          cash: true,
          payhere: true,
          card: false,
          online: false,
        },
      },
      operationsCalendarJson: {
        closedDates: [],
        specialHours: {},
      },
    },
  });

  const expiryFar = new Date('2026-12-31T23:59:59.999Z');
  await prismaSidecarLoose(prisma).coupon.upsert({
    where: { code: 'FIRSTROLL' },
    create: {
      id: uuidv4(),
      code: 'FIRSTROLL',
      discountPercent: 0.1,
      minSubtotal: null,
      firstOrderOnly: true,
      isActive: true,
      expiryDate: expiryFar,
    },
    update: {
      discountPercent: 0.1,
      firstOrderOnly: true,
      isActive: true,
      expiryDate: expiryFar,
    },
  });
  await prismaSidecarLoose(prisma).coupon.upsert({
    where: { code: 'WRAP20' },
    create: {
      id: uuidv4(),
      code: 'WRAP20',
      discountPercent: 0.2,
      minSubtotal: 2000,
      firstOrderOnly: false,
      isActive: true,
      expiryDate: expiryFar,
    },
    update: {
      discountPercent: 0.2,
      minSubtotal: 2000,
      isActive: true,
      expiryDate: expiryFar,
    },
  });
  await prismaSidecarLoose(prisma).coupon.upsert({
    where: { code: 'WELCOME10' },
    create: {
      id: uuidv4(),
      code: 'WELCOME10',
      discountPercent: 0.1,
      minSubtotal: null,
      firstOrderOnly: false,
      isActive: true,
      expiryDate: expiryFar,
    },
    update: {
      discountPercent: 0.1,
      isActive: true,
      expiryDate: expiryFar,
    },
  });

  console.log('📦 Ingredients (30+)…');
  /** Generous dev/demo stock — “ample daily inventory”; lower multipliers for scarcity testing. */
  const SEED_STOCK_MULTIPLIER = 10;
  const SEED_LOW_STOCK_MULTIPLIER = 5;
  const ingredientRowsBase = [
    { name: 'Standard Pita Shell', unit: 'pcs' as const, cost: 45, stock: 520, low: 60 },
    { name: 'Wheat Tortilla Large', unit: 'pcs' as const, cost: 65, stock: 410, low: 35 },
    { name: 'Garlic Butter Paratha', unit: 'pcs' as const, cost: 55, stock: 300, low: 40 },
    { name: 'Marinated Chicken Strips', unit: 'g' as const, cost: 1.15, stock: 28000, low: 6000 },
    { name: 'Tandoori Paneer', unit: 'g' as const, cost: 2.4, stock: 16000, low: 2500 },
    { name: 'Minced Beef Kofta', unit: 'pcs' as const, cost: 118, stock: 220, low: 45 },
    { name: 'Lamb Shawarma Slice', unit: 'g' as const, cost: 2.8, stock: 12000, low: 2000 },
    { name: 'Falafel Mix (dry)', unit: 'g' as const, cost: 0.9, stock: 20000, low: 4000 },
    { name: 'Hummus Base', unit: 'g' as const, cost: 1.1, stock: 18000, low: 2000 },
    { name: 'Tahini Dressing', unit: 'ml' as const, cost: 1.2, stock: 8000, low: 900 },
    { name: 'Garlic Yogurt Sauce', unit: 'ml' as const, cost: 0.85, stock: 11000, low: 1100 },
    { name: 'Harissa Paste', unit: 'g' as const, cost: 3.2, stock: 5000, low: 500 },
    { name: 'Pickled Turnips', unit: 'g' as const, cost: 1.5, stock: 6000, low: 600 },
    { name: 'Basmati Jeera Rice', unit: 'g' as const, cost: 0.35, stock: 50000, low: 8000 },
    { name: 'Quinoa Blend', unit: 'g' as const, cost: 1.8, stock: 12000, low: 1500 },
    { name: 'Mixed Salad Greens', unit: 'g' as const, cost: 0.6, stock: 15000, low: 2000 },
    { name: 'Spiced French Fries', unit: 'g' as const, cost: 0.42, stock: 42000, low: 9000 },
    { name: 'Sweet Potato Fries', unit: 'g' as const, cost: 0.55, stock: 20000, low: 3500 },
    { name: 'Coke / Soda Syrup', unit: 'ml' as const, cost: 0.48, stock: 22000, low: 2200 },
    { name: 'Fresh Lime Juice', unit: 'ml' as const, cost: 2.1, stock: 5000, low: 500 },
    { name: 'Arabica Coffee Beans', unit: 'g' as const, cost: 4.5, stock: 8000, low: 800 },
    { name: 'Peach Tea Concentrate', unit: 'ml' as const, cost: 1.6, stock: 6000, low: 700 },
    { name: 'Nutella', unit: 'g' as const, cost: 3.8, stock: 9000, low: 1000 },
    { name: 'Phyllo / Baklava Sheets', unit: 'pcs' as const, cost: 35, stock: 800, low: 100 },
    { name: 'Pistachio Crumble', unit: 'g' as const, cost: 8.5, stock: 4000, low: 400 },
    { name: 'Halloumi Block', unit: 'g' as const, cost: 3.5, stock: 7000, low: 800 },
    { name: 'Egg (free-range)', unit: 'pcs' as const, cost: 55, stock: 600, low: 80 },
    { name: 'Avocado Pulp', unit: 'g' as const, cost: 2.2, stock: 5000, low: 600 },
    { name: 'Turkish Sucuk', unit: 'g' as const, cost: 3.1, stock: 4500, low: 500 },
  ];
  const ingredientRows = ingredientRowsBase.map((row) => ({
    ...row,
    stock: Math.max(1, Math.round(row.stock * SEED_STOCK_MULTIPLIER)),
    low: Math.max(1, Math.round(row.low * SEED_LOW_STOCK_MULTIPLIER)),
  }));

  const ingredients: { id: string }[] = [];
  for (const info of ingredientRows) {
    const ingredientId = uuidv4();
    const ing = await prisma.ingredient.create({
      data: {
        id: ingredientId,
        name: info.name,
        unit: info.unit,
        costPerUnit: 0,
        currentStock: 0,
        lowStockThreshold: info.low,
      },
    });
    const firstBatch = Math.max(1, Math.floor(info.stock * 0.6));
    const secondBatch = info.stock - firstBatch;
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 35);
    await seedMovement({
      ingredientId,
      movementType: 'PURCHASE',
      quantityDelta: firstBatch,
      unitCost: info.cost * 0.92,
      referenceType: 'PURCHASE',
      note: 'Initial supplier purchase batch A',
      occurredAt: new Date(baseDate),
    });
    if (secondBatch > 0) {
      const secondDate = new Date(baseDate);
      secondDate.setDate(secondDate.getDate() + 12);
      await seedMovement({
        ingredientId,
        movementType: 'PURCHASE',
        quantityDelta: secondBatch,
        unitCost: info.cost * 1.08,
        referenceType: 'PURCHASE',
        note: 'Initial supplier purchase batch B',
        occurredAt: secondDate,
      });
    }
    ingredients.push(ing);
  }

  for (let i = 0; i < 12; i++) {
    const ingredient = pick(ingredients);
    const when = new Date();
    when.setDate(when.getDate() - (18 - i));
    await seedMovement({
      ingredientId: ingredient.id,
      movementType: 'WASTE',
      quantityDelta: -(1 + (i % 3)),
      referenceType: 'WASTE',
      note: 'Spoilage/discard sample',
      occurredAt: when,
    });
  }

  console.log('🛵 Couriers…');
  const courierRows = [
    { name: 'Kasun Perera', phone: '0772233445' },
    { name: 'Nuwan Bandara', phone: '0714455667' },
    { name: 'Dilshan Silva', phone: '0767711223' },
    { name: 'Ravindu Jayasuriya', phone: '0778899001' },
    { name: 'Shehan Wickramasinghe', phone: '0713344556' },
    { name: 'Malith Rathnayake', phone: '0769988770' },
    { name: 'Gayan Madushanka', phone: '0751122334' },
    { name: 'Tharindu Senanayake', phone: '0776677889' },
  ];
  const couriers: { id: string }[] = [];
  for (const c of courierRows) {
    const row = await prisma.courier.create({ data: { id: uuidv4(), ...c } });
    couriers.push(row);
  }

  console.log('🍔 Menu catalog (40 items, rich modifiers)…');
  const menuDefs: {
    name: string;
    cat: string;
    p: number;
    img: string;
    desc: string;
    availability?: Availability;
    modifierDefaults?: ModifierDefaultsByGroup;
  }[] = [
    {
      name: 'Classic Shawarma Roll',
      cat: 'Wraps',
      p: 850,
      img: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f',
      desc: 'Chicken shawarma, garlic sauce, pickles, and fries inside a warm pita — our signature.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Medium'] },
    },
    {
      name: 'Firecracker Beef Wrap',
      cat: 'Wraps',
      p: 1150,
      img: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141',
      desc: 'Spiced minced beef, harissa mayo, crunchy slaw, and melted cheese.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Fire'] },
    },
    {
      name: 'Paneer Tikka Heaven',
      cat: 'Wraps',
      p: 780,
      img: 'https://images.unsplash.com/photo-1626074285701-a180f68d6f51',
      desc: 'Charred paneer tikka, mint yogurt, caramelized onions, and crisp lettuce.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Mild'] },
    },
    {
      name: 'Lamb Kofta Feast',
      cat: 'Wraps',
      p: 1350,
      img: 'https://images.unsplash.com/photo-1544025162-d76694265947',
      desc: 'Juicy lamb kofta, tahini drizzle, sumac onions, and house pickles.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Medium'] },
    },
    {
      name: 'Hummus & Falafel Roll',
      cat: 'Wraps',
      p: 690,
      img: 'https://images.unsplash.com/photo-1593001874117-c99c4ed6618e',
      desc: 'Crispy falafel, silky hummus, tabbouleh, and tahini — fully vegetarian.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Mild'] },
    },
    {
      name: 'Halloumi Harissa Wrap',
      cat: 'Wraps',
      p: 920,
      img: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783',
      desc: 'Grilled halloumi, mild harissa, roasted veg, and garlic yogurt.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Mild'] },
    },
    {
      name: 'Sucuk & Egg Breakfast Wrap',
      cat: 'Breakfast',
      p: 680,
      img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8',
      desc: 'Turkish sucuk, folded egg, cheese, and tomato — breakfast that hits.',
      modifierDefaults: { Size: ['Regular'] },
    },
    {
      name: 'Avocado Falafel Wrap',
      cat: 'Wraps',
      p: 890,
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
      desc: 'Smashed avocado, falafel crunch, lime yogurt, and mixed greens.',
      modifierDefaults: { Size: ['Regular'], Heat: ['Mild'] },
    },

    {
      name: 'Shawarma Rice Bowl',
      cat: 'Bowls',
      p: 1250,
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
      desc: 'Jeera rice, shawarma strips, hummus, salad, and garlic sauce cup.',
      modifierDefaults: { Base: ['Jeera Rice'], Heat: ['Medium'] },
    },
    {
      name: 'Tandoori Protein Bowl',
      cat: 'Bowls',
      p: 1100,
      img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
      desc: 'Your choice base with tandoori chicken, raita, chutney, and pickled onion.',
      modifierDefaults: { Base: ['Jeera Rice'], Heat: ['Medium'] },
    },
    {
      name: 'Naked Falafel Bowl',
      cat: 'Bowls',
      p: 950,
      img: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe',
      desc: 'Greens or rice, falafel, hummus, roasted pumpkin, and tahini dressing.',
      modifierDefaults: { Base: ['Mixed greens'], Heat: [] },
    },
    {
      name: 'Lamb & Quinoa Power Bowl',
      cat: 'Bowls',
      p: 1420,
      img: 'https://images.unsplash.com/photo-1547592180-85f173990554',
      desc: 'Quinoa blend, spiced lamb, pomegranate, mint, and lemon yogurt.',
      modifierDefaults: { Base: ['Quinoa blend'], Heat: ['Medium'] },
    },
    {
      name: 'Chicken Caesar Shawarma Bowl',
      cat: 'Bowls',
      p: 1180,
      img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d',
      desc: 'Romaine, shaved parmesan, shawarma chicken, croutons, and Caesar-yogurt.',
      modifierDefaults: { Base: ['Mixed greens'], Heat: ['Mild'] },
    },

    {
      name: 'Masala Loaded Fries',
      cat: 'Sides',
      p: 550,
      img: 'https://images.unsplash.com/photo-1630384066202-18d030e2599e',
      desc: 'Crispy fries, masala dust, cheese sauce, and coriander.',
    },
    {
      name: 'Sweet Potato Chaat Fries',
      cat: 'Sides',
      p: 620,
      img: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6',
      desc: 'Baked sweet potato fries, tamarind drizzle, yogurt, and sev.',
    },
    {
      name: 'Garlic Yogurt Dip',
      cat: 'Sides',
      p: 150,
      img: 'https://images.unsplash.com/photo-1571153177685-64506c278776',
      desc: 'Thick garlic labneh-style dip — perfect for fries or bread.',
    },
    {
      name: 'Hummus Tub',
      cat: 'Sides',
      p: 450,
      img: 'https://images.unsplash.com/photo-1582450876938-16e04d444458',
      desc: '400g smooth hummus with olive oil and paprika.',
    },
    {
      name: 'Mixed Mezze Platter',
      cat: 'Platters',
      p: 2450,
      img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950',
      desc: 'Hummus, falafel, pickles, olives, pita, and two dips — feeds 2–3.',
      modifierDefaults: { Heat: ['Mild'] },
    },
    {
      name: 'Family Shawarma Platter',
      cat: 'Platters',
      p: 3890,
      img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1',
      desc: 'Mixed meats, rice, salads, sauces, and six pitas.',
      modifierDefaults: { Heat: ['Mild'] },
    },

    {
      name: 'Mint Lime Soda',
      cat: 'Drinks',
      p: 350,
      img: 'https://images.unsplash.com/photo-1543083477-4f7f4aaac969',
      desc: 'Fresh mint, lime, soda, and a touch of rose.',
    },
    {
      name: 'Turkish Dark Coffee',
      cat: 'Drinks',
      p: 450,
      img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93',
      desc: 'Pot-brewed strong coffee served with lokum.',
    },
    {
      name: 'Iced Peach Tea',
      cat: 'Drinks',
      p: 400,
      img: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87',
      desc: 'Black tea, peach syrup, lemon wheel — thirst crusher.',
    },
    {
      name: 'Fresh Lime Cooler',
      cat: 'Drinks',
      p: 320,
      img: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859',
      desc: 'Squeezed lime, soda, pinch of salt — island classic.',
    },
    {
      name: 'Mango Lassi Shake',
      cat: 'Drinks',
      p: 480,
      img: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699',
      desc: 'Alphonso mango, yogurt, cardamom, optional rose.',
    },
    {
      name: 'Cold Brew Caramel',
      cat: 'Drinks',
      p: 520,
      img: 'https://images.unsplash.com/photo-1461023058943-07fcbef16e34',
      desc: '24h cold brew, salted caramel, oat milk option.',
    },

    {
      name: 'Nutella Fold Wrap',
      cat: 'Desserts',
      p: 650,
      img: 'https://images.unsplash.com/photo-1511914265872-c40672604a80',
      desc: 'Warm paratha pocket with Nutella and banana.',
    },
    {
      name: 'Baklava Trio',
      cat: 'Desserts',
      p: 750,
      img: 'https://images.unsplash.com/photo-1519676867240-f03562e64548',
      desc: 'Three pieces: pistachio, walnut, and chocolate.',
    },
    {
      name: 'Kunafa Bites (4pc)',
      cat: 'Desserts',
      p: 890,
      img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587',
      desc: 'Mini kunafa cups with syrup and cream.',
    },
    {
      name: 'Date & Tahini Square',
      cat: 'Desserts',
      p: 420,
      img: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c',
      desc: 'Medjool dates, sesame tahini fudge, sea salt.',
    },

    {
      name: 'Kids Chicken Bites',
      cat: 'Sides',
      p: 480,
      img: 'https://images.unsplash.com/photo-1562967914-608f82629710',
      desc: 'Mild chicken pops with yogurt dip — kid approved.',
    },
    {
      name: 'Soup of the Day (Lentil)',
      cat: 'Sides',
      p: 380,
      img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd',
      desc: 'Hearty spiced lentil with lemon wedge and pita.',
      availability: Availability.limited,
    },
    {
      name: 'Charred Corn Ribs',
      cat: 'Sides',
      p: 590,
      img: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076',
      desc: 'Corn “ribs” with lime butter and chili salt.',
    },
    {
      name: 'Overnight Oats Jar',
      cat: 'Breakfast',
      p: 450,
      img: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf',
      desc: 'Chia oats, mango, coconut, and toasted nuts.',
      modifierDefaults: { Size: ['Regular'] },
    },
    {
      name: 'Menemen Plate',
      cat: 'Breakfast',
      p: 720,
      img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8',
      desc: 'Turkish-style eggs, peppers, sucuk, and sourdough.',
      modifierDefaults: { Size: ['Regular'] },
    },
    {
      name: 'Spicy Paneer Pocket (Limited)',
      cat: 'Wraps',
      p: 820,
      img: 'https://images.unsplash.com/photo-1561651823-34feb02250f3',
      desc: 'Ghost-pepper glaze available on request — chef’s weekly special.',
      availability: Availability.limited,
      modifierDefaults: { Size: ['Regular'], Heat: ['Fire'] },
    },
    {
      name: 'Truffle Fries (Sold out demo)',
      cat: 'Sides',
      p: 720,
      img: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877',
      desc: 'Reserved for testing sold-out state in POS.',
      availability: Availability.sold_out,
    },
  ];

  const categoryNames = [...new Set(menuDefs.map((entry) => entry.cat))];
  const categoryByName = new Map<string, string>();
  for (const [index, categoryName] of categoryNames.entries()) {
    const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const category = await prisma.menuCategory.create({
      data: {
        id: uuidv4(),
        name: categoryName,
        slug,
        sortOrder: index,
      },
    });
    categoryByName.set(categoryName, category.id);
  }

  const seededMenuItems: {
    id: string;
    name: string;
    basePrice: number;
    modifierGroupsJson: ModifierGroupSeed[];
  }[] = [];

  for (const m of menuDefs) {
    const categoryId = categoryByName.get(m.cat);
    if (!categoryId) {
      throw new Error(`Missing category mapping for "${m.cat}"`);
    }
    const modifierGroupsJson = modifiersForMenuItem(m.cat, m.modifierDefaults);
    const item = await prisma.menuItem.create({
      data: {
        id: uuidv4(),
        name: m.name,
        description: m.desc,
        basePrice: m.p,
        prepTimeMinutes: prepTimeForCategory(m.cat),
        imageUrl: img(m.img),
        categoryId,
        availability: m.availability ?? Availability.available,
        isActive: true,
        modifierGroupsJson,
      },
    });
    seededMenuItems.push({
      id: item.id,
      name: item.name,
      basePrice: Number(item.basePrice),
      modifierGroupsJson,
    });
  }

  console.log('🧩 Modifier → ingredient deltas (sample)…');
  const chicken = await prisma.ingredient.findFirst({ where: { name: 'Marinated Chicken Strips' } });
  const paneer = await prisma.ingredient.findFirst({ where: { name: 'Tandoori Paneer' } });
  const fries = await prisma.ingredient.findFirst({ where: { name: 'Spiced French Fries' } });
  const tahini = await prisma.ingredient.findFirst({ where: { name: 'Tahini Dressing' } });

  const menuItemsForDeltas = await prisma.menuItem.findMany({
    where: { id: { in: seededMenuItems.map((i) => i.id) } },
    select: { id: true, name: true, category: { select: { name: true } }, modifierGroupsJson: true },
  });

  const pickOptionId = (groups: any, optionLabel: string) => {
    const g = (Array.isArray(groups) ? groups : []).find((x: any) => String(x?.name) === 'Enhancements');
    const o = (g?.options ?? []).find((x: any) => String(x?.label) === optionLabel);
    return typeof o?.optionId === 'string' ? o.optionId : null;
  };

  for (const item of menuItemsForDeltas) {
    if (item.category?.name !== 'Wraps' && item.category?.name !== 'Bowls') continue;
    const rawJson = item.modifierGroupsJson;
    const groups = Array.isArray(rawJson) ? rawJson : [];
    const doubleProteinId = pickOptionId(groups, 'Double protein');
    const extraFriesId = pickOptionId(groups, 'Extra fries');
    const extraSauceId = pickOptionId(groups, 'Extra sauce');

    if (doubleProteinId && (chicken?.id || paneer?.id)) {
      const proteinId =
        item.name.toLowerCase().includes('paneer') && paneer?.id ? paneer.id : chicken?.id ?? paneer?.id;
      if (proteinId) {
        await prisma.menuModifierOptionIngredientDelta.createMany({
          data: [
            {
              menuItemId: item.id,
              optionId: doubleProteinId,
              ingredientId: proteinId,
              quantityDelta: new Prisma.Decimal(80),
            },
          ],
          skipDuplicates: true,
        });
      }
    }

    if (extraFriesId && fries?.id) {
      await prisma.menuModifierOptionIngredientDelta.createMany({
        data: [
          {
            menuItemId: item.id,
            optionId: extraFriesId,
            ingredientId: fries.id,
            quantityDelta: new Prisma.Decimal(60),
          },
        ],
        skipDuplicates: true,
      });
    }

    if (extraSauceId && tahini?.id) {
      await prisma.menuModifierOptionIngredientDelta.createMany({
        data: [
          {
            menuItemId: item.id,
            optionId: extraSauceId,
            ingredientId: tahini.id,
            quantityDelta: new Prisma.Decimal(20),
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  console.log('🍳 Recipes → ingredients…');
  for (const item of seededMenuItems) {
    const n = 2 + Math.floor(Math.random() * 4);
    const used = new Set<number>();
    for (let i = 0; i < n && used.size < ingredients.length; i++) {
      let idx = Math.floor(Math.random() * ingredients.length);
      while (used.has(idx)) idx = (idx + 1) % ingredients.length;
      used.add(idx);
      const ing = ingredients[idx]!;
      await prisma.recipeIngredient.create({
        data: {
          id: uuidv4(),
          menuItemId: item.id,
          ingredientId: ing.id,
          quantityUsed: Math.floor(1 + Math.random() * 6),
        },
      });
    }
  }

  console.log('📝 Restock logs (60)…');
  const restockNotes = [
    'Weekly Cargills delivery',
    'Emergency top-up — weekend rush',
    'Supplier batch #4421',
    'Corrected short shipment',
    'Promo weekend prep',
    'Quality check passed',
    'Transferred from central kitchen',
    'End-of-month inventory fill',
  ];
  for (let i = 0; i < 60; i++) {
    const ing = pick(ingredients);
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 45));
    await prisma.restockLog.create({
      data: {
        id: uuidv4(),
        ingredientId: ing.id,
        quantity: Math.floor(40 + Math.random() * 260),
        note: pick(restockNotes),
        restockedAt: d,
      },
    });
  }

  console.log('💡 Overheads (utilities/labor)…');
  const overheadSeed: Array<{
    costType: OverheadCostType;
    amount: number;
    scope: OverheadAllocationScope;
  }> = [
    { costType: 'ELECTRICITY', amount: 78000, scope: 'GLOBAL' },
    { costType: 'WATER', amount: 16500, scope: 'KITCHEN' },
    { costType: 'GAS', amount: 42000, scope: 'KITCHEN' },
    { costType: 'LABOR', amount: 360000, scope: 'GLOBAL' },
    { costType: 'RENT', amount: 250000, scope: 'GLOBAL' },
  ];
  for (let i = 0; i < 3; i++) {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - i, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    for (const entry of overheadSeed) {
      await prisma.overheadCostEntry.create({
        data: {
          costType: entry.costType,
          amount: entry.amount,
          allocationScope: entry.scope,
          periodStart: monthStart,
          periodEnd: monthEnd,
          note: `Seeded ${entry.costType.toLowerCase()} cost`,
        },
      });
    }
  }

  console.log('🗣️ Customers (18)…');
  const customerNames = [
    ['Amal', 'Perera'],
    ['Nuskiya', 'Ali'],
    ['Shane', 'Fernando'],
    ['Devin', 'De Silva'],
    ['Kavindu', 'Bandara'],
    ['Imashi', 'Wijesinghe'],
    ['Rashid', 'Hassan'],
    ['Tania', 'Rodrigo'],
    ['Chatura', 'Mendis'],
    ['Dinethi', 'Karunaratne'],
    ['Omar', 'Saleem'],
    ['Priyanka', 'Samarasinghe'],
    ['Lasith', 'Gunawardena'],
    ['Ayesha', 'Mohamed'],
    ['Ryan', 'Jayawardena'],
    ['Sachini', 'Ekanayake'],
    ['Fahim', 'Rahman'],
    ['Anuki', 'Ratwatte'],
  ];
  const customers: { id: string }[] = [];
  for (const [index, [first, last]] of customerNames.entries()) {
    const phone = `0773${String(index + 1).padStart(6, '0')}`;
    const c = await prisma.customer.create({
      data: { id: uuidv4(), name: `${first} ${last}`, phone },
    });
    customers.push(c);
  }

  console.log('🗓️ Orders (24 days, multi-line, delivery + discounts — sequential writes for remote DB)…');
  const sources = ORDER_SOURCES as readonly OrderSource[];
  const payMethods = PAYMENT_METHODS as readonly PaymentMethod[];
  const fulfill = FULFILLMENT_TYPES as readonly FulfillmentType[];
  const colomboAddresses = [
    '42 Flower Rd, Colombo 7',
    '18 Galle Rd, Col 03',
    '5 Havelock Rd, Col 05',
    '2 Duplication Rd, Col 04',
    '9 Marine Drive, Col 06',
  ];

  const statusWeighted: OrderStatus[] = [
    OrderStatus.delivered,
    OrderStatus.delivered,
    OrderStatus.delivered,
    OrderStatus.delivered,
    OrderStatus.paid,
    OrderStatus.placed,
    OrderStatus.in_kitchen,
    OrderStatus.ready,
    OrderStatus.in_transit,
    OrderStatus.cancelled,
    OrderStatus.voided,
    OrderStatus.refunded,
  ];

  const daysToSeed = 24;

  for (let d = 0; d < daysToSeed; d++) {
    const ordersPerDay = 3 + Math.floor(Math.random() * 6);
    for (let o = 0; o < ordersPerDay; o++) {
      const lineCount = Math.random() < 0.42 ? 2 + Math.floor(Math.random() * 2) : 1;
      const lines: {
        menuItemId: string;
        name: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        modifiersJson: Prisma.JsonValue;
      }[] = [];

      let subtotal = 0;
      for (let li = 0; li < lineCount; li++) {
        const mi = pick(seededMenuItems);
        const qty = Math.random() < 0.15 ? 2 : 1;
        const unitPrice = mi.basePrice;
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        lines.push({
          menuItemId: mi.id,
          name: mi.name,
          quantity: qty,
          unitPrice,
          lineTotal,
          modifiersJson: buildSeededLineModifiers(mi.modifierGroupsJson) as Prisma.JsonValue,
        });
      }

      const discountCode = Math.random() < 0.12 ? 'WRAP10' : undefined;
      const discountAmount = discountCode ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const fType = pick(fulfill);
      const deliveryFee =
        fType === 'delivery' ? Math.round((150 + Math.random() * 200) * 100) / 100 : 0;
      const taxable = Math.max(0, subtotal - discountAmount);
      const tax = Math.round(taxable * 0.15 * 100) / 100;
      const total = Math.round((taxable + tax + deliveryFee) * 100) / 100;

      const status = pick(statusWeighted);
      const paidLike =
        status === OrderStatus.delivered ||
        status === OrderStatus.paid ||
        status === OrderStatus.in_kitchen ||
        status === OrderStatus.ready ||
        status === OrderStatus.in_transit ||
        status === OrderStatus.refunded;

      const paymentStatus: PaymentStatus =
        status === OrderStatus.refunded
          ? PaymentStatus.refunded
          : status === OrderStatus.cancelled || status === OrderStatus.voided
            ? Math.random() < 0.6
              ? PaymentStatus.failed
              : PaymentStatus.pending
            : paidLike
              ? PaymentStatus.completed
              : PaymentStatus.pending;

      const randomDate = new Date();
      randomDate.setDate(randomDate.getDate() - (daysToSeed - d));
      randomDate.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

      const isDelivery = fType === 'delivery';
      const courierId =
        isDelivery && Math.random() > 0.2 ? pick(couriers).id : undefined;
      const linkCustomer = Math.random() > 0.35;
      const customerId = linkCustomer ? pick(customers).id : null;

      const baseOrder: Prisma.OrderCreateInput = {
        id: uuidv4(),
        status,
        source: pick(sources),
        paymentMethod: pick(payMethods),
        paymentStatus,
        fulfillmentType: fType,
        subtotal,
        discountAmount,
        tax,
        deliveryFee,
        total,
        customerName: `Guest ${d}-${o}`,
        customerPhone: `077${Math.floor(1000000 + Math.random() * 9000000)}`,
        placedAt: randomDate,
        kitchenPriority:
          status === OrderStatus.in_kitchen && Math.random() < 0.3 ? 'rush' : 'normal',
        printedAt:
          status === OrderStatus.in_kitchen ||
          status === OrderStatus.ready ||
          status === OrderStatus.in_transit ||
          status === OrderStatus.delivered
            ? new Date(randomDate.getTime() + 8 * 60_000)
            : null,
        readyAt:
          status === OrderStatus.ready ||
          status === OrderStatus.in_transit ||
          status === OrderStatus.delivered
            ? new Date(randomDate.getTime() + 20 * 60_000)
            : null,
        transactionId:
          paymentStatus === PaymentStatus.completed || paymentStatus === PaymentStatus.refunded
            ? `SEED_TXN_${d}_${o}_${Date.now()}`
            : null,
        items: {
          create: lines.map((line) => ({
            id: uuidv4(),
            menuItem: { connect: { id: line.menuItemId } },
            name: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            modifiersJson: line.modifiersJson,
          })),
        },
      };

      if (discountCode) baseOrder.discountCode = discountCode;
      if (customerId) baseOrder.customer = { connect: { id: customerId } };
      if (isDelivery) baseOrder.deliveryAddress = pick(colomboAddresses);
      if (courierId) baseOrder.courier = { connect: { id: courierId } };

      await prisma.order.create({ data: baseOrder });
    }
  }

  console.log('🧪 Creating deterministic active support/queue orders…');
  const supportPhone = '0702839075';
  const supportCustomer = await prisma.customer.create({
    data: {
      id: uuidv4(),
      name: 'Support Demo Customer',
      phone: supportPhone,
      email: 'support.demo@wrapnroll.com',
    },
  });
  const baseItem = seededMenuItems[0]!;
  const fallbackItem = seededMenuItems[1] ?? baseItem;
  const now = new Date();
  const activeSeeds: Array<{
    id: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    fulfillmentType: FulfillmentType;
    paymentMethod: PaymentMethod;
    source: OrderSource;
    kitchenPriority?: 'normal' | 'rush';
    printedAtMins?: number;
    readyAtMins?: number;
    transactionId?: string;
    withDiscount?: boolean;
    withSecondLine?: boolean;
    specialPhone?: string;
    estimatedReadyOffsetMins?: number;
    label: string;
  }> = [
    {
      id: 'f5df7b7b-25b0-423b-8c62-b47a9b2700e1',
      status: OrderStatus.placed,
      paymentStatus: PaymentStatus.pending,
      fulfillmentType: 'takeaway',
      paymentMethod: 'cash',
      source: 'cashier_pos',
      transactionId: 'ON_PICKUP_SEED_0001',
      label: 'Phone support placed',
    },
    {
      id: 'c222a678-25b0-423b-8c62-b47a9b2700e2',
      status: OrderStatus.paid,
      paymentStatus: PaymentStatus.completed,
      fulfillmentType: 'dine_in',
      paymentMethod: 'card',
      source: 'cashier_pos',
      transactionId: 'SEED_CARD_AUTH_0002',
      label: 'Walk-in paid',
    },
    {
      id: '0c05486b-25b0-423b-8c62-b47a9b2700e3',
      status: OrderStatus.in_kitchen,
      paymentStatus: PaymentStatus.completed,
      fulfillmentType: 'takeaway',
      paymentMethod: 'payhere',
      source: 'client_web',
      kitchenPriority: 'rush',
      printedAtMins: 6,
      transactionId: 'SEED_PAYHERE_0003',
      label: 'Kitchen active',
    },
    {
      id: '2cf319ff-25b0-423b-8c62-b47a9b2700e4',
      status: OrderStatus.ready,
      paymentStatus: PaymentStatus.pending,
      fulfillmentType: 'delivery',
      paymentMethod: 'cash',
      source: 'cashier_pos',
      kitchenPriority: 'normal',
      printedAtMins: 7,
      readyAtMins: 21,
      transactionId: 'ON_DELIVERY_SEED_0004',
      label: 'Ready for courier cash',
    },
    {
      id: '2eba4e4d-25b0-423b-8c62-b47a9b2700e5',
      status: OrderStatus.in_transit,
      paymentStatus: PaymentStatus.pending,
      fulfillmentType: 'delivery',
      paymentMethod: 'cash',
      source: 'cashier_pos',
      kitchenPriority: 'rush',
      printedAtMins: 8,
      readyAtMins: 22,
      transactionId: 'ON_DELIVERY_SEED_0005',
      label: 'Out for delivery',
    },
    {
      id: '1f8a0de2-25b0-423b-8c62-b47a9b2700e6',
      status: OrderStatus.delivered,
      paymentStatus: PaymentStatus.completed,
      fulfillmentType: 'delivery',
      paymentMethod: 'online',
      source: 'client_mobile',
      kitchenPriority: 'normal',
      printedAtMins: 6,
      readyAtMins: 18,
      transactionId: 'SEED_ONLINE_0006',
      withSecondLine: true,
      label: 'Delivered online prepaid',
    },
    {
      id: '57f1f08b-25b0-423b-8c62-b47a9b2700e7',
      status: OrderStatus.cancelled,
      paymentStatus: PaymentStatus.failed,
      fulfillmentType: 'delivery',
      paymentMethod: 'payhere',
      source: 'client_web',
      specialPhone: '0702839076',
      label: 'Cancelled payment failed',
    },
    {
      id: 'f2ceaf59-25b0-423b-8c62-b47a9b2700e8',
      status: OrderStatus.voided,
      paymentStatus: PaymentStatus.pending,
      fulfillmentType: 'dine_in',
      paymentMethod: 'cash',
      source: 'cashier_pos_offline',
      specialPhone: '0702839077',
      label: 'Voided cashier offline',
    },
    {
      id: 'f3f42d10-25b0-423b-8c62-b47a9b2700e9',
      status: OrderStatus.refunded,
      paymentStatus: PaymentStatus.refunded,
      fulfillmentType: 'takeaway',
      paymentMethod: 'card',
      source: 'cashier_pos',
      transactionId: 'SEED_REFUND_0009',
      withDiscount: true,
      withSecondLine: true,
      specialPhone: '0702839078',
      label: 'Refunded after settlement',
    },
    {
      id: 'a11c6d77-25b0-423b-8c62-b47a9b2700f0',
      status: OrderStatus.placed,
      paymentStatus: PaymentStatus.failed,
      fulfillmentType: 'delivery',
      paymentMethod: 'payhere',
      source: 'client_web',
      specialPhone: '0702839079',
      estimatedReadyOffsetMins: 40,
      label: 'Placed payment failed retry-needed',
    },
    {
      id: '95bcd7ef-25b0-423b-8c62-b47a9b2700f1',
      status: OrderStatus.placed,
      paymentStatus: PaymentStatus.pending,
      fulfillmentType: 'delivery',
      paymentMethod: 'cash',
      source: 'cashier_pos_offline',
      transactionId: 'ON_DELIVERY_SEED_0011',
      specialPhone: '0702839080',
      estimatedReadyOffsetMins: 35,
      label: 'Phone pay-on-delivery pending (kitchen eligible)',
    },
    {
      id: 'de9e462b-25b0-423b-8c62-b47a9b2700f2',
      status: OrderStatus.placed,
      paymentStatus: PaymentStatus.pending,
      fulfillmentType: 'takeaway',
      paymentMethod: 'cash',
      source: 'cashier_pos_offline',
      transactionId: 'ON_PICKUP_SEED_0012',
      specialPhone: '0702839081',
      estimatedReadyOffsetMins: 20,
      label: 'Phone pay-on-pickup pending',
    },
  ];

  for (let i = 0; i < activeSeeds.length; i++) {
    const s = activeSeeds[i]!;
    const item = i % 2 === 0 ? baseItem : fallbackItem;
    const placedAt = new Date(now.getTime() - (activeSeeds.length - i) * 7 * 60_000);
    const discountAmount = s.withDiscount ? Math.round(item.basePrice * 0.1 * 100) / 100 : 0;
    const secondItem = fallbackItem;
    const secondLineTotal = s.withSecondLine ? secondItem.basePrice : 0;
    const subtotal = item.basePrice + secondLineTotal;
    const taxable = Math.max(0, subtotal - discountAmount);
    const tax = Math.round(taxable * 0.15 * 100) / 100;
    const deliveryFee = s.fulfillmentType === 'delivery' ? 250 : 0;
    const total = taxable + tax + deliveryFee;

    await prisma.order.create({
      data: {
        id: s.id,
        status: s.status,
        source: s.source,
        paymentMethod: s.paymentMethod,
        paymentStatus: s.paymentStatus,
        fulfillmentType: s.fulfillmentType,
        subtotal,
        discountCode: s.withDiscount ? 'LOYAL15' : null,
        discountAmount,
        tax,
        deliveryFee,
        total,
        transactionId: s.transactionId ?? null,
        kitchenPriority: s.kitchenPriority ?? 'normal',
        customer: { connect: { id: supportCustomer.id } },
        customerName: `Support Caller ${i + 1} (${s.label})`,
        customerPhone: s.specialPhone ?? supportPhone,
        placedAt,
        printedAt: s.printedAtMins ? new Date(placedAt.getTime() + s.printedAtMins * 60_000) : null,
        readyAt: s.readyAtMins ? new Date(placedAt.getTime() + s.readyAtMins * 60_000) : null,
        estimatedReadyTime:
          s.estimatedReadyOffsetMins !== undefined
            ? new Date(placedAt.getTime() + s.estimatedReadyOffsetMins * 60_000)
            : s.status === OrderStatus.placed || s.status === OrderStatus.paid
              ? new Date(placedAt.getTime() + 25 * 60_000)
            : null,
        deliveryAddress:
          s.fulfillmentType === 'delivery'
            ? '25 Duplication Road, Colombo 04'
            : null,
        courier:
          s.fulfillmentType === 'delivery'
            ? { connect: { id: couriers[0]!.id } }
            : undefined,
        tableNumber: s.fulfillmentType === 'dine_in' ? `T-${10 + i}` : null,
        items: {
          create: [
            {
              id: uuidv4(),
              menuItem: { connect: { id: item.id } },
              name: item.name,
              quantity: 1,
              unitPrice: item.basePrice,
              lineTotal: item.basePrice,
              modifiersJson: buildSeededLineModifiers(item.modifierGroupsJson) as Prisma.JsonValue,
            },
            ...(s.withSecondLine
              ? [
                  {
                    id: uuidv4(),
                    menuItem: { connect: { id: secondItem.id } },
                    name: secondItem.name,
                    quantity: 1,
                    unitPrice: secondItem.basePrice,
                    lineTotal: secondItem.basePrice,
                    modifiersJson: buildSeededLineModifiers(
                      secondItem.modifierGroupsJson,
                    ) as Prisma.JsonValue,
                  },
                ]
              : []),
          ],
        },
      },
    });
    if (existing.has('PaymentEvent')) {
      await prismaSidecarLoose(prisma).paymentEvent.create({
        data: {
          id: uuidv4(),
          orderId: s.id,
          eventType: 'seed_order_initialized',
          paymentMethod: s.paymentMethod,
          actorRole: 'SYSTEM',
          note: `Seeded support scenario: ${s.label}`,
          metadataJson: {
            supportSeed: true,
            status: s.status,
            paymentStatus: s.paymentStatus,
          },
        },
      });
    }
  }

  console.log(
    `✅ Rich seed done: ${ingredientRows.length} ingredients, ${menuDefs.length} menu items, ${customers.length} customers, couriers + heavy order history.`,
  );

  const customerAuthUsers = await seedAuthUsers();

  for (const authCustomer of customerAuthUsers) {
    const or = [
      { supabaseUserId: authCustomer.supabaseUserId },
      { email: authCustomer.email },
    ] as Prisma.CustomerWhereInput[];
    if (authCustomer.phone) {
      or.push({ phone: authCustomer.phone });
    }
    const existing = await prisma.customer.findFirst({
      where: { OR: or },
    });

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          supabaseUserId: authCustomer.supabaseUserId,
          email: authCustomer.email,
          name: authCustomer.name,
          phone: authCustomer.phone,
        } as Prisma.CustomerUpdateInput,
      });
    } else {
      await prisma.customer.create({
        data: {
          id: uuidv4(),
          supabaseUserId: authCustomer.supabaseUserId,
          email: authCustomer.email,
          name: authCustomer.name,
          phone: authCustomer.phone,
        } as Prisma.CustomerCreateInput,
      });
    }
  }

  await printSeedCoverageReport();
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });

