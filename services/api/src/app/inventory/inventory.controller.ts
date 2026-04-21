import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import {
  CreateIngredientBodyDto,
  CreateOverheadCostEntryBodyDto,
  CreateRestockEntryBodyDto,
  CreateStockAdjustmentBodyDto,
  CreateWasteEntryBodyDto,
  UpdateIngredientBodyDto,
} from '../../openapi/zod-dtos';
import { ListFilterGroup } from '../common/list-filter.util';
import { InventoryService } from './inventory.service';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import type {
  CreateIngredientInput,
  CreateOverheadCostEntryInput,
  CreateRestockEntryInput,
  CreateStockAdjustmentInput,
  CreateWasteEntryInput,
  UpdateIngredientInput,
} from '@wrap-roll/contracts';

@Controller('inventory')
@ApiTags('inventory')
@Roles('ADMIN')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'name' | 'currentStock' | 'lowStockThreshold' | 'costPerUnit' | 'createdAt',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filters') filters?: string | Record<string, unknown>,
  ) {
    let parsedFilters: unknown;
    if (filters) {
      if (typeof filters === 'string') {
        try {
          parsedFilters = JSON.parse(filters);
        } catch {
          parsedFilters = undefined;
        }
      } else if (typeof filters === 'object') {
        parsedFilters = filters;
      }
    }
    return this.inventoryService.getInventory({
      search,
      sortBy,
      sortDir,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      filters: parsedFilters as ListFilterGroup | undefined,
    });
  }

  @Post()
  @ApiBody({ type: CreateIngredientBodyDto })
  async create(@Body() createDto: CreateIngredientInput, @CurrentUser() actor?: RequestUser) {
    return this.inventoryService.createIngredient(createDto, actor!);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateIngredientBodyDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateIngredientInput,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.inventoryService.updateIngredient(id, updateDto, actor!);
  }

  @Post('restock')
  @ApiBody({ type: CreateRestockEntryBodyDto })
  async restock(@Body() payload: CreateRestockEntryInput, @CurrentUser() actor?: RequestUser) {
    return this.inventoryService.restockIngredient(payload, actor!);
  }

  @Post('waste')
  @ApiBody({ type: CreateWasteEntryBodyDto })
  async waste(@Body() payload: CreateWasteEntryInput, @CurrentUser() actor?: RequestUser) {
    return this.inventoryService.recordWaste(payload, actor!);
  }

  @Post('adjust')
  @ApiBody({ type: CreateStockAdjustmentBodyDto })
  async adjust(@Body() payload: CreateStockAdjustmentInput, @CurrentUser() actor?: RequestUser) {
    return this.inventoryService.adjustStock(payload, actor!);
  }

  @Get(':id/movements')
  async getIngredientMovements(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.inventoryService.getIngredientMovements(id, limit ? Number(limit) : undefined);
  }

  @Get(':id/valuations')
  async getIngredientValuations(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.inventoryService.getIngredientValuations(id, limit ? Number(limit) : undefined);
  }

  @Post('overhead')
  @ApiBody({ type: CreateOverheadCostEntryBodyDto })
  async createOverheadEntry(
    @Body() payload: CreateOverheadCostEntryInput,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.inventoryService.createOverheadEntry(payload, actor!);
  }

  @Get('overhead/list')
  async listOverheadEntries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.listOverheadEntries(startDate, endDate);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() actor?: RequestUser) {
    return this.inventoryService.deleteIngredient(id, actor!);
  }
}
