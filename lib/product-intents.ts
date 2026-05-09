export const INTENT_CONFIG = [
  { key: 'all' as const, label: 'الكل', title: 'جميع المنتجات', categorySlugs: [] as string[] },
  {
    key: 'home' as const,
    label: 'للبيت',
    title: 'منتجات مناسبة للبيت',
    categorySlugs: ['home-kitchen', 'cleaning-paper-personal-care', 'furnishings-linens', 'electrical-appliances'],
  },
  {
    key: 'restaurants' as const,
    label: 'للمطاعم والكافيهات',
    title: 'منتجات مناسبة للمطاعم والكافيهات',
    categorySlugs: ['restaurants-shops', 'plastic-packaging', 'cleaning-paper-personal-care'],
  },
  {
    key: 'shops' as const,
    label: 'للمحلات',
    title: 'منتجات مناسبة للمحلات',
    categorySlugs: ['restaurants-shops', 'plastic-packaging', 'cleaning-paper-personal-care', 'offers-bulk'],
  },
  {
    key: 'packaging' as const,
    label: 'للتغليف',
    title: 'مستلزمات التغليف',
    categorySlugs: ['plastic-packaging', 'restaurants-shops'],
  },
  {
    key: 'cleaning' as const,
    label: 'للتنظيف اليومي',
    title: 'منتجات التنظيف اليومي',
    categorySlugs: ['cleaning-paper-personal-care', 'home-kitchen'],
  },
  {
    key: 'bulk' as const,
    label: 'للكميات والعروض',
    title: 'عروض وكميات',
    categorySlugs: ['offers-bulk', 'plastic-packaging', 'restaurants-shops'],
  },
];

export type ProductIntentKey = (typeof INTENT_CONFIG)[number]['key'];

export const INTENT_TAG_CONFIG = [
  { key: 'home' as const, label: 'للبيت' },
  { key: 'restaurants' as const, label: 'للمطاعم والكافيهات' },
  { key: 'shops' as const, label: 'للمحلات' },
  { key: 'packaging' as const, label: 'للتغليف' },
  { key: 'cleaning' as const, label: 'للتنظيف اليومي' },
  { key: 'bulk' as const, label: 'للكميات والعروض' },
];

export function normalizeIntent(intent: unknown): ProductIntentKey {
  const value = Array.isArray(intent) ? intent[0] : intent;
  if (typeof value !== 'string') return 'all';
  return INTENT_CONFIG.some((item) => item.key === value)
    ? (value as ProductIntentKey)
    : 'all';
}

export function getIntentConfig(key: ProductIntentKey) {
  return INTENT_CONFIG.find((item) => item.key === key) || INTENT_CONFIG[0];
}

export function getProductCategorySlug(product: unknown): string | null {
  if (!product || typeof product !== 'object') return null;

  const anyProduct = product as any;
  const category = anyProduct.category ?? anyProduct.categories ?? null;

  if (!category) return null;
  if (Array.isArray(category)) return category[0]?.slug ?? null;
  return category?.slug ?? null;
}

export function getProductIntentTags(product: unknown): string[] {
  if (!product || typeof product !== 'object') return [];
  const anyProduct = product as any;
  const tags = anyProduct.intent_tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => typeof t === 'string');
}

export function productMatchesIntent(product: unknown, intent: ProductIntentKey): boolean {
  if (intent === 'all') return true;

  // 1. Try intent_tags first (explicit tagging from admin)
  const intentTags = getProductIntentTags(product);
  if (intentTags.length > 0) {
    return intentTags.includes(intent);
  }

  // 2. Fallback: category slug matching (backward compatibility)
  const categorySlug = getProductCategorySlug(product);
  if (!categorySlug) return false;

  const config = getIntentConfig(intent);
  return config.categorySlugs.includes(categorySlug);
}
