import { CatalogCategoryMeta, CategoryGroup } from '@/types';

const MAIN_CATEGORY_LABELS: Record<string, string> = {
  women: 'Women',
  men: 'Men',
  kids: 'Kids',
};

export const humanizeCategoryLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const groupCatalogCategories = (categories: CatalogCategoryMeta[]): CategoryGroup[] => {
  const grouped = new Map<string, CategoryGroup>();
  const standalone: CategoryGroup[] = [];

  for (const category of categories) {
    const [prefix, ...rest] = category.id.split('-');

    if (rest.length > 0 && MAIN_CATEGORY_LABELS[prefix]) {
      const group = grouped.get(prefix) || {
        id: prefix,
        name: MAIN_CATEGORY_LABELS[prefix],
        count: 0,
        image_url: null,
        subcategories: [],
      };

      group.count = (group.count || 0) + category.count;
      if (!group.image_url && category.image_url) {
        group.image_url = category.image_url;
      }
      group.subcategories.push({
        id: category.id,
        name: category.name || humanizeCategoryLabel(category.id),
        count: category.count,
        image_url: category.image_url,
      });
      grouped.set(prefix, group);
      continue;
    }

    standalone.push({
      id: category.id,
      name: category.name || humanizeCategoryLabel(category.id),
      count: category.count,
      image_url: category.image_url,
      subcategories: [],
    });
  }

  const groupedValues = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  const standaloneValues = standalone.sort((a, b) => a.name.localeCompare(b.name));
  return [...groupedValues, ...standaloneValues];
};

export const matchesCategorySelection = (
  productCategory: string | null | undefined,
  selectedCategory: string | null,
  categoryGroups: CategoryGroup[]
) => {
  if (!selectedCategory || !productCategory) {
    return true;
  }

  if (productCategory === selectedCategory) {
    return true;
  }

  const selectedGroup = categoryGroups.find((group) => group.id === selectedCategory);
  if (!selectedGroup) {
    return false;
  }

  if (selectedGroup.subcategories.length === 0) {
    return productCategory === selectedGroup.id;
  }

  return selectedGroup.subcategories.some((subcategory) => subcategory.id === productCategory);
};
