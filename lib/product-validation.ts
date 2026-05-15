import { z } from 'zod';
import { createReadableSlug } from '@/lib/slug';

const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().min(0, 'القيمة لا يمكن أن تكون أقل من صفر').nullable()
);

const nullableTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().nullable()
);

const optionalSlug = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : ''),
  z
    .string()
    .refine(
      (value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط'
    )
);

const categoryIdSchema = z
  .string({ required_error: 'يرجى اختيار القسم الرئيسي' })
  .min(1, 'يرجى اختيار القسم الرئيسي')
  .uuid('يرجى اختيار قسم صالح');

const subcategoryIdSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : value),
  z.string().uuid('يرجى اختيار فئة فرعية صالحة').nullable()
);

export const ALLOWED_PRODUCT_INTENT_TAGS = [
  'home',
  'kitchen',
  'plastics',
  'restaurants',
  'shops',
  'packaging',
  'cleaning',
  'bulk',
  'appliances',
  'furnishings',
] as const;

export const ALLOWED_PRODUCT_BADGES = ['bestselling', 'offer', 'new', 'wholesale', 'limited'] as const;

export type ProductIntentTag = (typeof ALLOWED_PRODUCT_INTENT_TAGS)[number];
export type ProductBadgeTag = (typeof ALLOWED_PRODUCT_BADGES)[number];

/** Legacy / AI aliases → official intent tag keys */
const INTENT_TAG_ALIASES: Record<string, ProductIntentTag> = {
  hygiene: 'cleaning',
  personal_care: 'cleaning',
  personalcare: 'cleaning',
  paper: 'cleaning',
  cleaning_paper: 'cleaning',
  restaurant: 'restaurants',
  cafe: 'restaurants',
  cafes: 'restaurants',
  coffee: 'restaurants',
  store: 'shops',
  shop: 'shops',
  stores: 'shops',
  package: 'packaging',
  packages: 'packaging',
  packing: 'packaging',
  disposable: 'plastics',
  plastic: 'plastics',
  electric: 'appliances',
  electrical: 'appliances',
  appliance: 'appliances',
  furniture: 'furnishings',
  furnishing: 'furnishings',
  bedding: 'furnishings',
  linens: 'furnishings',
  linen: 'furnishings',
};

const intentTagSchema = z.enum(ALLOWED_PRODUCT_INTENT_TAGS);
const productBadgeSchema = z.enum(ALLOWED_PRODUCT_BADGES);

function normalizeTagKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Map a single raw intent tag to an official allowed value, or null if unknown.
 */
export function mapIntentTag(value: string): ProductIntentTag | null {
  const key = normalizeTagKey(value);
  if (!key) return null;

  if ((ALLOWED_PRODUCT_INTENT_TAGS as readonly string[]).includes(key)) {
    return key as ProductIntentTag;
  }

  return INTENT_TAG_ALIASES[key] ?? null;
}

/**
 * Sanitize intent_tags from DB, AI, or form state.
 * Drops unknown values and maps legacy/AI aliases to official keys.
 */
export function sanitizeIntentTags(value: unknown): ProductIntentTag[] {
  const raw: unknown[] = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];

  const seen = new Set<ProductIntentTag>();
  const result: ProductIntentTag[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const mapped = mapIntentTag(item);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    result.push(mapped);
  }

  return result;
}

export function sanitizeProductBadges(value: unknown): ProductBadgeTag[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ALLOWED_PRODUCT_BADGES);
  const seen = new Set<ProductBadgeTag>();
  const result: ProductBadgeTag[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const key = item.trim().toLowerCase();
    if (!allowed.has(key) || seen.has(key as ProductBadgeTag)) continue;
    seen.add(key as ProductBadgeTag);
    result.push(key as ProductBadgeTag);
  }

  return result;
}

export const productSchema = z.object({
  product_type: z.enum(['single', 'bundle']).optional().default('single'),
  name: z.string().trim().min(1, 'اسم المنتج مطلوب'),
  slug: optionalSlug,
  slug_was_manual: z.boolean().optional().default(false),
  description: nullableTrimmedString,
  short_description: nullableTrimmedString,
  price: z.coerce.number().min(0, 'السعر لا يمكن أن يكون أقل من صفر'),
  compare_price: optionalNumber,
  sku: nullableTrimmedString,
  barcode: nullableTrimmedString,
  stock_quantity: z.coerce.number().int().min(0, 'المخزون لا يمكن أن يكون أقل من صفر'),
  track_stock: z.boolean(),
  allow_backorders: z.boolean(),
  category_id: categoryIdSchema,
  subcategory_id: subcategoryIdSchema,
  brand: nullableTrimmedString,
  tags: z.array(z.string().trim().min(1)).default([]),
  intent_tags: z.preprocess(
    (value) => sanitizeIntentTags(value),
    z.array(intentTagSchema).max(10, 'أقصى 10 تصنيفات استخدام').default([])
  ),
  weight: optionalNumber,
  dimensions: z
    .object({
      length: optionalNumber,
      width: optionalNumber,
      height: optionalNumber,
    })
    .nullable(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  marketing_tagline: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(120, 'لا تتجاوز 120 حرف').nullable()
  ),
  key_features: z.array(z.string().trim().max(80, 'كل ميزة لا تتجاوز 80 حرف')).max(6, 'أقصى 6 مميزات').default([]),
  product_badges: z.preprocess(
    (value) => sanitizeProductBadges(value),
    z.array(productBadgeSchema).max(5, 'أقصى 5 وسوم').default([])
  ),
  meta_title: nullableTrimmedString,
  meta_description: nullableTrimmedString,
  search_keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export type ProductFormInput = z.infer<typeof productSchema>;

export function slugify(value: string) {
  return createReadableSlug(value, '');
}

export function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function tagsToString(tags: string[] | null | undefined) {
  return tags?.join(', ') || '';
}

export function parseSearchKeywords(value: string) {
  return value
    .split(/[\n,،]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function searchKeywordsToString(keywords: string[] | null | undefined) {
  return keywords?.join('\n') || '';
}
