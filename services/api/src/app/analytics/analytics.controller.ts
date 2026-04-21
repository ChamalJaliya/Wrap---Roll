import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../auth';

@Controller('analytics')
@ApiTags('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales/daily')
  @Roles('ADMIN')
  async getDailySalesReport(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return this.analyticsService.getDailySalesReport(targetDate);
  }

  @Get('sales')
  @Roles('ADMIN')
  async getSalesStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('grouping') grouping: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.analyticsService.getSalesStats(start, end, grouping);
  }

  @Get('margins')
  @Roles('ADMIN')
  async getIngredientCostMargins(@Query('asOf') asOf?: string) {
    const at = asOf ? new Date(asOf) : undefined;
    return this.analyticsService.getIngredientCostMargins(at);
  }

  @Get('margin/gross')
  @Roles('ADMIN')
  async getGrossMarginReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.analyticsService.getGrossMarginReport(start, end);
  }

  @Get('payments/reconciliation')
  @Roles('ADMIN')
  async getPaymentReconciliation(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return this.analyticsService.getPaymentReconciliation(targetDate);
  }

  @Get('pipeline')
  @Roles('ADMIN')
  async getOrderPipeline() {
    return this.analyticsService.getOrderPipeline();
  }

  @Get('top-sellers')
  @Roles('ADMIN')
  async getTopSellers(
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    const top = limit ? parseInt(limit, 10) : 8;
    return this.analyticsService.getTopSellers(targetDate, top);
  }

  /** Actual usage from COGS (post–in_kitchen consumption) — for restock planning */
  @Get('inventory/daily-consumption')
  @Roles('ADMIN')
  async getDailyIngredientConsumption(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate?.trim() || !endDate?.trim()) {
      throw new BadRequestException('startDate and endDate query params are required (YYYY-MM-DD)');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate');
    }
    return this.analyticsService.getDailyIngredientConsumption(start, end);
  }
}
