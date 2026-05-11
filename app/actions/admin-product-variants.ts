'use server';

import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';
import { revalidateProductSurfaces } from '@/lib/revalidate-product-surfaces';

export interface ProductVariantOptionInput {
  id?: string;
  name: string;
  values: Array<{
    id?: string;
    value: string;
  }>;
}

export interface ProductVariantInput {
  id?: string;
  sku?: string | null;
  price: number;
  compare_price?: number | null;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  image_url?: string | null;
  option_value_ids: Record<string, string>;
}

export interface ProductVariantsPayload {
  options: ProductVariantOptionInput[];
  variants: ProductVariantInput[];
}

export interface AdminProductOptionRow {
  id: string;
  product_id: string;
  name: string;
  sort_order: number;
  values: Array<{
    id: string;
    option_id: string;
    value: string;
    sort_order: number;
  }>;
}

export interface AdminProductVariantRow {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  compare_price: number | null;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  image_url: string | null;
  sort_order: number;
  options: Record<string, string> | null;
  values: Array<{
    id: string;
    option_id: string;
    option_value_id: string;
    option?: { id: string; name: string } | null;
    option_value?: { id: string; value: string } | null;
  }>;
}

export interface ProductVariantsData {
  options: AdminProductOptionRow[];
  variants: AdminProductVariantRow[];
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
    if (error.message.includes('violates foreign key')) {
      return 'لا يمكن حذف متغير مرتبط بطلب سابق. عطّله بدل حذفه.';
    }
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function normalizeNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatVariantName(options: Record<string, string>) {
  const values = Object.values(options).filter(Boolean);
  return values.length ? values.join(' - ') : 'متغير المنتج';
}

function validatePayload(payload: ProductVariantsPayload) {
  if (!Array.isArray(payload.options) || !Array.isArray(payload.variants)) {
    throw new Error('بيانات المتغيرات غير صالحة');
  }

  const optionNames = new Set<string>();
  for (const option of payload.options) {
    const name = option.name.trim();
    if (!name) throw new Error('اسم الخيار مطلوب');
    const normalizedName = name.toLowerCase();
    if (optionNames.has(normalizedName)) throw new Error(`الخيار مكرر: ${name}`);
    optionNames.add(normalizedName);

    const values = option.values.map((item) => item.value.trim()).filter(Boolean);
    if (values.length === 0) throw new Error(`الخيار ${name} يحتاج قيمة واحدة على الأقل`);
    if (new Set(values.map((value) => value.toLowerCase())).size !== values.length) {
      throw new Error(`يوجد قيم مكررة داخل الخيار ${name}`);
    }
  }

  for (const variant of payload.variants) {
    if (variant.price < 0) throw new Error('سعر المتغير لا يمكن أن يكون أقل من صفر');
    if (variant.compare_price !== null && variant.compare_price !== undefined && variant.compare_price < 0) {
      throw new Error('السعر قبل الخصم لا يمكن أن يكون أقل من صفر');
    }
    if (!Number.isInteger(variant.stock_quantity) || variant.stock_quantity < 0) {
      throw new Error('مخزون المتغير يجب أن يكون رقمًا صحيحًا غير سالب');
    }
  }
}

export async function getAdminProductVariants(
  accessToken: string | null,
  productId: string
): Promise<ActionResult<ProductVariantsData>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);

    const [{ data: options, error: optionsError }, { data: variants, error: variantsError }] = await Promise.all([
      (adminClient.from('product_options') as any)
        .select('*, values:product_option_values(*)')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true }),
      (adminClient.from('product_variants') as any)
        .select(`
          *,
          values:product_variant_values(
            id,
            option_id,
            option_value_id,
            option:product_options(id, name),
            option_value:product_option_values(id, value)
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true }),
    ]);

    if (optionsError) throw optionsError;
    if (variantsError) throw variantsError;

    return {
      success: true,
      data: {
        options: (options || []).map((option: AdminProductOptionRow) => ({
          ...option,
          values: [...(option.values || [])].sort((a, b) => a.sort_order - b.sort_order),
        })),
        variants: (variants || []) as AdminProductVariantRow[],
      },
    };
  } catch (error) {
    return { success: false, error: friendlyError(error) };
  }
}

export async function saveAdminProductVariants(
  accessToken: string | null,
  productId: string,
  payload: ProductVariantsPayload
): Promise<ActionResult<ProductVariantsData>> {
  try {
    validatePayload(payload);
    const adminClient = await createAdminActionClient(accessToken);

    const { data: product, error: productError } = await adminClient
      .from('products')
      .select('id, slug')
      .eq('id', productId)
      .single<{ id: string; slug: string }>();

    if (productError || !product) {
      throw productError || new Error('المنتج غير موجود');
    }

    const { error: deleteOptionsError } = await adminClient
      .from('product_options')
      .delete()
      .eq('product_id', productId);

    if (deleteOptionsError) throw deleteOptionsError;

    const { error: deleteVariantsError } = await adminClient
      .from('product_variants')
      .delete()
      .eq('product_id', productId);

    if (deleteVariantsError) throw deleteVariantsError;

    if (payload.options.length === 0 || payload.variants.length === 0) {
      await revalidateProductSurfaces({ accessToken, productId });
      revalidatePath(`/admin/products/${productId}/edit`);
      return getAdminProductVariants(accessToken, productId);
    }

    const optionIdMap = new Map<string, string>();
    const valueIdMap = new Map<string, string>();

    for (let optionIndex = 0; optionIndex < payload.options.length; optionIndex += 1) {
      const optionInput = payload.options[optionIndex]!;
      const { data: option, error: optionError } = await (adminClient.from('product_options') as any)
        .insert({
          product_id: productId,
          name: optionInput.name.trim(),
          sort_order: (optionIndex + 1) * 10,
        })
        .select('id')
        .single();

      if (optionError || !option) throw optionError || new Error('تعذر إنشاء خيار المنتج');

      optionIdMap.set(optionInput.id || optionInput.name, option.id);

      const valuesToInsert = optionInput.values.map((valueInput: { id?: string; value: string }, valueIndex: number) => ({
        option_id: option.id,
        value: valueInput.value.trim(),
        sort_order: (valueIndex + 1) * 10,
      }));

      const { data: insertedValues, error: valuesError } = await (adminClient.from('product_option_values') as any)
        .insert(valuesToInsert)
        .select('id, value');

      if (valuesError || !insertedValues) throw valuesError || new Error('تعذر إنشاء قيم الخيار');

      const typedInsertedValues = insertedValues as Array<{ id: string; value: string }>;
      for (let valueIndex = 0; valueIndex < optionInput.values.length; valueIndex += 1) {
        const valueInput = optionInput.values[valueIndex]!;
        const inserted = typedInsertedValues[valueIndex];
        if (inserted) {
          valueIdMap.set(valueInput.id || `${optionInput.id || optionInput.name}:${valueInput.value}`, inserted.id);
        }
      }
    }

    for (let variantIndex = 0; variantIndex < payload.variants.length; variantIndex += 1) {
      const variantInput = payload.variants[variantIndex]!;
      const structuredOptions: Record<string, string> = {};
      const variantValueRows: Array<{
        option_id: string;
        option_value_id: string;
      }> = [];

      for (const optionInput of payload.options) {
        const optionKey = optionInput.id || optionInput.name;
        const newOptionId = optionIdMap.get(optionKey);
        const selectedOldValueId = variantInput.option_value_ids[optionKey] || variantInput.option_value_ids[optionInput.name];
        const selectedValue = optionInput.values.find(
          (valueInput) =>
            valueInput.id === selectedOldValueId ||
            `${optionKey}:${valueInput.value}` === selectedOldValueId ||
            valueInput.value === selectedOldValueId
        );

        if (!newOptionId || !selectedValue) {
          throw new Error('يوجد متغير ناقص القيم');
        }

        const valueKey = selectedValue.id || `${optionKey}:${selectedValue.value}`;
        const newValueId = valueIdMap.get(valueKey);
        if (!newValueId) throw new Error('تعذر ربط قيمة المتغير');

        structuredOptions[optionInput.name.trim()] = selectedValue.value.trim();
        variantValueRows.push({ option_id: newOptionId, option_value_id: newValueId });
      }

      const { data: variant, error: variantError } = await (adminClient.from('product_variants') as any)
        .insert({
          product_id: productId,
          name: formatVariantName(structuredOptions),
          sku: normalizeNullable(variantInput.sku),
          price: variantInput.price,
          compare_price: variantInput.compare_price ?? null,
          stock_quantity: variantInput.stock_quantity,
          track_stock: variantInput.track_stock,
          is_active: variantInput.is_active,
          image_url: normalizeNullable(variantInput.image_url),
          sort_order: (variantIndex + 1) * 10,
          options: structuredOptions,
        })
        .select('id')
        .single();

      if (variantError || !variant) throw variantError || new Error('تعذر إنشاء المتغير');

      const { error: variantValuesError } = await (adminClient.from('product_variant_values') as any).insert(
        variantValueRows.map((row) => ({
          variant_id: variant.id,
          ...row,
        }))
      );

      if (variantValuesError) throw variantValuesError;
    }

    await revalidateProductSurfaces({ accessToken, productId });
    revalidatePath(`/product/${product.slug}`);
    revalidatePath(`/admin/products/${productId}/edit`);

    return getAdminProductVariants(accessToken, productId);
  } catch (error) {
    return { success: false, error: friendlyError(error) };
  }
}
