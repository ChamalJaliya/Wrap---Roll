import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderSource } from '@prisma/client';
import { computePeriodOverlapRatio } from '../inventory/inventory-costing.util';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private normalizeDateRange(startDate?: Date, endDate?: Date) {
    if (!startDate || !endDate) return undefined;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async getDailySalesReport(date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        placedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        paymentStatus: 'completed',
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const avgTicketSize = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const sourceBreakdown = {
      web: orders.filter((o) => o.source === OrderSource.client_web || o.source === OrderSource.client_mobile).length,
      pos: orders.filter((o) => o.source === OrderSource.cashier_pos || o.source === OrderSource.cashier_pos_offline).length,
      delivery: orders.filter((o) => o.fulfillmentType === 'delivery').length,
    };

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalOrders,
      totalRevenue,
      avgTicketSize: Number(avgTicketSize.toFixed(2)),
      sourceBreakdown,
    };
  }

  async getSalesStats(startDate: Date, endDate: Date, grouping: 'daily' | 'weekly' | 'monthly') {
    const orders = await this.prisma.order.findMany({
      where: {
        placedAt: {
          gte: startDate,
          lte: endDate,
        },
        paymentStatus: 'completed',
      },
      orderBy: { placedAt: 'asc' },
    });

    const statsMap = new Map<string, { revenue: number; volume: number }>();

    for (const order of orders) {
      let key: string;
      const date = new Date(order.placedAt);
      
      if (grouping === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (grouping === 'weekly') {
        // Simple week key: YYYY-WW
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
      } else {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      const existing = statsMap.get(key) || { revenue: 0, volume: 0 };
      existing.revenue += Number(order.total);
      existing.volume += 1;
      statsMap.set(key, existing);
    }

    return Array.from(statsMap.entries()).map(([label, value]) => ({
      label,
      revenue: Number(value.revenue.toFixed(2)),
      volume: value.volume,
    }));
  }

  async getIngredientCostMargins(asOf?: Date) {
    const at = asOf ?? new Date();
    const menuItems = await this.prisma.menuItem.findMany({
      where: { isActive: true },
      include: {
        recipes: {
          include: {
            ingredient: true,
          },
        },
      },
    });
    const categoryIds = Array.from(new Set(menuItems.map((item) => item.categoryId as string)));
    const categories = await this.prisma.menuCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const ingredientIds = Array.from(
      new Set(
        menuItems.flatMap((item) => item.recipes.map((recipe) => recipe.ingredientId)),
      ),
    );
    const valuationRows = await this.prisma.ingredientValuationSnapshot.findMany({
      where: {
        ingredientId: { in: ingredientIds },
        asOf: { lte: at },
      },
      orderBy: [{ ingredientId: 'asc' }, { asOf: 'desc' }],
    });
    const valuationMap = new Map<string, number>();
    for (const row of valuationRows) {
      if (!valuationMap.has(row.ingredientId)) {
        valuationMap.set(row.ingredientId, Number(row.avgUnitCost));
      }
    }

    const marginReports = menuItems.map((item) => {
      let totalCost = 0;
      for (const recipe of item.recipes) {
        const unitCost = valuationMap.get(recipe.ingredientId) ?? Number(recipe.ingredient.costPerUnit);
        totalCost += Number(recipe.quantityUsed) * unitCost;
      }

      const basePrice = Number(item.basePrice);
      const grossMargin = basePrice - totalCost;
      const foodCostPercentage = basePrice > 0 ? (totalCost / basePrice) * 100 : 0;

      return {
        itemId: item.id,
        name: item.name,
        category: categoryMap.get(item.categoryId) ?? '',
        basePrice,
        theoreticalCost: Number(totalCost.toFixed(2)),
        grossMargin: Number(grossMargin.toFixed(2)),
        foodCostPercentage: Number(foodCostPercentage.toFixed(2)),
      };
    });

    // Sort by margin to identify high-performance items
    return marginReports.sort((a, b) => b.grossMargin - a.grossMargin);
  }

  async getGrossMarginReport(startDate?: Date, endDate?: Date) {
    const normalized = this.normalizeDateRange(startDate, endDate);
    const orderWhere: any = { paymentStatus: 'completed' };
    if (normalized) {
      orderWhere.placedAt = { gte: normalized.start, lte: normalized.end };
    }

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      select: { id: true, total: true },
    });
    let totalRevenue = 0;
    for (const order of orders) {
      totalRevenue += Number(order.total);
    }

    const cogsWhere: any = {};
    if (normalized) cogsWhere.occurredAt = { gte: normalized.start, lte: normalized.end };
    const cogsAgg = await this.prisma.orderCogsLine.aggregate({
      where: cogsWhere,
      _sum: { lineCost: true },
    });
    const totalCOGS = Number(cogsAgg._sum.lineCost ?? 0);

    const overheadEntries = await this.prisma.overheadCostEntry.findMany({
      where: normalized
        ? {
            AND: [
              { periodStart: { lte: normalized.end } },
              { periodEnd: { gte: normalized.start } },
            ],
          }
        : undefined,
    });

    const overheadByTypeMap = new Map<string, number>();
    let totalOverhead = 0;
    for (const entry of overheadEntries) {
      const fullAmount = Number(entry.amount);
      const amount =
        normalized
          ? fullAmount *
            computePeriodOverlapRatio(normalized.start, normalized.end, entry.periodStart, entry.periodEnd)
          : fullAmount;
      totalOverhead += amount;
      overheadByTypeMap.set(entry.costType, (overheadByTypeMap.get(entry.costType) ?? 0) + amount);
    }

    const wasteWhere: any = { movementType: 'WASTE' };
    if (normalized) wasteWhere.occurredAt = { gte: normalized.start, lte: normalized.end };
    const wasteAgg = await this.prisma.inventoryMovement.aggregate({
      where: wasteWhere,
      _sum: { quantityDelta: true, totalValueDelta: true },
    });
    const wasteQuantity = Math.abs(Number(wasteAgg._sum.quantityDelta ?? 0));
    const wasteValue = Math.abs(Number(wasteAgg._sum.totalValueDelta ?? 0));

    const grossMargin = totalRevenue - totalCOGS;
    const contributionMargin = totalRevenue - totalCOGS - totalOverhead;
    const grossMarginPercentage = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
    const contributionMarginPercentage =
      totalRevenue > 0 ? (contributionMargin / totalRevenue) * 100 : 0;

    return {
      startDate: normalized?.start?.toISOString(),
      endDate: normalized?.end?.toISOString(),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCOGS: Number(totalCOGS.toFixed(2)),
      totalOverhead: Number(totalOverhead.toFixed(2)),
      grossMargin: Number(grossMargin.toFixed(2)),
      contributionMargin: Number(contributionMargin.toFixed(2)),
      grossMarginPercentage: Number(grossMarginPercentage.toFixed(2)),
      contributionMarginPercentage: Number(contributionMarginPercentage.toFixed(2)),
      overheadByType: Array.from(overheadByTypeMap.entries()).map(([costType, amount]) => ({
        costType,
        amount: Number(amount.toFixed(2)),
      })),
      wasteImpact: {
        quantity: Number(wasteQuantity.toFixed(2)),
        estimatedValue: Number(wasteValue.toFixed(2)),
      },
    };
  }

  async getPaymentReconciliation(date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        placedAt: { gte: startOfDay, lte: endOfDay },
      },
      select: {
        id: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    });

    const events = await this.prisma.paymentEvent.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        eventType: 'cash_collected',
      },
      select: {
        orderId: true,
        actorRole: true,
      },
    });

    const cardEventsRaw = await this.prisma.paymentEvent.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        eventType: 'card_collected',
      },
      include: {
        order: { select: { total: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const cashOrders = orders.filter((o) => o.paymentMethod === 'cash');
    const cashPending = cashOrders.filter((o) => o.paymentStatus !== 'completed');
    const cashCompleted = cashOrders.filter((o) => o.paymentStatus === 'completed');
    const byOrder = new Map(events.map((e) => [e.orderId, e.actorRole]));
    const byRole = { pos: 0, rider: 0 };
    let expectedCash = 0;
    let collectedCash = 0;
    for (const o of cashOrders) expectedCash += Number(o.total);
    for (const o of cashCompleted) {
      collectedCash += Number(o.total);
      const role = String(byOrder.get(o.id) ?? '').toUpperCase();
      if (role === 'COURIER') byRole.rider += Number(o.total);
      if (role === 'CASHIER' || role === 'ADMIN') byRole.pos += Number(o.total);
    }

    let cardTotalLkr = 0;
    const card_collection = {
      count: cardEventsRaw.length,
      total_lkr: 0,
      events: cardEventsRaw.map((e) => {
        const amt = Number(e.order?.total ?? 0);
        cardTotalLkr += amt;
        return {
          order_id: e.orderId,
          amount_lkr: Number(amt.toFixed(2)),
          actor_role: e.actorRole ?? null,
          actor_user_id: e.actorUserId ?? null,
          note: e.note ?? null,
          recorded_at: e.createdAt.toISOString(),
        };
      }),
    };
    card_collection.total_lkr = Number(cardTotalLkr.toFixed(2));

    return {
      date: startOfDay.toISOString().split('T')[0],
      cash_pending_count: cashPending.length,
      cash_pending_amount: Number(
        cashPending.reduce((s, o) => s + Number(o.total), 0).toFixed(2),
      ),
      cash_collected_by_pos: Number(byRole.pos.toFixed(2)),
      cash_collected_by_rider: Number(byRole.rider.toFixed(2)),
      expected_cash_total: Number(expectedCash.toFixed(2)),
      collected_cash_total: Number(collectedCash.toFixed(2)),
      variance: Number((expectedCash - collectedCash).toFixed(2)),
      card_collection,
    };
  }

  async getOrderPipeline() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        placedAt: { gte: startOfDay, lte: endOfDay },
      },
      _count: { id: true },
    });

    // Normalise into a flat map so the frontend doesn't need to iterate arrays
    const pipelineMap: Record<string, number> = {};
    for (const row of grouped) {
      pipelineMap[row.status] = row._count.id;
    }

    const allStatuses = ['placed', 'paid', 'in_kitchen', 'ready', 'in_transit', 'delivered', 'cancelled', 'voided', 'refunded'];
    const pipeline = allStatuses.map((status) => ({
      status,
      count: pipelineMap[status] ?? 0,
    }));

    const totalToday = grouped.reduce((sum, r) => sum + r._count.id, 0);
    const revenueToday = await this.prisma.order.aggregate({
      where: {
        placedAt: { gte: startOfDay, lte: endOfDay },
        paymentStatus: 'completed',
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const totalRevenue = Number(revenueToday._sum.total ?? 0);
    const paidCount = revenueToday._count.id;
    const avgTicket = paidCount > 0 ? totalRevenue / paidCount : 0;

    return {
      date: startOfDay.toISOString().split('T')[0],
      pipeline,
      totals: {
        totalToday,
        revenueToday: Number(totalRevenue.toFixed(2)),
        paidOrdersToday: paidCount,
        avgTicket: Number(avgTicket.toFixed(2)),
      },
    };
  }

  /**
   * Actual ingredient usage from COGS lines (when kitchen consumed stock), grouped by calendar day.
   * Use `totalsByIngredient` for restock planning over the selected range.
   */
  async getDailyIngredientConsumption(startDate: Date, endDate: Date) {
    const normalized = this.normalizeDateRange(startDate, endDate);
    if (!normalized) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const lines = await this.prisma.orderCogsLine.findMany({
      where: {
        occurredAt: { gte: normalized.start, lte: normalized.end },
        qtyConsumed: { gt: 0 },
      },
      select: {
        occurredAt: true,
        qtyConsumed: true,
        lineCost: true,
        ingredientId: true,
        ingredient: { select: { name: true, unit: true } },
      },
    });

    type Agg = {
      day: string;
      ingredientId: string;
      name: string;
      unit: string;
      qtyConsumed: number;
      lineCost: number;
    };
    const dailyMap = new Map<string, Agg>();
    const totalsMap = new Map<
      string,
      { ingredientId: string; name: string; unit: string; qtyConsumed: number; lineCost: number }
    >();

    for (const line of lines) {
      const day = line.occurredAt.toISOString().slice(0, 10);
      const name = line.ingredient?.name ?? 'Unknown';
      const unit = String(line.ingredient?.unit ?? '');
      const qty = Number(line.qtyConsumed);
      const cost = Number(line.lineCost);
      const dk = `${day}|||${line.ingredientId}`;
      const existing = dailyMap.get(dk);
      if (existing) {
        existing.qtyConsumed += qty;
        existing.lineCost += cost;
      } else {
        dailyMap.set(dk, {
          day,
          ingredientId: line.ingredientId,
          name,
          unit,
          qtyConsumed: qty,
          lineCost: cost,
        });
      }
      const t = totalsMap.get(line.ingredientId);
      if (t) {
        t.qtyConsumed += qty;
        t.lineCost += cost;
      } else {
        totalsMap.set(line.ingredientId, {
          ingredientId: line.ingredientId,
          name,
          unit,
          qtyConsumed: qty,
          lineCost: cost,
        });
      }
    }

    const daily = Array.from(dailyMap.values())
      .map((r) => ({
        ...r,
        qtyConsumed: Number(r.qtyConsumed.toFixed(4)),
        lineCost: Number(r.lineCost.toFixed(2)),
      }))
      .sort((a, b) => a.day.localeCompare(b.day) || a.name.localeCompare(b.name));

    const totalsByIngredient = Array.from(totalsMap.values())
      .map((r) => ({
        ...r,
        qtyConsumed: Number(r.qtyConsumed.toFixed(4)),
        lineCost: Number(r.lineCost.toFixed(2)),
      }))
      .sort((a, b) => b.qtyConsumed - a.qtyConsumed);

    return {
      startDate: normalized.start.toISOString(),
      endDate: normalized.end.toISOString(),
      daily,
      totalsByIngredient,
    };
  }

  async getTopSellers(date: Date = new Date(), limit = 8) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Aggregate qty sold per menu item for orders that were paid today
    const aggregated = await this.prisma.orderItem.groupBy({
      by: ['menuItemId', 'name'],
      where: {
        order: {
          placedAt: { gte: startOfDay, lte: endOfDay },
          paymentStatus: 'completed',
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return aggregated.map((row, idx) => ({
      rank: idx + 1,
      menuItemId: row.menuItemId,
      name: row.name,
      qtySold: row._sum.quantity ?? 0,
      revenue: Number((row._sum.lineTotal ?? 0).toFixed(2)),
    }));
  }
}
