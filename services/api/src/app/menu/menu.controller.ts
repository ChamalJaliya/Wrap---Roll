import { Controller, Get, Param, Post, Body, Patch, Delete, Query, Put } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import {
  CreateMenuItemBodyDto,
  MenuCategoryBodyDto,
  MenuRecipeLineBodyDto,
  ReplaceModifierDeltasBodyDto,
  UpdateMenuItemBodyDto,
  UpsertMenuRecipeBodyDto,
} from '../../openapi/zod-dtos';
import { ListFilterGroup } from '../common/list-filter.util';
import { MenuService } from './menu.service';
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { Availability } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('menu')
@ApiTags('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Get()
  @Public()
  async getMenuItems(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sort') sort?: 'price' | 'newest',
    @Query('sortBy') sortBy?: 'name' | 'basePrice' | 'prepTimeMinutes' | 'createdAt' | 'categoryName' | 'availability',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filters') filters?: string | Record<string, unknown>,
  ) {
    console.log('MENU_REQUEST_RECEIVED', { search, categoryId });
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
    return this.menuService.getMenuItems({
      search,
      category,
      categoryId,
      sort,
      sortBy,
      sortDir,
      filters: parsedFilters as ListFilterGroup | undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('categories')
  @Public()
  async getMenuCategories() {
    return this.menuService.getMenuCategories();
  }

  @Get(':id/info')
  @Public()
  async getPublicMenuItemInfo(@Param('id') id: string) {
    return this.menuService.getPublicMenuItemInfo(id);
  }

  @Post('categories')
  @Roles('ADMIN')
  @ApiBody({ type: MenuCategoryBodyDto })
  async createMenuCategory(@Body() data: unknown, @CurrentUser() actor: RequestUser) {
    return this.menuService.createMenuCategory(data, actor);
  }

  @Patch('categories/:id')
  @Roles('ADMIN')
  @ApiBody({ type: MenuCategoryBodyDto })
  async updateMenuCategory(
    @Param('id') id: string,
    @Body() data: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.updateMenuCategory(id, data, actor);
  }

  @Delete('categories/:id')
  @Roles('ADMIN')
  async deleteMenuCategory(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.menuService.deleteMenuCategory(id, actor);
  }

  @Get(':id')
  @Public()
  async getMenuItemById(@Param('id') id: string) {
    return this.menuService.getMenuItemById(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiBody({ type: CreateMenuItemBodyDto })
  async createMenuItem(@Body() data: any, @CurrentUser() actor: RequestUser) {
    return this.menuService.createMenuItem(data, actor);
  }

  @Get(':id/recipe')
  @Roles('ADMIN')
  async getMenuRecipe(@Param('id') id: string) {
    return this.menuService.getMenuRecipe(id);
  }

  @Put(':id/recipe')
  @Roles('ADMIN')
  @ApiBody({ type: UpsertMenuRecipeBodyDto })
  async upsertMenuRecipe(
    @Param('id') id: string,
    @Body() data: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.upsertMenuRecipe(id, data, actor);
  }

  @Get(':id/modifier-deltas')
  @Roles('ADMIN')
  async getModifierDeltas(@Param('id') id: string) {
    return this.menuService.getModifierDeltas(id);
  }

  @Put(':id/modifier-deltas')
  @Roles('ADMIN')
  @ApiBody({ type: ReplaceModifierDeltasBodyDto })
  async replaceModifierDeltas(
    @Param('id') id: string,
    @Body() data: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.replaceModifierDeltas(id, data, actor);
  }

  @Post(':id/recipe/line')
  @Roles('ADMIN')
  @ApiBody({ type: MenuRecipeLineBodyDto })
  async addMenuRecipeLine(
    @Param('id') id: string,
    @Body() data: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.addMenuRecipeLine(id, data, actor);
  }

  @Delete(':id/recipe/line/:ingredientId')
  @Roles('ADMIN')
  async removeMenuRecipeLine(
    @Param('id') id: string,
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.removeMenuRecipeLine(id, ingredientId, actor);
  }

  @Patch(':id/availability')
  @Roles('ADMIN')
  async updateAvailability(
    @Param('id') id: string,
    @Body('availability') availability: Availability,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.updateAvailability(id, availability, actor);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiBody({ type: UpdateMenuItemBodyDto })
  async updateMenuItem(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.menuService.updateMenuItem(id, data, actor);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async deleteMenuItem(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.menuService.deleteMenuItem(id, actor);
  }
}
