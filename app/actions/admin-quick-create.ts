'use server';

import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';
import { createReadableSlug } from '@/lib/slug';
import type { ProductFormRecord } from './admin-products';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function uniqueProductSlug(baseSlug: string, accessToken: string | null | undefined) {
  const adminClient = await createAdminActionClient(accessToken);
  const base = baseSlug || 'product';
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data } = await (adminClient.from('products') as any)
      .select('id')
      .eq('slug', candidate)
      .limit(1);
    if (!data?.length) break;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createQuickDraftProduct(
  accessToken: string | null
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const baseSlug = createReadableSlug('منتج جديد', 'product');
    const slug = await uniqueProductSlug(baseSlug, accessToken);

    const payload = {
      name: 'منتج جديد',
      slug,
      description: null,
      short_description: null,
      price: 0,
      compare_price: null,
      sku: null,
      barcode: null,
      stock_quantity: 0,
      track_stock: true,
      allow_backorders: false,
      category_id: null,
      subcategory_id: null,
      brand: null,
      tags: null,
      intent_tags: null,
      weight: null,
      dimensions: null,
      is_active: false,
      is_featured: false,
      marketing_tagline: null,
      key_features: null,
      product_badges: null,
      meta_title: null,
      meta_description: null,
    };

    const { data, error } = await (adminClient.from('products') as any)
      .insert(payload)
      .select('id, slug')
      .single();

    if (error) throw error;

    // Revalidate admin products list
    revalidatePath('/admin/products');

    return {
      success: true,
      data: data as { id: string; slug: string },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    console.error('[createQuickDraftProduct]', message);
    return { success: false, error: message };
  }
}

export async function publishQuickProduct(
  accessToken: string | null,
  productId: string,
  productData: Partial<ProductFormRecord>
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    // Validate required fields for publishing
    if (!productData.name?.trim()) {
      return { success: false, error: 'اسم المنتج مطلوب للنشر' };
    }

    if (!productData.price || productData.price <= 0) {
      return { success: false, error: 'السعر يجب أن يكون أكبر من 0' };
    }

    if (!productData.category_id) {
      return { success: false, error: 'القسم مطلوب للنشر' };
    }

    const updatePayload = {
      name: productData.name.trim(),
      description: productData.description || null,
      short_description: productData.short_description || null,
      price: productData.price,
      compare_price: productData.compare_price || null,
      sku: productData.sku?.trim() || null,
      brand: productData.brand?.trim() || null,
      category_id: productData.category_id,
      subcategory_id: productData.subcategory_id || null,
      stock_quantity: productData.stock_quantity ?? 0,
      track_stock: productData.track_stock ?? true,
      is_active: true,
      marketing_tagline: productData.marketing_tagline?.trim() || null,
      key_features: productData.key_features || null,
      product_badges: productData.product_badges || null,
      meta_title: productData.meta_title?.trim() || null,
      meta_description: productData.meta_description?.trim() || null,
      tags: productData.tags || null,
      intent_tags: productData.intent_tags || null,
    };

    const { error } = await (adminClient.from('products') as any)
      .update(updatePayload)
      .eq('id', productId);

    if (error) throw error;

    revalidatePath('/admin/products');
    revalidatePath('/products');
    revalidatePath(`/product/${updatePayload.name.trim().toLowerCase().replace(/\s+/g, '-')}`);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    console.error('[publishQuickProduct]', message);
    return { success: false, error: message };
  }
}

export async function saveQuickDraft(
  accessToken: string | null,
  productId: string,
  productData: Partial<ProductFormRecord>
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const updatePayload = {
      name: productData.name?.trim() || 'منتج جديد',
      description: productData.description || null,
      short_description: productData.short_description || null,
      price: productData.price ?? 0,
      compare_price: productData.compare_price || null,
      sku: productData.sku?.trim() || null,
      brand: productData.brand?.trim() || null,
      category_id: productData.category_id || null,
      subcategory_id: productData.subcategory_id || null,
      stock_quantity: productData.stock_quantity ?? 0,
      track_stock: productData.track_stock ?? true,
      is_active: false,
      marketing_tagline: productData.marketing_tagline?.trim() || null,
      key_features: productData.key_features || null,
      product_badges: productData.product_badges || null,
      meta_title: productData.meta_title?.trim() || null,
      meta_description: productData.meta_description?.trim() || null,
      tags: productData.tags || null,
      intent_tags: productData.intent_tags || null,
    };

    const { error } = await (adminClient.from('products') as any)
      .update(updatePayload)
      .eq('id', productId);

    if (error) throw error;

    revalidatePath('/admin/products');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    console.error('[saveQuickDraft]', message);
    return { success: false, error: message };
  }
}
