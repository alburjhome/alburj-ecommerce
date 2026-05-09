export const INTENT_CONFIG = [
  { key: 'all' as const, label: 'الكل', title: 'جميع المنتجات', categorySlugs: [] as string[] },
  {
    key: 'home' as const,
    label: 'للبيت',
    title: 'منتجات مناسبة للبيت',
    categorySlugs: ['home-kitchen', 'cleaning-paper-personal-care', 'furnishings-linens', 'electrical-appliances'],
  },
  {
    key: 'kitchen' as const,
    label: 'للمطبخ والأدوات المنزلية',
    title: 'أدوات المطبخ والمنزل',
    categorySlugs: ['home-kitchen'],
  },
  {
    key: 'plastics' as const,
    label: 'للبلاستيكيات',
    title: 'البلاستيكيات',
    categorySlugs: ['plastic-packaging'],
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
    key: 'cleaning' as const,
    label: 'للتنظيف والورقيات',
    title: 'منتجات التنظيف والورقيات',
    categorySlugs: ['cleaning-paper-personal-care', 'home-kitchen'],
  },
  {
    key: 'packaging' as const,
    label: 'للتغليف',
    title: 'مستلزمات التغليف',
    categorySlugs: ['plastic-packaging', 'restaurants-shops'],
  },
  {
    key: 'bulk' as const,
    label: 'للكميات والعروض',
    title: 'عروض وكميات',
    categorySlugs: ['offers-bulk', 'plastic-packaging', 'restaurants-shops'],
  },
  {
    key: 'appliances' as const,
    label: 'للأجهزة الكهربائية',
    title: 'الأجهزة الكهربائية',
    categorySlugs: ['electrical-appliances', 'home-kitchen'],
  },
  {
    key: 'furnishings' as const,
    label: 'للمفروشات والبياضات',
    title: 'المفروشات والبياضات',
    categorySlugs: ['furnishings-linens', 'home-kitchen'],
  },
];

export type ProductIntentKey = (typeof INTENT_CONFIG)[number]['key'];

export const INTENT_TAG_CONFIG = [
  { key: 'home' as const, label: 'للبيت' },
  { key: 'kitchen' as const, label: 'للمطبخ والأدوات المنزلية' },
  { key: 'plastics' as const, label: 'للبلاستيكيات' },
  { key: 'restaurants' as const, label: 'للمطاعم والكافيهات' },
  { key: 'shops' as const, label: 'للمحلات' },
  { key: 'cleaning' as const, label: 'للتنظيف والورقيات' },
  { key: 'packaging' as const, label: 'للتغليف' },
  { key: 'bulk' as const, label: 'للكميات والعروض' },
  { key: 'appliances' as const, label: 'للأجهزة الكهربائية' },
  { key: 'furnishings' as const, label: 'للمفروشات والبياضات' },
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

const CATEGORY_TO_INTENTS: Record<string, ProductIntentKey[]> = {
  'home-kitchen': ['home', 'kitchen'],
  'plastic-packaging': ['plastics', 'packaging', 'restaurants', 'shops', 'bulk'],
  'restaurants-shops': ['restaurants', 'shops', 'packaging', 'bulk'],
  'cleaning-paper-personal-care': ['cleaning', 'home', 'restaurants', 'shops'],
  'electrical-appliances': ['appliances', 'home'],
  'furnishings-linens': ['furnishings', 'home'],
  'offers-bulk': ['bulk', 'shops', 'restaurants', 'plastics'],
};

export function productMatchesIntent(product: unknown, intent: ProductIntentKey): boolean {
  if (intent === 'all') return true;

  // 1. Try intent_tags first (explicit tagging from admin)
  const intentTags = getProductIntentTags(product);
  if (intentTags.length > 0) {
    return intentTags.includes(intent);
  }

  // 2. Fallback: category slug → intents mapping (backward compatibility)
  const categorySlug = getProductCategorySlug(product);
  if (!categorySlug) return false;

  const intentsForCategory = CATEGORY_TO_INTENTS[categorySlug];
  if (!intentsForCategory) return false;

  return intentsForCategory.includes(intent);
}
