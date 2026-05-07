'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type AdminImageBucket = 'categories' | 'banners';

const BUCKETS: Record<AdminImageBucket, { maxSize: number; routes: string[] }> = {
  categories: {
    maxSize: 5 * 1024 * 1024,
    routes: ['/', '/categories', '/admin/categories', '/admin/subcategories'],
  },
  banners: {
    maxSize: 10 * 1024 * 1024,
    routes: ['/', '/admin/banners'],
  },
};

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولاً';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logAdminImageFieldError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-images:${action}] ${message}`);
}

function assertBucket(bucket: string): AdminImageBucket {
  if (bucket !== 'categories' && bucket !== 'banners') {
    throw new Error('وجهة رفع الصورة غير مدعومة');
  }

  return bucket;
}

function extensionFromMime(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

function sanitizeSegment(value: string | null | undefined, fallback: string) {
  const segment = value
    ?.toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 120);

  return segment || fallback;
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

  return `${baseName || 'image'}.${extension}`;
}

function getStoragePathFromPublicUrl(bucket: AdminImageBucket, url: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const path = url.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

function revalidateBucketRoutes(bucket: AdminImageBucket) {
  for (const route of BUCKETS[bucket].routes) {
    revalidatePath(route);
  }
}

export async function uploadAdminImageField(
  accessToken: string | null,
  input: { bucket: AdminImageBucket; folder?: string | null },
  formData: FormData
): Promise<ActionResult<{ url: string; path: string }>> {
  try {
    const bucket = assertBucket(input.bucket);
    const adminClient = await createAdminActionClient(accessToken);
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      throw new Error('اختر صورة صالحة للرفع');
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF');
    }

    if (file.size > BUCKETS[bucket].maxSize) {
      throw new Error(`حجم الصورة يجب ألا يتجاوز ${BUCKETS[bucket].maxSize / 1024 / 1024}MB`);
    }

    const folder = sanitizeSegment(input.folder, bucket);
    const path = `${folder}/${randomUUID()}-${sanitizeFileName(file)}`;
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const { error } = await adminClient.storage.from(bucket).upload(path, fileBytes, {
      contentType: file.type,
      upsert: false,
    });

    if (error) throw error;

    const { data } = adminClient.storage.from(bucket).getPublicUrl(path);
    revalidateBucketRoutes(bucket);

    return { success: true, data: { url: data.publicUrl, path } };
  } catch (error) {
    logAdminImageFieldError('uploadAdminImageField', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function deleteAdminImageField(
  accessToken: string | null,
  input: { bucket: AdminImageBucket; url: string }
): Promise<ActionResult> {
  try {
    const bucket = assertBucket(input.bucket);
    const adminClient = await createAdminActionClient(accessToken);
    const storagePath = getStoragePathFromPublicUrl(bucket, input.url);

    if (storagePath) {
      const { error } = await adminClient.storage.from(bucket).remove([storagePath]);
      if (error) throw error;
    }

    revalidateBucketRoutes(bucket);
    return { success: true };
  } catch (error) {
    logAdminImageFieldError('deleteAdminImageField', error);
    return { success: false, error: friendlyError(error) };
  }
}
