import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Availability } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  CreateMenuItemSchema,
  MenuItem,
  MenuItemSchema,
  MenuRecipeLineInputSchema,
  UpdateMenuItemSchema,
  UpsertMenuRecipeSchema,
} from '@wrap-roll/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../../auth/current-user.decorator';
import { trackOpsActivity } from '../common/ops-activity';
import { buildPrismaWhereFromFilters } from '../common/list-filter.util';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(private prisma: PrismaService) {}

  private buildDynamicTips(categoryName: string, ingredientNames: string[]): string[] {
    const cat = categoryName.toLowerCase();
    const has = (re: RegExp) => ingredientNames.some((n) => re.test(n.toLowerCase()));
    const tips: string[] = [];

    if (cat.includes('drink')) {
      tips.push('Served chilled/fresh for best taste.');
      if (has(/coffee/)) tips.push('Contains caffeine.');
      if (has(/syrup|concentrate|nutella/)) tips.push('Best as an occasional sweet treat.');
      return tips.slice(0, 3);
    }

    if (cat.includes('dessert')) {
      tips.push('Best shared after your main meal.');
      tips.push('Pairs well with black coffee or tea.');
      return tips.slice(0, 3);
    }

    tips.push('Prepared fresh per order.');
    if (has(/harissa|chili|spicy/)) tips.push('Spice level may feel hot for sensitive guests.');
    if (has(/yogurt|paneer|halloumi|cheese/)) tips.push('Contains dairy ingredients.');
    if (has(/salad|greens|quinoa|falafel|avocado/)) tips.push('Includes fresh/fiber-rich ingredients.');
    if (tips.length < 3) tips.push('Ask for lighter sauce options if preferred.');
    return tips.slice(0, 3);
  }

  private buildNutritionTags(ingredientNames: string[]) {
    const names = ingredientNames.map((n) => n.toLowerCase());
    const has = (re: RegExp) => names.some((n) => re.test(n));
    const tags: Array<{ key: string; label: string }> = [];

    if (has(/chicken|beef|lamb|paneer|halloumi|egg|falafel/)) tags.push({ key: 'protein', label: 'Protein' });
    if (has(/salad|greens|lettuce|avocado|lime|fresh/)) tags.push({ key: 'fresh', label: 'Fresh' });
    if (has(/harissa|chili|spicy|pepper/)) tags.push({ key: 'spicy', label: 'Spicy' });
    if (has(/yogurt|paneer|halloumi|cheese|milk/)) tags.push({ key: 'dairy', label: 'Dairy' });
    if (has(/quinoa|greens|falafel|whole|wheat/)) tags.push({ key: 'fiber', label: 'Fiber' });
    if (has(/coffee/)) tags.push({ key: 'caffeine', label: 'Caffeine' });

    return tags.slice(0, 5);
  }

  private parseModifierDeltaPayload(data: unknown): Array<{
    optionId: string;
    ingredientId: string;
    quantityDelta: Prisma.Decimal;
  }> {
    const body = (data ?? {}) as Record<string, unknown>;
    const deltas = Array.isArray(body.deltas) ? body.deltas : [];
    return deltas
      .map((d) => {
        const delta = d as Record<string, unknown>;
        const optionId = typeof delta.optionId === 'string' ? delta.optionId : '';
        const ingredientId = typeof delta.ingredientId === 'string' ? delta.ingredientId : '';
        const q = delta.quantityDelta;
        const quantityDelta =
          typeof q === 'string' || typeof q === 'number' ? new Prisma.Decimal(q) : null;
        if (!optionId || !ingredientId || !quantityDelta) return null;
        return { optionId, ingredientId, quantityDelta };
      })
      .filter((x): x is { optionId: string; ingredientId: string; quantityDelta: Prisma.Decimal } => Boolean(x));
  }

  async getMenuItems(filters: {
    search?: string;
    category?: string;
    categoryId?: string;
    sort?: 'price' | 'newest';
    sortBy?: 'name' | 'basePrice' | 'prepTimeMinutes' | 'createdAt' | 'categoryName' | 'availability';
    sortDir?: 'asc' | 'desc';
    filters?: {
      logic?: 'AND' | 'OR';
      rules?: Array<{
        field: string;
        op: string;
        value?: string | number | boolean;
        valueTo?: string | number;
      }>;
    };
    page?: number;
    limit?: number;
  } = {}): Promise<{
    items: MenuItem[];
    meta: { total: number; page: number; limit: number; lastPage: number; hasNext: boolean; hasPrev: boolean };
  }> {
    const { search, category, categoryId, sort, sortBy, sortDir, page = 1, limit = 50 } = filters;
    
    try {
      const skip = (page - 1) * limit;
      const where: Record<string, unknown> = { isActive: true };

      if (categoryId) {
        where.categoryId = categoryId;
      }
      if (category && category.toLowerCase() !== 'all') {
        where.category = {
          is: { name: { equals: category, mode: 'insensitive' } },
        };
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      const compiledFilters = buildPrismaWhereFromFilters(filters.filters, {
        name: { kind: 'string', caseInsensitive: true },
        description: { kind: 'string', caseInsensitive: true },
        categoryId: { kind: 'enum' },
        availability: { kind: 'enum' },
        basePrice: { kind: 'number' },
        prepTimeMinutes: { kind: 'number' },
        createdAt: { kind: 'date' },
        isActive: { kind: 'boolean' },
      });
      Object.assign(where, compiledFilters);
      const menuScalarSort = [
        'name',
        'basePrice',
        'prepTimeMinutes',
        'createdAt',
        'availability',
      ] as const;
      type MenuScalarSortField = (typeof menuScalarSort)[number];

      let orderBy: Prisma.MenuItemOrderByWithRelationInput;
      if (sortBy && sortDir) {
        if (sortBy === 'categoryName') {
          orderBy = { category: { name: sortDir } };
        } else if ((menuScalarSort as readonly string[]).includes(sortBy)) {
          orderBy = { [sortBy as MenuScalarSortField]: sortDir };
        } else {
          orderBy = { createdAt: 'desc' };
        }
      } else if (sort === 'price') {
        orderBy = { basePrice: 'asc' };
      } else {
        orderBy = { createdAt: 'desc' };
      }

      const [items, total] = await Promise.all([
        this.prisma.menuItem.findMany({
          where,
          include: { category: true },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.menuItem.count({ where }),
      ]);

      console.log(`PRISMA_HANDSHAKE: found ${items.length} active items (search="${search || ''}", categoryId="${categoryId || ''}")`);
      const mappedItems = items.map((item) => this.mapToMenuItem(item));
      
      return {
        items: mappedItems,
        meta: {
          total,
          page,
          limit,
          lastPage: Math.max(1, Math.ceil(total / limit)),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        'Menu query failed (check DATABASE_URL, migrations, and that MenuItem rows use isActive=true)',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async getMenuItemById(id: string): Promise<MenuItem> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return this.mapToMenuItem(item);
  }

  async getPublicMenuItemInfo(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        recipes: {
          include: { ingredient: true },
          orderBy: { ingredient: { name: 'asc' } },
        },
      },
    });
    if (!item || !item.isActive) throw new NotFoundException('Menu item not found');

    const avg = await this.prisma.menuItem.aggregate({
      where: {
        isActive: true,
        categoryId: item.categoryId,
      },
      _avg: { prepTimeMinutes: true },
    });

    const ingredientHighlights = item.recipes
      .map((r) => r.ingredient?.name)
      .filter((v): v is string => Boolean(v))
      .slice(0, 8);

    const modifierGroups = this.normalizeModifierGroups(item.modifierGroupsJson);
    const optionLabelById = new Map<string, string>();
    for (const group of modifierGroups) {
      for (const option of group.options) {
        optionLabelById.set(option.optionId, option.label);
      }
    }

    const optionDeltas = await this.prisma.menuModifierOptionIngredientDelta.findMany({
      where: { menuItemId: item.id },
      include: { ingredient: { select: { name: true } } },
      orderBy: [{ optionId: 'asc' }, { ingredient: { name: 'asc' } }],
    });
    const impactByOption = new Map<string, Set<string>>();
    for (const delta of optionDeltas) {
      const label = optionLabelById.get(delta.optionId);
      const ingredientName = delta.ingredient?.name;
      if (!label || !ingredientName) continue;
      const existing = impactByOption.get(label) ?? new Set<string>();
      existing.add(ingredientName);
      impactByOption.set(label, existing);
    }
    const modifierIngredientImpacts = Array.from(impactByOption.entries()).map(
      ([optionLabel, names]) => ({
        optionLabel,
        ingredients: Array.from(names),
      }),
    );

    return {
      itemId: item.id,
      name: item.name,
      categoryName: item.category.name,
      prepTimeMinutes: Number(item.prepTimeMinutes ?? 0),
      categoryAveragePrepTimeMinutes: Math.round(Number(avg._avg.prepTimeMinutes ?? item.prepTimeMinutes ?? 0)),
      ingredientHighlights,
      healthTips: this.buildDynamicTips(item.category.name, ingredientHighlights),
      nutritionTags: this.buildNutritionTags(ingredientHighlights),
      modifierIngredientImpacts,
    };
  }

  private normalizeModifierGroups(value: unknown) {
    const groups = Array.isArray(value) ? value : [];
    return groups.map((group) => {
      const g = group as Record<string, unknown>;
      const options = Array.isArray(g.options) ? g.options : [];
      return {
        groupId: typeof g.groupId === 'string' ? g.groupId : randomUUID(),
        name: String(g.name ?? ''),
        type: String(g.type ?? 'single'),
        required: Boolean(g.required ?? false),
        minSelect: Number(g.minSelect ?? 0),
        maxSelect: Number(g.maxSelect ?? 1),
        options: options.map((option) => {
          const o = option as Record<string, unknown>;
          return {
            optionId: typeof o.optionId === 'string' ? o.optionId : randomUUID(),
            label: String(o.label ?? ''),
            priceAdjust: Number(o.priceAdjust ?? 0),
            isDefault: Boolean(o.isDefault ?? false),
          };
        }),
      };
    });
  }

  private mapRecipeLine(recipe: {
    ingredientId: string;
    quantityUsed: number | string | Prisma.Decimal;
    ingredient: {
      id: string;
      name: string;
      unit: string;
      currentStock: number | string | Prisma.Decimal;
      lowStockThreshold: number | string | Prisma.Decimal;
    };
  }) {
    return {
      ingredientId: recipe.ingredientId,
      quantityUsed: Number(recipe.quantityUsed),
      ingredient: {
        id: recipe.ingredient.id,
        name: recipe.ingredient.name,
        unit: recipe.ingredient.unit,
        currentStock: Number(recipe.ingredient.currentStock),
        lowStockThreshold: Number(recipe.ingredient.lowStockThreshold),
      },
    };
  }

  async createMenuItem(data: unknown, actor: RequestUser): Promise<MenuItem> {
    const dataObj = (data ?? {}) as Record<string, unknown>;
    const parsed = CreateMenuItemSchema.parse({
      ...dataObj,
      modifierGroups: this.normalizeModifierGroups(dataObj.modifierGroups),
    });
    const created = await this.prisma.menuItem.create({
      data: {
        id: randomUUID(),
        name: parsed.name,
        description: parsed.description,
        basePrice: parsed.basePrice,
        prepTimeMinutes: parsed.prepTimeMinutes,
        imageUrl: parsed.imageUrl,
        categoryId: parsed.categoryId,
        availability: parsed.availability as Availability,
        isActive: parsed.isActive,
        modifierGroupsJson: parsed.modifierGroups as Prisma.InputJsonValue,
      },
      include: { category: true },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: created.id,
      eventType: 'menu.item_created',
      summary: `Menu item created: ${created.name}`,
      actor,
      metadataJson: {
        name: created.name,
        basePrice: Number(created.basePrice),
        availability: created.availability,
      },
    });
    return this.mapToMenuItem(created);
  }

  async updateAvailability(id: string, availability: Availability, actor: RequestUser): Promise<MenuItem> {
    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { availability },
      include: { category: true },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: id,
      eventType: 'menu.availability_updated',
      summary: `Availability updated for ${updated.name}: ${availability}`,
      actor,
      metadataJson: { availability },
    });
    return this.mapToMenuItem(updated);
  }

  async updateMenuItem(id: string, data: unknown, actor: RequestUser): Promise<MenuItem> {
    const dataObj = (data ?? {}) as Record<string, unknown>;
    const parsed = UpdateMenuItemSchema.parse({
      ...dataObj,
      ...(dataObj.modifierGroups ? { modifierGroups: this.normalizeModifierGroups(dataObj.modifierGroups) } : {}),
    });
    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.basePrice !== undefined ? { basePrice: parsed.basePrice } : {}),
        ...(parsed.prepTimeMinutes !== undefined ? { prepTimeMinutes: parsed.prepTimeMinutes } : {}),
        ...(parsed.imageUrl !== undefined ? { imageUrl: parsed.imageUrl } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.availability !== undefined ? { availability: parsed.availability as Availability } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.modifierGroups !== undefined ? { modifierGroupsJson: parsed.modifierGroups as Prisma.InputJsonValue } : {}),
      },
      include: { category: true },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: id,
      eventType: 'menu.item_updated',
      summary: `Menu item updated: ${updated.name}`,
      actor,
      metadataJson: {
        changed: Object.keys(parsed),
      },
    });
    return this.mapToMenuItem(updated);
  }

  async getMenuRecipe(menuItemId: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');
    const lines = await this.prisma.recipeIngredient.findMany({
      where: { menuItemId },
      include: { ingredient: true },
      orderBy: { ingredient: { name: 'asc' } },
    });
    return {
      menuItemId,
      lines: lines.map((line) => this.mapRecipeLine(line)),
    };
  }

  async upsertMenuRecipe(menuItemId: string, data: unknown, actor: RequestUser) {
    const parsed = UpsertMenuRecipeSchema.parse(data);
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');

    const ingredientIds = [...new Set(parsed.lines.map((line) => line.ingredientId))];
    const ingredientCount = await this.prisma.ingredient.count({
      where: { id: { in: ingredientIds } },
    });
    if (ingredientCount !== ingredientIds.length) {
      throw new NotFoundException('One or more ingredients do not exist');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({ where: { menuItemId } });
      if (parsed.lines.length > 0) {
        await tx.recipeIngredient.createMany({
          data: parsed.lines.map((line) => ({
            menuItemId,
            ingredientId: line.ingredientId,
            quantityUsed: line.quantityUsed,
          })),
        });
      }
    });

    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: menuItemId,
      eventType: 'menu.recipe_upserted',
      summary: `Recipe updated for ${item.name}`,
      actor,
      metadataJson: {
        lineCount: parsed.lines.length,
      },
    });

    return this.getMenuRecipe(menuItemId);
  }

  async getModifierDeltas(menuItemId: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');

    const deltas = await this.prisma.menuModifierOptionIngredientDelta.findMany({
      where: { menuItemId },
      select: { optionId: true, ingredientId: true, quantityDelta: true },
      orderBy: [{ optionId: 'asc' }, { ingredientId: 'asc' }],
    });

    return {
      menuItemId,
      deltas: deltas.map((d) => ({
        optionId: d.optionId,
        ingredientId: d.ingredientId,
        quantityDelta: d.quantityDelta.toString(),
      })),
    };
  }

  async replaceModifierDeltas(menuItemId: string, data: unknown, actor: RequestUser) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');

    const parsed = this.parseModifierDeltaPayload(data);
    const ingredientIds = [...new Set(parsed.map((d) => d.ingredientId))];
    if (ingredientIds.length > 0) {
      const ingredientCount = await this.prisma.ingredient.count({
        where: { id: { in: ingredientIds } },
      });
      if (ingredientCount !== ingredientIds.length) {
        throw new NotFoundException('One or more ingredients do not exist');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.menuModifierOptionIngredientDelta.deleteMany({ where: { menuItemId } });
      if (parsed.length > 0) {
        await tx.menuModifierOptionIngredientDelta.createMany({
          data: parsed.map((d) => ({
            menuItemId,
            optionId: d.optionId,
            ingredientId: d.ingredientId,
            quantityDelta: d.quantityDelta,
          })),
        });
      }
    });

    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: menuItemId,
      eventType: 'menu.modifier_deltas_updated',
      summary: `Modifier deltas updated for ${item.name}`,
      actor,
      metadataJson: {
        deltaCount: parsed.length,
      },
    });

    return this.getModifierDeltas(menuItemId);
  }

  async addMenuRecipeLine(menuItemId: string, data: unknown, actor: RequestUser) {
    const parsed = MenuRecipeLineInputSchema.parse(data);
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id: parsed.ingredientId } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    await this.prisma.recipeIngredient.upsert({
      where: {
        menuItemId_ingredientId: {
          menuItemId,
          ingredientId: parsed.ingredientId,
        },
      },
      update: { quantityUsed: parsed.quantityUsed },
      create: { menuItemId, ingredientId: parsed.ingredientId, quantityUsed: parsed.quantityUsed },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: menuItemId,
      eventType: 'menu.recipe_line_added',
      summary: `Recipe line added/updated for ${item.name}: ${ingredient.name}`,
      actor,
      metadataJson: {
        ingredientId: parsed.ingredientId,
        quantityUsed: Number(parsed.quantityUsed),
      },
    });
    return this.getMenuRecipe(menuItemId);
  }

  async removeMenuRecipeLine(menuItemId: string, ingredientId: string, actor: RequestUser) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');
    await this.prisma.recipeIngredient.deleteMany({
      where: { menuItemId, ingredientId },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: menuItemId,
      eventType: 'menu.recipe_line_removed',
      summary: `Recipe line removed from ${item.name}`,
      actor,
      metadataJson: { ingredientId },
    });
    return this.getMenuRecipe(menuItemId);
  }

  async deleteMenuItem(id: string, actor: RequestUser): Promise<void> {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    await this.prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_item',
      entityId: id,
      eventType: 'menu.item_deleted',
      summary: `Menu item soft-deleted: ${item.name}`,
      actor,
    });
  }

  async getMenuCategories() {
    return this.prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true },
    });
  }

  async createMenuCategory(data: unknown, actor: RequestUser) {
    const parsed = (data ?? {}) as { name?: unknown };
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (!name) throw new BadRequestException('Category name is required');
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('Category name is invalid');

    const created = await this.prisma.menuCategory.create({
      data: { name, slug },
      select: { id: true, name: true, slug: true },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_category',
      entityId: created.id,
      eventType: 'menu.category_created',
      summary: `Menu category created: ${created.name}`,
      actor,
    });
    return created;
  }

  async updateMenuCategory(id: string, data: unknown, actor: RequestUser) {
    const parsed = (data ?? {}) as { name?: unknown };
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (!name) throw new BadRequestException('Category name is required');
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('Category name is invalid');

    const updated = await this.prisma.menuCategory.update({
      where: { id },
      data: { name, slug },
      select: { id: true, name: true, slug: true },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_category',
      entityId: id,
      eventType: 'menu.category_updated',
      summary: `Menu category updated: ${updated.name}`,
      actor,
    });
    return updated;
  }

  async deleteMenuCategory(id: string, actor: RequestUser) {
    const category = await this.prisma.menuCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    const menuItemsUsingCategory = await this.prisma.menuItem.count({
      where: { categoryId: id, isActive: true },
    });
    if (menuItemsUsingCategory > 0) {
      throw new BadRequestException('Cannot delete a category that is used by active menu items');
    }
    await this.prisma.menuCategory.delete({ where: { id } });
    await trackOpsActivity(this.prisma, {
      entityType: 'menu_category',
      entityId: id,
      eventType: 'menu.category_deleted',
      summary: `Menu category deleted: ${category.name}`,
      actor,
    });
    return { success: true };
  }

  private mapToMenuItem(item: {
    id: string;
    name: string;
    description: string | null;
    basePrice: number | { toString(): string };
    prepTimeMinutes: number;
    imageUrl: string | null;
    categoryId: string;
    category: { name: string };
    availability: MenuItem['availability'];
    isActive: boolean;
    modifierGroupsJson: unknown;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): MenuItem {
    const toIso = (d: Date | string) => {
      if (d instanceof Date) return d.toISOString();
      if (typeof d === 'string') {
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      }
      return new Date().toISOString();
    };

    // Prisma Decimals require safe handling for JSON serialization
    const price = typeof item.basePrice === 'number' 
      ? item.basePrice 
      : Number(item.basePrice?.toString() || 0);

    return {
      itemId: item.id,
      name: item.name,
      description: item.description ?? undefined,
      basePrice: price,
      prepTimeMinutes: Number(item.prepTimeMinutes ?? 0),
      imageUrl: item.imageUrl ?? undefined,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      availability: item.availability,
      isActive: item.isActive,
      modifierGroups: (item.modifierGroupsJson as MenuItem['modifierGroups']) ?? [],
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt),
    };
  }
}
