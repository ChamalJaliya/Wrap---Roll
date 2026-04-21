export type MenuItemInfo = {
  itemId: string;
  name: string;
  categoryName: string;
  prepTimeMinutes: number;
  categoryAveragePrepTimeMinutes: number;
  ingredientHighlights: string[];
  healthTips: string[];
  nutritionTags: Array<{ key: string; label: string }>;
};
