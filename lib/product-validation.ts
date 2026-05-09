import { z } from 'zod';
import { createReadableSlug } from '@/lib/slug';

const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().min(0, 'القيمة لا يمكن أن تكون أقل من صفر').nullable()
);

const optionalSlug = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine(
    (value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط'
  );

export const productSchema = z.object({
  name: z.string().trim().min(1, 'اسم المنتج مطلوب'),
  slug: optionalSlug,
  slug_was_manual: z.boolean().optional().default(false),
  description: z.string().trim().nullable(),
  short_description: z.string().trim().nullable(),
  price: z.coerce.number().min(0, 'السعر لا يمكن أن يكون أقل من صفر'),
  compare_price: optionalNumber,
  sku: z.string().trim().nullable(),
  barcode: z.string().trim().nullable(),
  stock_quantity: z.coerce.number().int().min(0, 'المخزون لا يمكن أن يكون أقل من صفر'),
  track_stock: z.boolean(),
  allow_backorders: z.boolean(),
  category_id: z.string().uuid('القسم مطلوب'),
  subcategory_id: z.string().uuid().nullable(),
  brand: z.string().trim().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  intent_tags: z
    .array(z.enum(['home', 'restaurants', 'shops', 'packaging', 'cleaning', 'bulk']))
    .default([]),
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
  meta_title: z.string().trim().nullable(),
  meta_description: z.string().trim().nullable(),
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
