'use server';

import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';
import {
  ProductFormInput,
  productSchema,
  sanitizeIntentTags,
  sanitizeProductBadges,
} from '@/lib/product-validation';
import { formatServerFieldErrors, summarizeValidationIssues } from '@/lib/product-form-errors';
import { buildProductSearchFields } from '@/lib/product-search-fields';
import { createReadableSlug, isValidSlug, normalizeSlug } from '@/lib/slug';
import { getProductSurfaceRecord, revalidateProductSurfaces } from '@/lib/revalidate-product-surfaces';
import type { Json } from '@/types/supabase';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface ProductListFilters {
  page?: number;
  search?: string;
  category?: string;
  status?: 'all' | 'active' | 'inactive';
  featured?: 'all' | 'featured' | 'not_featured';
  productType?: 'all' | 'single' | 'bundle';
}

const PAGE_SIZE = 10;

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface SubcategoryOption {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

export interface ProductImageOption {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductListRow {
  id: string;
  product_type: 'single' | 'bundle';
  name: string;
  slug: string;
  price: number;
  compare_price: number | null;
  sku: string | null;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  category_id: string | null;
  created_at: string;
  category: CategoryOption | null;
  images: ProductImageOption[];
}

export interface ProductFormRecord {
  id: string;
  product_type: 'single' | 'bundle';
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock_quantity: number;
  track_stock: boolean;
  allow_backorders: boolean;
  category_id: string | null;
  subcategory_id: string | null;
  brand: string | null;
  tags: string[] | null;
  intent_tags: string[] | null;
  weight: number | null;
  dimensions: Json | null;
  is_active: boolean;
  is_featured: boolean;
  marketing_tagline: string | null;
  key_features: string[] | null;
  product_badges: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  search_keywords: string[] | null;
  normalized_search_text: string | null;
}

export interface ProductListResult {
  products: ProductListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductFormDataResult {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  product: ProductFormRecord | null;
}

function normalizeNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeProductInput(input: ProductFormInput) {
  const dimensions = input.dimensions;
  const hasDimensions =
    dimensions?.length != null || dimensions?.width != null || dimensions?.height != null;
  const intent_tags = sanitizeIntentTags(input.intent_tags);
  const product_badges = sanitizeProductBadges(input.product_badges);

  const { search_keywords, normalized_search_text } = buildProductSearchFields({
    name: input.name.trim(),
    description: normalizeNullable(input.description),
    short_description: normalizeNullable(input.short_description),
    marketing_tagline: normalizeNullable(input.marketing_tagline),
    sku: normalizeNullable(input.sku),
    brand: normalizeNullable(input.brand),
    tags: input.tags,
    search_keywords: input.search_keywords,
    key_features: input.key_features,
    product_type: input.product_type || 'single',
  });

  return {
    product_type: input.product_type || 'single',
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: normalizeNullable(input.description),
    short_description: normalizeNullable(input.short_description),
    price: input.price,
    compare_price: input.compare_price,
    sku: normalizeNullable(input.sku),
    barcode: normalizeNullable(input.barcode),
    stock_quantity: input.stock_quantity,
    track_stock: input.track_stock,
    allow_backorders: input.allow_backorders,
    category_id: input.category_id,
    subcategory_id: input.subcategory_id,
    brand: normalizeNullable(input.brand),
    tags: input.tags.length ? input.tags : null,
    intent_tags: intent_tags.length ? intent_tags : null,
    marketing_tagline: normalizeNullable(input.marketing_tagline),
    key_features: input.key_features.length ? input.key_features : null,
    product_badges: product_badges.length ? product_badges : null,
    weight: input.weight,
    dimensions: hasDimensions ? dimensions : null,
    is_active: input.is_active,
    is_featured: input.is_featured,
    meta_title: normalizeNullable(input.meta_title),
    meta_description: normalizeNullable(input.meta_description),
    search_keywords,
    normalized_search_text,
  };
}

function formatValidationErrorMessage(fieldErrors: Record<string, string[] | undefined>) {
  return summarizeValidationIssues(formatServerFieldErrors(fieldErrors));
}

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return 'يوجد منتج بنفس الرابط المختصر أو SKU';
    }
    if (
      error.message.includes('search_keywords') ||
      error.message.includes('normalized_search_text') ||
      error.message.includes("Could not find the")
    ) {
      return 'حقول البحث غير موجودة في قاعدة البيانات. طبّق migration 14 أولًا.';
    }
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logAdminActionError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-products:${action}] ${message}`);
}

async function assertUniqueProductFields(
  slug: string,
  sku: string | null,
  currentProductId: string | undefined,
  accessToken: string | null | undefined
) {
  const adminClient = await createAdminActionClient(accessToken);
  let query = adminClient.from('products').select('id, slug, sku').or(`slug.eq.${slug}${sku ? `,sku.eq.${sku}` : ''}`);

  if (currentProductId) {
    query = query.neq('id', currentProductId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    throw new Error('يوجد منتج بنفس الرابط المختصر أو SKU');
  }
}

async function productSlugExists(
  slug: string,
  currentProductId: string | undefined,
  accessToken: string | null | undefined
) {
  const adminClient = await createAdminActionClient(accessToken);
  let query = adminClient.from('products').select('id').eq('slug', slug);

  if (currentProductId) {
    query = query.neq('id', currentProductId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function uniqueProductSlug(
  baseSlug: string,
  accessToken: string | null | undefined,
  currentProductId?: string
) {
  const base = normalizeSlug(baseSlug) || 'product';
  let candidate = base;
  let suffix = 2;

  while (await productSlugExists(candidate, currentProductId, accessToken)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function resolveProductSlug(
  input: ProductFormInput,
  currentProductId: string | undefined,
  accessToken: string | null | undefined
) {
  const providedSlug = normalizeSlug(input.slug || '');

  if (currentProductId || input.slug_was_manual) {
    if (!providedSlug || !isValidSlug(providedSlug)) {
      throw new Error('الرابط المختصر غير صالح');
    }
    if (await productSlugExists(providedSlug, currentProductId, accessToken)) {
      throw new Error('يوجد منتج بنفس الرابط المختصر');
    }
    return providedSlug;
  }

  return uniqueProductSlug(providedSlug || createReadableSlug(input.name, 'product'), accessToken);
}

export async function getAdminProducts(
  accessToken: string | null,
  filters: ProductListFilters = {}
): Promise<ActionResult<ProductListResult>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const page = Math.max(1, filters.page || 1);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = (adminClient.from('products') as any)
      .select('*, category:categories(id, name), images:product_images(id, url, alt_text, is_primary, sort_order)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    const search = filters.search?.trim();
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category_id', filters.category);
    }

    if (filters.status === 'active') {
      query = query.eq('is_active', true);
    } else if (filters.status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (filters.featured === 'featured') {
      query = query.eq('is_featured', true);
    } else if (filters.featured === 'not_featured') {
      query = query.eq('is_featured', false);
    }

    if (filters.productType === 'single' || filters.productType === 'bundle') {
      query = query.eq('product_type', filters.productType);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: {
        products: (data || []) as ProductListRow[],
        page,
        pageSize: PAGE_SIZE,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
      },
    };
  } catch (error) {
    logAdminActionError('getAdminProducts', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function getAdminProductFormData(
  accessToken: string | null,
  productId?: string
): Promise<ActionResult<ProductFormDataResult>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const [categoriesResult, subcategoriesResult, productResult] = await Promise.all([
      (adminClient.from('categories') as any).select('id, name, slug').order('sort_order', { ascending: true }),
      (adminClient.from('subcategories') as any)
        .select('id, name, slug, category_id')
        .order('sort_order', { ascending: true }),
      productId
        ? (adminClient.from('products') as any).select('*').eq('id', productId).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (subcategoriesResult.error) throw subcategoriesResult.error;
    if (productResult.error) throw productResult.error;

    return {
      success: true,
      data: {
        categories: (categoriesResult.data || []) as CategoryOption[],
        subcategories: (subcategoriesResult.data || []) as SubcategoryOption[],
        product: productResult.data as ProductFormRecord | null,
      },
    };
  } catch (error) {
    logAdminActionError('getAdminProductFormData', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function createAdminProduct(
  accessToken: string | null,
  input: ProductFormInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = productSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return {
        success: false,
        error: formatValidationErrorMessage(fieldErrors),
        fieldErrors,
      };
    }

    const slug = await resolveProductSlug(parsed.data, undefined, accessToken);
    const payload = normalizeProductInput({ ...parsed.data, slug });
    await assertUniqueProductFields(payload.slug, payload.sku, undefined, accessToken);

    const { data, error } = await (adminClient.from('products') as any)
      .insert(payload)
      .select('id, slug')
      .single();

    if (error) throw error;

    if (data?.id) {
      await revalidateProductSurfaces({ accessToken, productId: data.id, after: null, before: null });
    } else {
      revalidatePath('/admin/products');
    }
    return {
      success: true,
      data: data ? ({ id: data.id, slug: data.slug } as { id: string; slug: string }) : undefined,
    };
  } catch (error) {
    logAdminActionError('createAdminProduct', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function createAdminProductDraft(
  accessToken: string | null,
  input: Partial<ProductFormInput>
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const name = input.name?.trim() || 'منتج جديد';
    const slug = await uniqueProductSlug(
      normalizeSlug(input.slug || '') || createReadableSlug(name, 'product'),
      accessToken
    );

    const dimensions = input.dimensions;
    const hasDimensions =
      dimensions?.length != null || dimensions?.width != null || dimensions?.height != null;
    const comparePrice = Number(input.compare_price);
    const weight = Number(input.weight);

    const payload = {
      product_type: input.product_type || 'single',
      name,
      slug,
      description: normalizeNullable(input.description),
      short_description: normalizeNullable(input.short_description),
      price: Number(input.price) > 0 ? Number(input.price) : 0,
      compare_price: Number.isFinite(comparePrice) && comparePrice > 0 ? comparePrice : null,
      sku: normalizeNullable(input.sku),
      barcode: normalizeNullable(input.barcode),
      stock_quantity: Math.max(0, Number(input.stock_quantity) || 0),
      track_stock: input.track_stock ?? true,
      allow_backorders: input.allow_backorders ?? false,
      category_id: input.category_id || null,
      subcategory_id: input.subcategory_id || null,
      brand: normalizeNullable(input.brand),
      tags: input.tags?.length ? input.tags : null,
      intent_tags: (() => {
        const tags = sanitizeIntentTags(input.intent_tags);
        return tags.length ? tags : null;
      })(),
      marketing_tagline: normalizeNullable(input.marketing_tagline),
      key_features: input.key_features?.length ? input.key_features : null,
      product_badges: (() => {
        const badges = sanitizeProductBadges(input.product_badges);
        return badges.length ? badges : null;
      })(),
      weight: Number.isFinite(weight) && weight > 0 ? weight : null,
      dimensions: hasDimensions ? dimensions : null,
      is_active: false,
      is_featured: input.is_featured ?? false,
      meta_title: normalizeNullable(input.meta_title),
      meta_description: normalizeNullable(input.meta_description),
    };

    const { data, error } = await (adminClient.from('products') as any)
      .insert(payload)
      .select('id, slug')
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    return {
      success: true,
      data: data ? ({ id: data.id, slug: data.slug } as { id: string; slug: string }) : undefined,
    };
  } catch (error) {
    logAdminActionError('createAdminProductDraft', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminProductDraft(
  accessToken: string | null,
  productId: string,
  input: Partial<ProductFormInput>
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const before = await getProductSurfaceRecord(accessToken, productId);
    const name = input.name?.trim() || 'منتج جديد';
    const slug = await uniqueProductSlug(
      normalizeSlug(input.slug || '') || createReadableSlug(name, 'product'),
      accessToken,
      productId
    );

    const dimensions = input.dimensions;
    const hasDimensions =
      dimensions?.length != null || dimensions?.width != null || dimensions?.height != null;
    const comparePrice = Number(input.compare_price);
    const weight = Number(input.weight);
    const sku = normalizeNullable(input.sku);

    await assertUniqueProductFields(slug, sku, productId, accessToken);

    const payload = {
      product_type: input.product_type || 'single',
      name,
      slug,
      description: normalizeNullable(input.description),
      short_description: normalizeNullable(input.short_description),
      price: Number(input.price) > 0 ? Number(input.price) : 0,
      compare_price: Number.isFinite(comparePrice) && comparePrice > 0 ? comparePrice : null,
      sku,
      barcode: normalizeNullable(input.barcode),
      stock_quantity: Math.max(0, Number(input.stock_quantity) || 0),
      track_stock: input.track_stock ?? true,
      allow_backorders: input.allow_backorders ?? false,
      category_id: input.category_id || null,
      subcategory_id: input.subcategory_id || null,
      brand: normalizeNullable(input.brand),
      tags: input.tags?.length ? input.tags : null,
      intent_tags: (() => {
        const tags = sanitizeIntentTags(input.intent_tags);
        return tags.length ? tags : null;
      })(),
      marketing_tagline: normalizeNullable(input.marketing_tagline),
      key_features: input.key_features?.length ? input.key_features : null,
      product_badges: (() => {
        const badges = sanitizeProductBadges(input.product_badges);
        return badges.length ? badges : null;
      })(),
      weight: Number.isFinite(weight) && weight > 0 ? weight : null,
      dimensions: hasDimensions ? dimensions : null,
      is_active: false,
      is_featured: input.is_featured ?? false,
      meta_title: normalizeNullable(input.meta_title),
      meta_description: normalizeNullable(input.meta_description),
    };

    const { data, error } = await (adminClient.from('products') as any)
      .update(payload)
      .eq('id', productId)
      .select('id, slug')
      .single();

    if (error) throw error;

    const after = await getProductSurfaceRecord(accessToken, productId);
    await revalidateProductSurfaces({ accessToken, productId, before, after });
    return {
      success: true,
      data: data ? ({ id: data.id, slug: data.slug } as { id: string; slug: string }) : undefined,
    };
  } catch (error) {
    logAdminActionError('updateAdminProductDraft', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminProduct(
  accessToken: string | null,
  productId: string,
  input: ProductFormInput
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const before = await getProductSurfaceRecord(accessToken, productId);
    const parsed = productSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return {
        success: false,
        error: formatValidationErrorMessage(fieldErrors),
        fieldErrors,
      };
    }

    const slug = await resolveProductSlug(parsed.data, productId, accessToken);
    const payload = normalizeProductInput({ ...parsed.data, slug });
    await assertUniqueProductFields(payload.slug, payload.sku, productId, accessToken);

    const { error } = await (adminClient.from('products') as any)
      .update(payload)
      .eq('id', productId);

    if (error) throw error;

    const after = await getProductSurfaceRecord(accessToken, productId);
    await revalidateProductSurfaces({ accessToken, productId, before, after });
    return { success: true };
  } catch (error) {
    logAdminActionError('updateAdminProduct', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function toggleAdminProductActive(
  accessToken: string | null,
  productId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const before = await getProductSurfaceRecord(accessToken, productId);
    const { error } = await (adminClient.from('products') as any)
      .update({ is_active: isActive })
      .eq('id', productId);

    if (error) throw error;

    const after = await getProductSurfaceRecord(accessToken, productId);
    await revalidateProductSurfaces({ accessToken, productId, before, after });
    return { success: true };
  } catch (error) {
    logAdminActionError('toggleAdminProductActive', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function deleteAdminProduct(
  accessToken: string | null,
  productId: string
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const before = await getProductSurfaceRecord(accessToken, productId);
    const { error } = await (adminClient.from('products') as any)
      .delete()
      .eq('id', productId);

    if (error) throw error;

    // After delete we can't fetch the new record.
    await revalidateProductSurfaces({ accessToken, productId, before, after: null });
    return { success: true };
  } catch (error) {
    logAdminActionError('deleteAdminProduct', error);
    return { success: false, error: friendlyError(error) };
  }
}
