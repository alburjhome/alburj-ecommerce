'use server';

import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';
import { getProductSurfaceRecord, revalidateProductSurfaces } from '@/lib/revalidate-product-surfaces';

export interface AdminBundleVariantOption {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  options: Record<string, string> | null;
  values?: Array<{
    id: string;
    option_id: string;
    option_value_id: string;
    option?: { id: string; name: string } | null;
    option_value?: { id: string; value: string } | null;
  }>;
}

export interface AdminBundleProductOption {
  id: string;
  name: string;
  slug: string;
  price: number;
  is_active: boolean;
  product_type: 'single' | 'bundle';
  stock_quantity: number;
  track_stock: boolean;
  allow_backorders: boolean;
  images?: Array<{
    id: string;
    url: string;
    is_primary: boolean;
    sort_order: number;
  }>;
  variants?: AdminBundleVariantOption[];
}

export interface AdminBundleItemRow {
  id: string;
  bundle_product_id: string;
  item_product_id: string;
  item_variant_id: string | null;
  quantity: number;
  sort_order: number;
  is_required: boolean;
  item_product?: AdminBundleProductOption | null;
  item_variant?: AdminBundleVariantOption | null;
}

export interface AdminBundleEditorData {
  products: AdminBundleProductOption[];
  bundleItems: AdminBundleItemRow[];
}

export interface AdminBundleItemInput {
  item_product_id: string;
  item_variant_id?: string | null;
  quantity: number;
  sort_order?: number;
}

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return 'لا يمكن إضافة نفس المنتج أو المتغير مرتين داخل نفس الباكج';
    }
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function normalizeVariantOptions(variant: AdminBundleVariantOption | null | undefined) {
  if (!variant) return null;
  if (variant.options && Object.keys(variant.options).length > 0) return variant.options;

  const entries = (variant.values || [])
    .map((value) => {
      const name = value.option?.name;
      const optionValue = value.option_value?.value;
      return name && optionValue ? [name, optionValue] : null;
    })
    .filter(Boolean) as Array<[string, string]>;

  return entries.length ? Object.fromEntries(entries) : null;
}

function hasVariants(product: AdminBundleProductOption | null | undefined) {
  return Boolean(product?.variants?.some((variant) => variant.is_active));
}

