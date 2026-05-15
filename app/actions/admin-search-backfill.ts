'use server';

import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';
import {
  buildProductSearchFields,
  type ProductSearchFieldsInput,
} from '@/lib/product-search-fields';
import type { ActionResult } from '@/app/actions/admin-products';

const BATCH_SIZE = 50;

export interface SearchBackfillResult {
  updated: number;
  total: number;
  failed: number;
}

type ProductBackfillRow = {
  id: string;
  product_type: string | null;
  name: string;
  short_description: string | null;
  description: string | null;
  marketing_tagline: string | null;
  sku: string | null;
  brand: string | null;
  tags: string[] | null;
  key_features: string[] | null;
  search_keywords: string[] | null;
  category: { name: string } | { name: string }[] | null;
  subcategory: { name: string } | { name: string }[] | null;
  variants: Array<{
    name: string;
    sku: string | null;
    is_active: boolean | null;
  }> | null;
};

function unwrapRelation<T extends { name: string }>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapBackfillRow(row: ProductBackfillRow): ProductSearchFieldsInput {
  return {
    product_type: row.product_type,
    name: row.name,
    short_description: row.short_description,
    description: row.description,
    marketing_tagline: row.marketing_tagline,
    sku: row.sku,
    brand: row.brand,
    tags: row.tags,
    key_features: row.key_features,
    search_keywords: row.search_keywords,
    category: unwrapRelation(row.category),
    subcategory: unwrapRelation(row.subcategory),
    variants: row.variants || [],
  };
}

function isMissingSearchColumnsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('search_keywords') ||
    message.includes('normalized_search_text') ||
    message.includes('column') ||
    message.includes('does not exist')
  );
}

/**
 * Regenerate search_keywords + normalized_search_text for all products (admin only).
 * Does not change prices, images, stock, variants, bundles, or active status.
 */
export async function regenerateAllProductSearchFields(
  accessToken: string | null
): Promise<ActionResult<SearchBackfillResult>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const { count, error: countError } = await (adminClient.from('products') as any).select('id', {
      count: 'exact',
      head: true,
    });

    if (countError) {
      throw countError;
    }

    const totalExpected = count || 0;
    let offset = 0;
    let updated = 0;
    let failed = 0;
    let processed = 0;

    while (true) {
      const { data, error } = await (adminClient.from('products') as any)
        .select(
          `
          id,
          product_type,
          name,
          short_description,
          description,
          marketing_tagline,
          sku,
          brand,
          tags,
          key_features,
          search_keywords,
          category:categories(name),
          subcategory:subcategories(name),
          variants:product_variants(name, sku, is_active)
        `
        )
        .order('created_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        if (isMissingSearchColumnsError(error)) {
          return {
            success: false,
            error: 'حقول البحث غير موجودة بعد. طبّق migration 14 أولًا.',
          };
        }
        throw error;
      }

      const rows = (data || []) as ProductBackfillRow[];
      if (rows.length === 0) break;

      for (const row of rows) {
        processed += 1;
        const fields = buildProductSearchFields(mapBackfillRow(row));

        const { error: updateError } = await (adminClient.from('products') as any)
          .update({
            search_keywords: fields.search_keywords,
            normalized_search_text: fields.normalized_search_text,
          })
          .eq('id', row.id);

        if (updateError) {
          if (isMissingSearchColumnsError(updateError)) {
            return {
              success: false,
              error: 'حقول البحث غير موجودة بعد. طبّق migration 14 أولًا.',
            };
          }
          failed += 1;
          continue;
        }

        updated += 1;
      }

      if (rows.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    revalidatePath('/products');
    revalidatePath('/admin/products');

    return {
      success: true,
      data: {
        updated,
        total: totalExpected || processed,
        failed,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHORIZED') {
        return { success: false, error: 'يجب تسجيل الدخول أولًا' };
      }
      if (error.message === 'FORBIDDEN') {
        return { success: false, error: 'ليس لديك صلاحية تنفيذ هذه العملية' };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    };
  }
}
