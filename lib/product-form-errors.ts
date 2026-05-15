import type { FieldErrors } from 'react-hook-form';
import type { ProductFormInput } from '@/lib/product-validation';

export interface ValidationIssue {
  field?: string;
  message: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'اسم المنتج',
  slug: 'الرابط المختصر',
  price: 'السعر',
  compare_price: 'السعر قبل الخصم',
  stock_quantity: 'المخزون',
  category_id: 'القسم الرئيسي',
  subcategory_id: 'الفئة الفرعية',
  sku: 'SKU',
  barcode: 'الباركود',
  brand: 'العلامة التجارية',
  description: 'الوصف الكامل',
  short_description: 'الوصف القصير',
  marketing_tagline: 'العبارة التسويقية',
  key_features: 'المميزات',
  product_badges: 'شارات المنتج',
  intent_tags: 'تصنيفات الاستخدام',
  search_keywords: 'كلمات البحث',
  meta_title: 'عنوان SEO',
  meta_description: 'وصف SEO',
  tags: 'الوسوم',
  weight: 'الوزن',
  'dimensions.length': 'الطول',
  'dimensions.width': 'العرض',
  'dimensions.height': 'الارتفاع',
};

const FIELD_SCROLL_IDS: Record<string, string> = {
  name: 'name',
  slug: 'slug',
  price: 'price',
  compare_price: 'compare_price',
  stock_quantity: 'stock_quantity',
  category_id: 'category_id',
  subcategory_id: 'subcategory_id',
  sku: 'sku',
  barcode: 'barcode',
  brand: 'brand',
  description: 'description',
  short_description: 'short_description',
  marketing_tagline: 'marketing_tagline',
  key_features: 'key_features',
  meta_title: 'meta_title',
  meta_description: 'meta_description',
  'dimensions.length': 'length',
  'dimensions.width': 'width',
  'dimensions.height': 'height',
};

export function fieldKeyToScrollId(fieldKey: string): string | undefined {
  return FIELD_SCROLL_IDS[fieldKey] || fieldKey;
}

export function fieldKeyToLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey] || fieldKey;
}

function friendlyFieldMessage(fieldKey: string, message: string): string {
  const isIntentField = fieldKey === 'intent_tags' || fieldKey.startsWith('intent_tags.');
  if (
    isIntentField &&
    (/Invalid enum value/i.test(message) || /received '/i.test(message))
  ) {
    return 'يوجد تصنيف استخدام غير صالح وتم تنظيفه تلقائيًا، حاول الحفظ مرة أخرى';
  }
  return message;
}

function pushIssue(
  issues: ValidationIssue[],
  seen: Set<string>,
  field: string | undefined,
  message: string
) {
  const trimmed = friendlyFieldMessage(field || '', message).trim();
  if (!trimmed) return;
  const key = `${field || 'form'}::${trimmed}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push({
    field: field ? fieldKeyToScrollId(field) : undefined,
    message: trimmed,
  });
}

export function flattenFormErrors(
  errors: FieldErrors<ProductFormInput> | Record<string, unknown>,
  prefix = ''
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(errors || {})) {
    if (!value || typeof value !== 'object') continue;
    const fieldKey = prefix ? `${prefix}.${key}` : key;
    const record = value as Record<string, unknown>;

    if (typeof record.message === 'string') {
      pushIssue(issues, seen, fieldKey, record.message);
      continue;
    }

    if (Array.isArray(record)) {
      record.forEach((item, index) => {
        if (item && typeof item === 'object' && 'message' in item && typeof item.message === 'string') {
          pushIssue(issues, seen, `${fieldKey}.${index}`, item.message);
        }
      });
      continue;
    }

    issues.push(...flattenFormErrors(record as FieldErrors<ProductFormInput>, fieldKey));
  }

  return issues;
}

export function formatServerFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const [key, messages] of Object.entries(fieldErrors)) {
    const first = messages?.[0];
    if (!first) continue;
    pushIssue(issues, seen, key, `${fieldKeyToLabel(key)}: ${first}`);
  }

  return issues;
}

export function summarizeValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return 'يرجى مراجعة الحقول المطلوبة';
  if (issues.length === 1) return issues[0]!.message;
  return issues
    .slice(0, 3)
    .map((item) => item.message)
    .join(' • ');
}