async function fetchBundleItems(adminClient: Awaited<ReturnType<typeof createAdminActionClient>>, productId: string) {
  const { data, error } = await (adminClient.from('bundle_items') as any)
    .select(`
      *,
      item_product:products!bundle_items_item_product_id_fkey(
        id,
        name,
        slug,
        price,
        is_active,
        product_type,
        stock_quantity,
        track_stock,
        allow_backorders,
        images:product_images(id, url, is_primary, sort_order),
        variants:product_variants(
          id,
          product_id,
          name,
          sku,
          price,
          stock_quantity,
          track_stock,
          is_active,
          options,
          values:product_variant_values(
            id,
            option_id,
            option_value_id,
            option:product_options(id, name),
            option_value:product_option_values(id, value)
          )
        )
      ),
      item_variant:product_variants!bundle_items_item_variant_id_fkey(
        id,
        product_id,
        name,
        sku,
        price,
        stock_quantity,
        track_stock,
        is_active,
        options,
        values:product_variant_values(
          id,
          option_id,
          option_value_id,
          option:product_options(id, name),
          option_value:product_option_values(id, value)
        )
      )
    `)
    .eq('bundle_product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as AdminBundleItemRow[];
}

export async function getAdminBundleEditorData(
  accessToken: string | null,
  productId?: string
): Promise<ActionResult<AdminBundleEditorData>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const [productsResult, bundleItems] = await Promise.all([
      (adminClient.from('products') as any)
        .select(`
          id,
          name,
          slug,
          price,
          is_active,
          product_type,
          stock_quantity,
          track_stock,
          allow_backorders,
          images:product_images(id, url, is_primary, sort_order),
          variants:product_variants(
            id,
            product_id,
            name,
            sku,
            price,
            stock_quantity,
            track_stock,
            is_active,
            options,
            values:product_variant_values(
              id,
              option_id,
              option_value_id,
              option:product_options(id, name),
              option_value:product_option_values(id, value)
            )
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      productId ? fetchBundleItems(adminClient, productId) : Promise.resolve([]),
    ]);

    if (productsResult.error) throw productsResult.error;

    const products = ((productsResult.data || []) as AdminBundleProductOption[]).map((product) => ({
      ...product,
      product_type: product.product_type || 'single',
      images: [...(product.images || [])].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.sort_order - b.sort_order;
      }),
      variants: [...(product.variants || [])]
        .filter((variant) => variant.is_active)
        .map((variant) => ({
          ...variant,
          options: normalizeVariantOptions(variant),
        })),
    }));

    return {
      success: true,
      data: {
        products,
        bundleItems: bundleItems.map((item) => ({
          ...item,
          item_product: item.item_product
            ? {
                ...item.item_product,
                product_type: item.item_product.product_type || 'single',
                variants: (item.item_product.variants || []).map((variant) => ({
                  ...variant,
                  options: normalizeVariantOptions(variant),
                })),
              }
            : null,
          item_variant: item.item_variant
            ? {
                ...item.item_variant,
                options: normalizeVariantOptions(item.item_variant),
              }
            : null,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: friendlyError(error) };
  }
}

export async function saveAdminBundleItems(
  accessToken: string | null,
  bundleProductId: string,
  items: AdminBundleItemInput[]
): Promise<ActionResult<AdminBundleItemRow[]>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const { data: bundleProduct, error: bundleError } = await (adminClient.from('products') as any)
      .select('id, slug, product_type')
      .eq('id', bundleProductId)
      .single();

    if (bundleError || !bundleProduct) throw bundleError || new Error('الباكج غير موجود');
    if ((bundleProduct.product_type || 'single') !== 'bundle') {
      const { error: typeUpdateError } = await (adminClient.from('products') as any)
        .update({ product_type: 'bundle' })
        .eq('id', bundleProductId);
      if (typeUpdateError) throw typeUpdateError;
    }

    const normalizedItems = items
      .map((item, index) => ({
        item_product_id: item.item_product_id,
        item_variant_id: item.item_variant_id || null,
        quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
        sort_order: item.sort_order ?? (index + 1) * 10,
      }))
      .filter((item) => item.item_product_id);

    if (normalizedItems.length === 0) {
      const { error } = await adminClient.from('bundle_items').delete().eq('bundle_product_id', bundleProductId);
      if (error) throw error;
      await revalidateProductSurfaces({ accessToken, productId: bundleProductId });
      revalidatePath(`/admin/products/${bundleProductId}/edit`);
      return { success: true, data: [] };
    }

    const seen = new Set<string>();
    for (const item of normalizedItems) {
      if (item.item_product_id === bundleProductId) {
        throw new Error('لا يمكن إضافة الباكج داخل نفسه');
      }

      const key = `${item.item_product_id}:${item.item_variant_id || 'default'}`;
      if (seen.has(key)) {
        throw new Error('لا يمكن إضافة نفس المنتج أو المتغير مرتين داخل نفس الباكج');
      }
      seen.add(key);
    }

    const productIds = Array.from(new Set(normalizedItems.map((item) => item.item_product_id)));
    const variantIds = normalizedItems.map((item) => item.item_variant_id).filter(Boolean) as string[];

    const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
      (adminClient.from('products') as any)
        .select('id, name, is_active, variants:product_variants(id, is_active)')
        .in('id', productIds),
      variantIds.length
        ? (adminClient.from('product_variants') as any)
            .select('id, product_id, is_active')
            .in('id', variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (productsError) throw productsError;
    if (variantsError) throw variantsError;

    const productMap = new Map<string, { id: string; is_active: boolean; variants?: Array<{ is_active: boolean }> }>(
      ((products || []) as Array<{ id: string; is_active: boolean; variants?: Array<{ is_active: boolean }> }>).map((product) => [product.id, product])
    );
    const variantMap = new Map<string, { id: string; product_id: string; is_active: boolean }>(
      ((variants || []) as Array<{ id: string; product_id: string; is_active: boolean }>).map((variant) => [variant.id, variant])
    );

    for (const item of normalizedItems) {
      const product = productMap.get(item.item_product_id);
      if (!product || !product.is_active) {
        throw new Error('لا يمكن إضافة منتج غير نشط داخل الباكج');
      }

      const productHasVariants = Array.isArray(product.variants)
        && product.variants.some((variant: { is_active: boolean }) => variant.is_active);

      if (productHasVariants && !item.item_variant_id) {
        throw new Error('هذا المنتج يحتوي متغيرات، اختر متغيرًا محددًا داخل الباكج');
      }

      if (item.item_variant_id) {
        const variant = variantMap.get(item.item_variant_id);
        if (!variant || variant.product_id !== item.item_product_id || !variant.is_active) {
          throw new Error('المتغير المختار غير صالح أو غير نشط');
        }
      }
    }

    const before = await getProductSurfaceRecord(accessToken, bundleProductId);
    const { error: deleteError } = await adminClient
      .from('bundle_items')
      .delete()
      .eq('bundle_product_id', bundleProductId);

    if (deleteError) throw deleteError;

    const { error: insertError } = await (adminClient.from('bundle_items') as any).insert(
      normalizedItems.map((item) => ({
        bundle_product_id: bundleProductId,
        item_product_id: item.item_product_id,
        item_variant_id: item.item_variant_id,
        quantity: item.quantity,
        sort_order: item.sort_order,
        is_required: true,
      }))
    );

    if (insertError) throw insertError;

    await revalidateProductSurfaces({
      accessToken,
      productId: bundleProductId,
      before,
      after: null,
    });
    revalidatePath(`/product/${bundleProduct.slug}`);
    revalidatePath(`/admin/products/${bundleProductId}/edit`);

    return {
      success: true,
      data: await fetchBundleItems(adminClient, bundleProductId),
    };
  } catch (error) {
    return { success: false, error: friendlyError(error) };
  }
}
