import type { Category, CategoryWithSubcategories, Subcategory } from '@/types';

type SupabaseLike = {
  from: (table: string) => any;
};

export interface PublicCategory extends CategoryWithSubcategories {
  subcategories: Subcategory[];
}

export interface PublicCategoryLink {
  href: string;
  label: string;
}

interface ProductTaxonomyRef {
  category_id: string | null;
  subcategory_id: string | null;
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

export async function getPublicCatalogTaxonomy(client: SupabaseLike): Promise<PublicCategory[]> {
  const [categoriesResult, subcategoriesResult, productsResult] = await Promise.all([
    client
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    client
      .from('subcategories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    client
      .from('products')
      .select('category_id, subcategory_id')
      .eq('is_active', true)
      .range(0, 9999),
  ]);

  if (categoriesResult.error || subcategoriesResult.error || productsResult.error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to load public catalog taxonomy', {
        categories: categoriesResult.error?.message,
        subcategories: subcategoriesResult.error?.message,
        products: productsResult.error?.message,
      });
    }
    return [];
  }

  const categories = ((categoriesResult.data || []) as Category[]).filter((category) => category.slug);
  const subcategories = ((subcategoriesResult.data || []) as Subcategory[]).filter((subcategory) => subcategory.slug);
  const productRefs = (productsResult.data || []) as ProductTaxonomyRef[];

  const subcategoryById = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory]));
  const categoryProductCounts = new Map<string, number>();
  const subcategoryProductCounts = new Map<string, number>();

  for (const product of productRefs) {
    if (product.subcategory_id) {
      const subcategory = subcategoryById.get(product.subcategory_id);
      if (subcategory) {
        incrementCount(subcategoryProductCounts, subcategory.id);
        incrementCount(categoryProductCounts, subcategory.category_id);
        continue;
      }
    }

    if (product.category_id) {
      incrementCount(categoryProductCounts, product.category_id);
    }
  }

  const visibleSubcategories = subcategories.filter((subcategory) =>
    subcategoryProductCounts.has(subcategory.id)
  );

  return categories
    .filter((category) => categoryProductCounts.has(category.id))
    .map((category) => ({
      ...category,
      subcategories: visibleSubcategories.filter((subcategory) => subcategory.category_id === category.id),
    }));
}

export function toPublicCategoryLinks(categories: PublicCategory[]): PublicCategoryLink[] {
  return categories.map((category) => ({
    href: `/category/${category.slug}`,
    label: category.name,
  }));
}
