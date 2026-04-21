import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPrismaWhereFromFilters } from '../common/list-filter.util';
import {
  CreateIngredientInputSchema,
  CreateOverheadCostEntryInputSchema,
  CreateRestockEntryInputSchema,
  CreateStockAdjustmentInputSchema,
  CreateWasteEntryInputSchema,
  type OutboxRelayJobPayload,
  UpdateIngredientInputSchema,
} from '@wrap-roll/contracts';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../auth/current-user.decorator';
import { trackOpsActivity } from '../common/ops-activity';
import { INVENTORY_JOB, type InventoryJobName } from './inventory.constants';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  private toDate(value?: string) {
    if (!value) return new Date();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid occurredAt date');
    }
    return date;
  }

  private opsActivitySidecar() {
    return this.prisma as unknown as {
      opsActivityEvent: {
        create(args: {
          data: {
            app: string;
            entityType: string;
            entityId: string;
            eventType: string;
            summary: string;
            metadataJson?: Prisma.InputJsonValue | null;
          };
        }): Promise<unknown>;
      };
    };
  }

  async processQueueJob(
    jobName: InventoryJobName,
    payload: OutboxRelayJobPayload,
    attemptsMade = 0,
  ): Promise<void> {
    const payloadObj =
      payload.payload && typeof payload.payload === 'object'
        ? (payload.payload as Record<string, unknown>)
        : {};
    const embeddedOrderId = String(payloadObj.orderId ?? payloadObj.id ?? '');
    const orderId = String(payload.entityId ?? '').trim() || embeddedOrderId;
    if (!orderId) {
      this.logger.warn(`Received inventory queue job without order id: ${jobName}`);
      return;
    }

    const eventPayload: Record<string, unknown> = {
      ...payloadObj,
      id: orderId,
      orderId,
      correlationId: payload.correlationId ?? null,
      retryAttempt: attemptsMade,
    };

    if (jobName === INVENTORY_JOB.orderInKitchen) {
      await this.handleOrderInKitchen(eventPayload);
      return;
    }

    if (jobName === INVENTORY_JOB.orderReversal) {
      await this.handleOrderReversal(eventPayload);
      return;
    }

    this.logger.warn(`Unsupported inventory queue job: ${jobName}`);
  }

  private async hasConsumedCogsForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<boolean> {
    const consumedCount = await tx.orderCogsLine.count({
      where: {
        orderId,
        qtyConsumed: { gt: new Prisma.Decimal(0) },
      },
    });
    return consumedCount > 0;
  }

  private async hasReversedCogsForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<boolean> {
    const reversedCount = await tx.orderCogsLine.count({
      where: {
        orderId,
        qtyConsumed: { lt: new Prisma.Decimal(0) },
      },
    });
    return reversedCount > 0;
  }

  private async appendMovement(
    tx: Prisma.TransactionClient,
    params: {
      ingredientId: string;
      movementType: 'PURCHASE' | 'CONSUME' | 'WASTE' | 'ADJUSTMENT' | 'RETURN';
      quantityDelta: number;
      unitCost?: number;
      referenceType: 'PURCHASE' | 'ORDER' | 'WASTE' | 'ADJUSTMENT' | 'RETURN' | 'SYSTEM';
      referenceId?: string;
      note?: string;
      occurredAt?: Date;
    },
  ) {
    const ingredient = await tx.ingredient.findUnique({ where: { id: params.ingredientId } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    const qtyDeltaDec = new Prisma.Decimal(params.quantityDelta);
    const currentQtyDec = new Prisma.Decimal(ingredient.currentStock as unknown as Prisma.Decimal.Value);
    const currentAvgDec = new Prisma.Decimal(ingredient.costPerUnit as unknown as Prisma.Decimal.Value);
    const nextQtyDec = currentQtyDec.plus(qtyDeltaDec);
    if (nextQtyDec.lt(0)) {
      throw new BadRequestException(`Insufficient stock for ingredient ${ingredient.name}`);
    }

    let nextAvgDec = currentAvgDec;
    if (params.movementType === 'PURCHASE') {
      if (params.unitCost === undefined) {
        throw new BadRequestException('unitCost is required for purchase movements');
      }
      const purchaseUnitCostDec = new Prisma.Decimal(params.unitCost);
      const currentValueDec = currentQtyDec.mul(currentAvgDec);
      const incomingValueDec = qtyDeltaDec.mul(purchaseUnitCostDec);
      nextAvgDec = nextQtyDec.eq(0)
        ? new Prisma.Decimal(0)
        : currentValueDec.plus(incomingValueDec).div(nextQtyDec);
    } else if (nextQtyDec.eq(0)) {
      nextAvgDec = new Prisma.Decimal(0);
    }

    const effectiveUnitCostDec =
      params.unitCost !== undefined ? new Prisma.Decimal(params.unitCost) : currentAvgDec;
    const totalValueDeltaDec = qtyDeltaDec.mul(effectiveUnitCostDec);

    const updatedIngredient = await tx.ingredient.update({
      where: { id: ingredient.id },
      data: {
        currentStock: nextQtyDec,
        costPerUnit: nextAvgDec,
      },
    });

    const occurredAt = params.occurredAt ?? new Date();
    const movement = await tx.inventoryMovement.create({
      data: {
        ingredientId: ingredient.id,
        movementType: params.movementType,
        quantityDelta: qtyDeltaDec,
        unitCost: params.unitCost,
        totalValueDelta: totalValueDeltaDec,
        resultingQty: nextQtyDec,
        resultingAvgCost: nextAvgDec,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        note: params.note,
        occurredAt,
      },
    });

    await tx.ingredientValuationSnapshot.create({
      data: {
        ingredientId: ingredient.id,
        avgUnitCost: nextAvgDec,
        onHandQty: nextQtyDec,
        inventoryValue: nextQtyDec.mul(nextAvgDec),
        asOf: occurredAt,
      },
    });

    if (Number(updatedIngredient.currentStock) <= Number(updatedIngredient.lowStockThreshold)) {
      this.logger.warn(`Low stock alert for ingredient: ${updatedIngredient.name}`);
    }

    return movement;
  }

  /**
   * Consume inventory when the order enters the kitchen — physical prep commitment.
   * Payment timing (order.paid / COD) is separate from stock deduction.
   */
  async handleOrderInKitchen(payload: unknown) {
    const eventPayload =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const orderId = String(
      eventPayload.orderId ?? (typeof eventPayload.id === 'string' ? eventPayload.id : '') ?? '',
    );
    if (!orderId) {
      this.logger.warn('Received order.in_kitchen event without orderId');
      return;
    }

    this.logger.log(`Processing inventory auto-deduction for order (in_kitchen): ${orderId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await this.hasConsumedCogsForOrder(tx, orderId)) {
          this.logger.warn(`Inventory consume already applied for order ${orderId}; skipping duplicate.`);
          return;
        }

        // Fetch order with items
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (!order || !order.items || order.items.length === 0) {
          this.logger.warn(`Order ${orderId} not found or has no items`);
          return;
        }

        const menuItemIds = [...new Set(order.items.map((i) => i.menuItemId))];
        const optionDeltaRows = await tx.menuModifierOptionIngredientDelta.findMany({
          where: { menuItemId: { in: menuItemIds } },
          select: { menuItemId: true, optionId: true, ingredientId: true, quantityDelta: true },
        });
        const deltasByMenuItemAndOption = new Map<
          string,
          Array<{ ingredientId: string; quantityDelta: Prisma.Decimal }>
        >();
        for (const row of optionDeltaRows) {
          const key = `${row.menuItemId}::${row.optionId}`;
          const list = deltasByMenuItemAndOption.get(key) ?? [];
          list.push({ ingredientId: row.ingredientId, quantityDelta: row.quantityDelta });
          deltasByMenuItemAndOption.set(key, list);
        }

        // For each item, look up RecipeIngredient and deduct (+ modifier deltas)
        for (const item of order.items) {
          const recipes = await tx.recipeIngredient.findMany({
            where: { menuItemId: item.menuItemId },
          });

          for (const recipe of recipes) {
            const deductionAmount = Number(recipe.quantityUsed) * item.quantity;
            const ingredientBefore = await tx.ingredient.findUnique({
              where: { id: recipe.ingredientId },
              select: { costPerUnit: true },
            });
            const unitCostAtSale = Number(ingredientBefore?.costPerUnit ?? 0);
            await this.appendMovement(tx, {
              ingredientId: recipe.ingredientId,
              movementType: 'CONSUME',
              quantityDelta: -deductionAmount,
              referenceType: 'ORDER',
              referenceId: order.id,
              note: `Auto consume for order ${order.id}`,
              occurredAt: new Date(order.updatedAt),
            });
            await tx.orderCogsLine.create({
              data: {
                orderId: order.id,
                menuItemId: item.menuItemId,
                ingredientId: recipe.ingredientId,
                qtyConsumed: deductionAmount,
                unitCostAtSale,
                lineCost: deductionAmount * unitCostAtSale,
                occurredAt: new Date(order.updatedAt),
              },
            });
          }

          const modifiers = item.modifiersJson as unknown;
          const selectedOptionIds = new Set<string>();
          if (Array.isArray(modifiers)) {
            for (const group of modifiers) {
              const opts = Array.isArray(group?.options) ? group.options : [];
              for (const opt of opts) {
                if (typeof opt?.optionId === 'string' && opt.optionId) selectedOptionIds.add(opt.optionId);
              }
            }
          }

          if (selectedOptionIds.size > 0) {
            const extraByIngredient = new Map<string, Prisma.Decimal>();
            for (const optionId of selectedOptionIds) {
              const rows = deltasByMenuItemAndOption.get(`${item.menuItemId}::${optionId}`) ?? [];
              for (const row of rows) {
                const current = extraByIngredient.get(row.ingredientId) ?? new Prisma.Decimal(0);
                extraByIngredient.set(row.ingredientId, current.add(row.quantityDelta));
              }
            }

            for (const [ingredientId, perUnitExtra] of extraByIngredient.entries()) {
              if (perUnitExtra.isZero()) continue;
              const totalExtra = perUnitExtra.mul(new Prisma.Decimal(item.quantity));
              const ingredientBefore = await tx.ingredient.findUnique({
                where: { id: ingredientId },
                select: { costPerUnit: true },
              });
              const unitCostAtSale = Number(ingredientBefore?.costPerUnit ?? 0);
              await this.appendMovement(tx, {
                ingredientId,
                movementType: 'CONSUME',
                quantityDelta: -Number(totalExtra),
                referenceType: 'ORDER',
                referenceId: order.id,
                note: `Auto consume (modifier) for order ${order.id}`,
                occurredAt: new Date(order.updatedAt),
              });
              await tx.orderCogsLine.create({
                data: {
                  orderId: order.id,
                  menuItemId: item.menuItemId,
                  ingredientId,
                  qtyConsumed: Number(totalExtra),
                  unitCostAtSale,
                  lineCost: Number(totalExtra) * unitCostAtSale,
                  occurredAt: new Date(order.updatedAt),
                },
              });
            }
          }
        }
      });
      this.logger.log(`Inventory auto-deduction successful for order: ${orderId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const retryAttempt = Number(eventPayload.retryAttempt ?? 0);
      const correlationId =
        eventPayload.correlationId == null ? null : String(eventPayload.correlationId);
      await this.opsActivitySidecar().opsActivityEvent.create({
        data: {
          app: 'system',
          entityType: 'order',
          entityId: orderId,
          eventType: 'inventory.async_handler_failed',
          summary: 'Inventory consume handler failed',
          metadataJson: {
            handler: 'inventory.handleOrderInKitchen',
            retryAttempt,
            deadLettered: retryAttempt >= 3,
            correlationId,
            error: message,
          },
        },
      });
      this.logger.error(`Failed to deduct inventory for order ${orderId}: ${message}`);
    }
  }

  async handleOrderReversal(payload: unknown) {
    const eventPayload =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const orderId = String(eventPayload.id ?? '');
    if (!orderId) {
      this.logger.warn('Received order reversal event without order id');
      return;
    }

    this.logger.log(`Processing inventory auto-reversal for order: ${orderId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await this.hasReversedCogsForOrder(tx, orderId)) {
          this.logger.warn(`Inventory reversal already applied for order ${orderId}; skipping duplicate.`);
          return;
        }

        if (!(await this.hasConsumedCogsForOrder(tx, orderId))) {
          this.logger.warn(
            `No inventory consume recorded for order ${orderId} (e.g. void/cancel before kitchen); skipping reversal.`,
          );
          return;
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (!order || !order.items || order.items.length === 0) {
          this.logger.warn(`Order ${orderId} not found or has no items`);
          return;
        }

        const menuItemIds = [...new Set(order.items.map((i) => i.menuItemId))];
        const optionDeltaRows = await tx.menuModifierOptionIngredientDelta.findMany({
          where: { menuItemId: { in: menuItemIds } },
          select: { menuItemId: true, optionId: true, ingredientId: true, quantityDelta: true },
        });
        const deltasByMenuItemAndOption = new Map<
          string,
          Array<{ ingredientId: string; quantityDelta: Prisma.Decimal }>
        >();
        for (const row of optionDeltaRows) {
          const key = `${row.menuItemId}::${row.optionId}`;
          const list = deltasByMenuItemAndOption.get(key) ?? [];
          list.push({ ingredientId: row.ingredientId, quantityDelta: row.quantityDelta });
          deltasByMenuItemAndOption.set(key, list);
        }

        // For each item, look up RecipeIngredient and increment stock back (+ modifier deltas)
        for (const item of order.items) {
          const recipes = await tx.recipeIngredient.findMany({
            where: { menuItemId: item.menuItemId },
          });

          for (const recipe of recipes) {
            const reversalAmount = Number(recipe.quantityUsed) * item.quantity;
            const cogsRef = await tx.orderCogsLine.findFirst({
              where: {
                orderId: order.id,
                menuItemId: item.menuItemId,
                ingredientId: recipe.ingredientId,
              },
              orderBy: { createdAt: 'asc' },
            });
            const unitCostAtSale = Number(cogsRef?.unitCostAtSale ?? 0);
            await this.appendMovement(tx, {
              ingredientId: recipe.ingredientId,
              movementType: 'RETURN',
              quantityDelta: reversalAmount,
              referenceType: 'ORDER',
              referenceId: order.id,
              note: `Auto return for ${String(eventPayload.status ?? 'reversal')} order ${order.id}`,
              occurredAt: new Date(order.updatedAt),
            });
            await tx.orderCogsLine.create({
              data: {
                orderId: order.id,
                menuItemId: item.menuItemId,
                ingredientId: recipe.ingredientId,
                qtyConsumed: -reversalAmount,
                unitCostAtSale,
                lineCost: -reversalAmount * unitCostAtSale,
                occurredAt: new Date(order.updatedAt),
              },
            });
          }

          const modifiers = item.modifiersJson as unknown;
          const selectedOptionIds = new Set<string>();
          if (Array.isArray(modifiers)) {
            for (const group of modifiers) {
              const opts = Array.isArray(group?.options) ? group.options : [];
              for (const opt of opts) {
                if (typeof opt?.optionId === 'string' && opt.optionId) selectedOptionIds.add(opt.optionId);
              }
            }
          }

          if (selectedOptionIds.size > 0) {
            const extraByIngredient = new Map<string, Prisma.Decimal>();
            for (const optionId of selectedOptionIds) {
              const rows = deltasByMenuItemAndOption.get(`${item.menuItemId}::${optionId}`) ?? [];
              for (const row of rows) {
                const current = extraByIngredient.get(row.ingredientId) ?? new Prisma.Decimal(0);
                extraByIngredient.set(row.ingredientId, current.add(row.quantityDelta));
              }
            }

            for (const [ingredientId, perUnitExtra] of extraByIngredient.entries()) {
              if (perUnitExtra.isZero()) continue;
              const totalExtra = perUnitExtra.mul(new Prisma.Decimal(item.quantity));
              const cogsRef = await tx.orderCogsLine.findFirst({
                where: {
                  orderId: order.id,
                  menuItemId: item.menuItemId,
                  ingredientId,
                },
                orderBy: { createdAt: 'asc' },
              });
              const unitCostAtSale = Number(cogsRef?.unitCostAtSale ?? 0);
              await this.appendMovement(tx, {
                ingredientId,
                movementType: 'RETURN',
                quantityDelta: Number(totalExtra),
                referenceType: 'ORDER',
                referenceId: order.id,
                note: `Auto return (modifier) for ${String(eventPayload.status ?? 'reversal')} order ${order.id}`,
                occurredAt: new Date(order.updatedAt),
              });
              await tx.orderCogsLine.create({
                data: {
                  orderId: order.id,
                  menuItemId: item.menuItemId,
                  ingredientId,
                  qtyConsumed: -Number(totalExtra),
                  unitCostAtSale,
                  lineCost: -Number(totalExtra) * unitCostAtSale,
                  occurredAt: new Date(order.updatedAt),
                },
              });
            }
          }
        }
      });
      this.logger.log(`Inventory auto-reversal successful for order: ${orderId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const retryAttempt = Number(eventPayload.retryAttempt ?? 0);
      const correlationId =
        eventPayload.correlationId == null ? null : String(eventPayload.correlationId);
      await this.opsActivitySidecar().opsActivityEvent.create({
        data: {
          app: 'system',
          entityType: 'order',
          entityId: orderId,
          eventType: 'inventory.async_handler_failed',
          summary: 'Inventory reversal handler failed',
          metadataJson: {
            handler: 'inventory.handleOrderReversal',
            retryAttempt,
            deadLettered: retryAttempt >= 3,
            correlationId,
            error: message,
          },
        },
      });
      this.logger.error(`Failed to reverse inventory for order ${orderId}: ${message}`);
    }
  }

  async getInventory(query?: {
    search?: string;
    sortBy?: 'name' | 'currentStock' | 'lowStockThreshold' | 'costPerUnit' | 'createdAt';
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    filters?: {
      logic?: 'AND' | 'OR';
      rules?: Array<{
        field: string;
        op: string;
        value?: string | number | boolean;
        valueTo?: string | number;
      }>;
    };
  }) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const compiledFilters = buildPrismaWhereFromFilters(query?.filters, {
      name: { kind: 'string', caseInsensitive: true },
      currentStock: { kind: 'number' },
      lowStockThreshold: { kind: 'number' },
      unit: { kind: 'string', caseInsensitive: true },
      costPerUnit: { kind: 'number' },
      createdAt: { kind: 'date' },
    });
    Object.assign(where, compiledFilters);

    const ingredientSortFields = [
      'name',
      'currentStock',
      'lowStockThreshold',
      'costPerUnit',
      'createdAt',
    ] as const;
    type IngredientSortField = (typeof ingredientSortFields)[number];
    const sortKey = query?.sortBy;
    const orderBy: Prisma.IngredientOrderByWithRelationInput =
      sortKey && (ingredientSortFields as readonly string[]).includes(sortKey)
        ? { [sortKey as IngredientSortField]: query.sortDir ?? 'asc' }
        : { createdAt: 'desc' };
    const [items, total] = await Promise.all([
      this.prisma.ingredient.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.ingredient.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async createIngredient(data: unknown, actor: RequestUser) {
    const parsed = CreateIngredientInputSchema.parse(data);
    if (parsed.lowStockThreshold > parsed.currentStock) {
      throw new BadRequestException('Low stock threshold cannot be greater than current stock');
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({
        data: {
          name: parsed.name,
          unit: parsed.unit,
          lowStockThreshold: parsed.lowStockThreshold,
          currentStock: 0,
          costPerUnit: 0,
        },
      });

      if (parsed.currentStock > 0) {
        await this.appendMovement(tx, {
          ingredientId: ingredient.id,
          movementType: 'PURCHASE',
          quantityDelta: parsed.currentStock,
          unitCost: parsed.costPerUnit,
          referenceType: 'SYSTEM',
          note: 'Initial stock at creation',
        });
      }

      return tx.ingredient.findUnique({ where: { id: ingredient.id } });
    });
    if (created) {
      await trackOpsActivity(this.prisma, {
        entityType: 'inventory_ingredient',
        entityId: created.id,
        eventType: 'inventory.ingredient_created',
        summary: `Ingredient created: ${created.name}`,
        actor,
        metadataJson: {
          unit: created.unit,
          lowStockThreshold: Number(created.lowStockThreshold),
        },
      });
    }
    return created;
  }

  async updateIngredient(id: string, data: unknown, actor: RequestUser) {
    const parsed = UpdateIngredientInputSchema.parse(data);
    if (parsed.currentStock !== undefined || parsed.costPerUnit !== undefined) {
      throw new BadRequestException(
        'Direct stock/cost updates are not allowed. Use restock, waste, or adjust operations.',
      );
    }
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.unit !== undefined ? { unit: parsed.unit } : {}),
        ...(parsed.lowStockThreshold !== undefined ? { lowStockThreshold: parsed.lowStockThreshold } : {}),
      },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'inventory_ingredient',
      entityId: updated.id,
      eventType: 'inventory.ingredient_updated',
      summary: `Ingredient updated: ${updated.name}`,
      actor,
      metadataJson: {
        changed: Object.keys(parsed),
      },
    });
    return updated;
  }

  async restockIngredient(data: unknown, actor: RequestUser) {
    const parsed = CreateRestockEntryInputSchema.parse(data);
    const occurredAt = this.toDate(parsed.occurredAt);
    const movement = await this.prisma.$transaction((tx) =>
      this.appendMovement(tx, {
        ingredientId: parsed.ingredientId,
        movementType: 'PURCHASE',
        quantityDelta: parsed.quantity,
        unitCost: parsed.unitCost,
        referenceType: 'PURCHASE',
        note: parsed.note,
        occurredAt,
      }),
    );
    await trackOpsActivity(this.prisma, {
      entityType: 'inventory_ingredient',
      entityId: movement.ingredientId,
      eventType: 'inventory.restock',
      summary: 'Ingredient restocked',
      actor,
      metadataJson: {
        quantityDelta: Number(movement.quantityDelta),
      },
    });
    return movement;
  }

  async recordWaste(data: unknown, actor: RequestUser) {
    const parsed = CreateWasteEntryInputSchema.parse(data);
    const occurredAt = this.toDate(parsed.occurredAt);
    const movement = await this.prisma.$transaction((tx) =>
      this.appendMovement(tx, {
        ingredientId: parsed.ingredientId,
        movementType: 'WASTE',
        quantityDelta: -parsed.quantity,
        referenceType: 'WASTE',
        note: parsed.note,
        occurredAt,
      }),
    );
    await trackOpsActivity(this.prisma, {
      entityType: 'inventory_ingredient',
      entityId: movement.ingredientId,
      eventType: 'inventory.waste_recorded',
      summary: 'Ingredient waste recorded',
      actor,
      metadataJson: {
        quantityDelta: Number(movement.quantityDelta),
      },
    });
    return movement;
  }

  async adjustStock(data: unknown, actor: RequestUser) {
    const parsed = CreateStockAdjustmentInputSchema.parse(data);
    const occurredAt = this.toDate(parsed.occurredAt);
    const movement = await this.prisma.$transaction((tx) =>
      this.appendMovement(tx, {
        ingredientId: parsed.ingredientId,
        movementType: 'ADJUSTMENT',
        quantityDelta: parsed.quantityDelta,
        referenceType: 'ADJUSTMENT',
        note: parsed.note,
        occurredAt,
      }),
    );
    await trackOpsActivity(this.prisma, {
      entityType: 'inventory_ingredient',
      entityId: movement.ingredientId,
      eventType: 'inventory.stock_adjusted',
      summary: 'Ingredient stock adjusted',
      actor,
      metadataJson: {
        quantityDelta: Number(movement.quantityDelta),
      },
    });
    return movement;
  }

  async getIngredientMovements(ingredientId: string, limit = 50) {
    return this.prisma.inventoryMovement.findMany({
      where: { ingredientId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  async getIngredientValuations(ingredientId: string, limit = 50) {
    return this.prisma.ingredientValuationSnapshot.findMany({
      where: { ingredientId },
      orderBy: [{ asOf: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  async createOverheadEntry(data: unknown, actor: RequestUser) {
    const parsed = CreateOverheadCostEntryInputSchema.parse(data);
    const periodStart = this.toDate(parsed.periodStart);
    const periodEnd = this.toDate(parsed.periodEnd);
    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    const created = await this.prisma.overheadCostEntry.create({
      data: {
        costType: parsed.costType,
        amount: parsed.amount,
        periodStart,
        periodEnd,
        allocationScope: parsed.allocationScope,
        note: parsed.note,
      },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'inventory_overhead',
      entityId: created.id,
      eventType: 'inventory.overhead_created',
      summary: `Overhead entry added (${created.costType})`,
      actor,
      metadataJson: {
        amount: Number(created.amount),
        allocationScope: created.allocationScope,
      },
    });
    return created;
  }

  async listOverheadEntries(startDate?: string, endDate?: string) {
    const start = startDate ? this.toDate(startDate) : undefined;
    const end = endDate ? this.toDate(endDate) : undefined;
    return this.prisma.overheadCostEntry.findMany({
      where: {
        ...(start || end
          ? {
              AND: [
                ...(end ? [{ periodStart: { lte: end } }] : []),
                ...(start ? [{ periodEnd: { gte: start } }] : []),
              ],
            }
          : {}),
      },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async deleteIngredient(id: string, actor: RequestUser) {
    const existing = await this.prisma.ingredient.findUnique({ where: { id } });
    const deleted = await this.prisma.ingredient.delete({ where: { id } });
    await trackOpsActivity(this.prisma, {
      entityType: 'inventory_ingredient',
      entityId: deleted.id,
      eventType: 'inventory.ingredient_deleted',
      summary: `Ingredient deleted: ${deleted.name}`,
      actor,
      metadataJson: {
        existedBeforeDelete: Boolean(existing),
      },
    });
    return deleted;
  }
}
