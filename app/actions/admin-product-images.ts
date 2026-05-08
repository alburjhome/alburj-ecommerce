'use server';

import { randomUUID } from 'crypto';
import { createAdminActionClient } from '@/lib/admin-auth';
import { revalidateProductSurfaces } from '@/lib/revalidate-product-surfaces';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProductImageRecord {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

const PRODUCTS_BUCKET = 'products';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولاً';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logAdminImageError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-product-images:${action}] ${message}`);
}

function normalizeNullable(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSortOrder(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const order = Number(value);
  if (!Number.isInteger(order) || order < 0) {
    throw new Error('ترتيب الصورة يجب أن يكون رقماً صحيحاً لا يقل عن صفر');
  }

  return order;
}

function extensionFromMime(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

function sanitizeFileName(file: File) {
  const fallbackExtension = extensionFromMime(file.type);
  const parts = file.name.split('.');
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() || fallbackExtension : fallbackExtension;
  const baseName = parts
    .join('.')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${baseName || 'product-image'}.${extension}`;
}

function getStoragePathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${PRODUCTS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const path = url.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

async function ensureProductExists(adminClient: Awaited<ReturnType<typeof createAdminActionClient>>, productId: string) {
  const { error } = await adminClient.from('products').select('id').eq('id', productId).single();
  if (error) throw new Error('المنتج غير موجود');
}

async function normalizePrimaryImage(
  adminClient: Awaited<ReturnType<typeof createAdminActionClient>>,
  productId: string
) {
  const { data: images, error } = await (adminClient
    .from('product_images') as any)
    .select('id, is_primary')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!images?.length) return;

  const primaryImages = (images as Array<{ id: string; is_primary: boolean }>).filter((image) => image.is_primary);
  const primaryId = primaryImages[0]?.id || images[0].id;

  const { error: clearError } = await (adminClient
    .from('product_images') as any)
    .update({ is_primary: false })
    .eq('product_id', productId)
    .neq('id', primaryId);

  if (clearError) throw clearError;

  const { error: primaryError } = await (adminClient
    .from('product_images') as any)
    .update({ is_primary: true })
    .eq('id', primaryId);

  if (primaryError) throw primaryError;
}

async function getNextProductImageSortOrder(
  adminClient: Awaited<ReturnType<typeof createAdminActionClient>>,
  productId: string
) {
  const { data, error } = await (adminClient
    .from('product_images') as any)
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (error) throw error;
  return Number(data?.[0]?.sort_order || 0) + 10;
}

export async function getAdminProductImages(
  accessToken: string | null,
  productId: string
): Promise<ActionResult<ProductImageRecord[]>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    await ensureProductExists(adminClient, productId);

    const { data, error } = await (adminClient
      .from('product_images') as any)
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return { success: true, data: (data || []) as ProductImageRecord[] };
  } catch (error) {
    logAdminImageError('getAdminProductImages', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function uploadAdminProductImage(
  accessToken: string | null,
  productId: string,
  formData: FormData
): Promise<ActionResult<ProductImageRecord>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    await ensureProductExists(adminClient, productId);

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new Error('اختر صورة صالحة للرفع');
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error('حجم الصورة يجب ألا يتجاوز 5MB');
    }

    const altText = normalizeNullable(formData.get('alt_text'));
    const manualSortOrder = normalizeSortOrder(formData.get('sort_order'));
    const { data: existingImages, error: existingError } = await (adminClient
      .from('product_images') as any)
      .select('id')
      .eq('product_id', productId);

    if (existingError) throw existingError;

    const path = `${productId}/${randomUUID()}-${sanitizeFileName(file)}`;
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminClient.storage
      .from(PRODUCTS_BUCKET)
      .upload(path, fileBytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = adminClient.storage.from(PRODUCTS_BUCKET).getPublicUrl(path);
    const isPrimary = !existingImages?.length;

    const { data: image, error: insertError } = await (adminClient
      .from('product_images') as any)
      .insert({
        product_id: productId,
        url: publicUrlData.publicUrl,
        alt_text: altText,
        sort_order: manualSortOrder ?? await getNextProductImageSortOrder(adminClient, productId),
        is_primary: isPrimary,
      })
      .select('*')
      .single();

    if (insertError) {
      await adminClient.storage.from(PRODUCTS_BUCKET).remove([path]);
      throw insertError;
    }

    await normalizePrimaryImage(adminClient, productId);
    await revalidateProductSurfaces({ accessToken, productId, before: null, after: null });

    return { success: true, data: image as ProductImageRecord };
  } catch (error) {
    logAdminImageError('uploadAdminProductImage', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminProductImage(
  accessToken: string | null,
  imageId: string,
  input: { alt_text: string | null; sort_order: number }
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    if (!Number.isInteger(input.sort_order) || input.sort_order < 0) {
      throw new Error('ترتيب الصورة يجب أن يكون رقماً صحيحاً لا يقل عن صفر');
    }

    const { data: image, error: imageError } = await (adminClient
      .from('product_images') as any)
      .select('id, product_id')
      .eq('id', imageId)
      .single();

    if (imageError || !image) throw new Error('الصورة غير موجودة');

    const { error } = await (adminClient
      .from('product_images') as any)
      .update({
        alt_text: input.alt_text?.trim() || null,
        sort_order: input.sort_order,
      })
      .eq('id', imageId);

    if (error) throw error;

    await revalidateProductSurfaces({ accessToken, productId: image.product_id, before: null, after: null });
    return { success: true };
  } catch (error) {
    logAdminImageError('updateAdminProductImage', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function setAdminProductPrimaryImage(
  accessToken: string | null,
  imageId: string
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data: image, error: imageError } = await (adminClient
      .from('product_images') as any)
      .select('id, product_id')
      .eq('id', imageId)
      .single();

    if (imageError || !image) throw new Error('الصورة غير موجودة');

    const { error: clearError } = await (adminClient
      .from('product_images') as any)
      .update({ is_primary: false })
      .eq('product_id', image.product_id);

    if (clearError) throw clearError;

    const { error: primaryError } = await (adminClient
      .from('product_images') as any)
      .update({ is_primary: true })
      .eq('id', imageId);

    if (primaryError) throw primaryError;

    await revalidateProductSurfaces({ accessToken, productId: image.product_id, before: null, after: null });
    return { success: true };
  } catch (error) {
    logAdminImageError('setAdminProductPrimaryImage', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function deleteAdminProductImage(
  accessToken: string | null,
  imageId: string
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data: image, error: imageError } = await (adminClient
      .from('product_images') as any)
      .select('*')
      .eq('id', imageId)
      .single();

    if (imageError || !image) throw new Error('الصورة غير موجودة');

    const storagePath = getStoragePathFromPublicUrl(image.url);
    if (storagePath) {
      const { error: storageError } = await adminClient.storage.from(PRODUCTS_BUCKET).remove([storagePath]);
      if (storageError) throw storageError;
    }

    const { error: deleteError } = await (adminClient.from('product_images') as any).delete().eq('id', imageId);
    if (deleteError) throw deleteError;

    await normalizePrimaryImage(adminClient, image.product_id);

    await revalidateProductSurfaces({ accessToken, productId: image.product_id, before: null, after: null });
    return { success: true };
  } catch (error) {
    logAdminImageError('deleteAdminProductImage', error);
    return { success: false, error: friendlyError(error) };
  }
}
