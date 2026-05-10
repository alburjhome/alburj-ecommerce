'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminActionClient } from '@/lib/admin-auth';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export type BannerPosition = 'home_hero' | 'home_middle' | 'home_bottom' | 'category_page';

export interface BannerRecord {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  position: BannerPosition;
  is_active: boolean;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

const BANNERS_BUCKET = 'banners';
const MAX_BANNER_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_BANNER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const bannerSchema = z.object({
  title: z.string().trim().min(1, 'عنوان البانر مطلوب'),
  subtitle: z.string().trim().nullable(),
  image_url: z.string().trim().min(1, 'صورة البانر مطلوبة'),
  mobile_image_url: z.string().trim().nullable(),
  link_url: z.string().trim().nullable(),
  position: z.enum(['home_hero', 'home_middle', 'home_bottom', 'category_page']),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0, 'الترتيب يجب ألا يقل عن صفر'),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logBannerError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-banners:${action}] ${message}`);
}

function nullableText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function booleanFromForm(value: FormDataEntryValue | null) {
  return value === 'true' || value === 'on';
}

function normalizeDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('تاريخ البانر غير صالح');
  }

  return date.toISOString();
}

function extensionFromMime(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
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

  return `${baseName || 'banner'}.${extension}`;
}

function getStoragePathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${BANNERS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const path = url.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

async function uploadBannerFile(
  adminClient: Awaited<ReturnType<typeof createAdminActionClient>>,
  file: File
) {
  if (!ALLOWED_BANNER_IMAGE_TYPES.has(file.type)) {
    throw new Error('نوع صورة البانر غير مدعوم. استخدم JPG أو PNG أو WEBP');
  }

  if (file.size > MAX_BANNER_IMAGE_SIZE) {
    throw new Error('حجم صورة البانر يجب ألا يتجاوز 10MB');
  }

  const path = `${randomUUID()}-${sanitizeFileName(file)}`;
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const { error } = await adminClient.storage.from(BANNERS_BUCKET).upload(path, fileBytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = adminClient.storage.from(BANNERS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

function bannerPayloadFromForm(formData: FormData, imageUrl: string, mobileImageUrl: string | null) {
  const payload = {
    title: String(formData.get('title') || ''),
    subtitle: nullableText(formData.get('subtitle')),
    image_url: imageUrl,
    mobile_image_url: mobileImageUrl,
    link_url: nullableText(formData.get('link_url')),
    position: String(formData.get('position') || 'home_hero'),
    is_active: booleanFromForm(formData.get('is_active')),
    sort_order: Number(formData.get('sort_order') || 0),
    start_date: normalizeDate(formData.get('start_date')),
    end_date: normalizeDate(formData.get('end_date')),
  };

  const parsed = bannerSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false as const, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (parsed.data.start_date && parsed.data.end_date) {
    const start = new Date(parsed.data.start_date).getTime();
    const end = new Date(parsed.data.end_date).getTime();
    if (end < start) {
      throw new Error('تاريخ نهاية البانر يجب أن يكون بعد تاريخ البداية');
    }
  }

  return { success: true as const, data: parsed.data };
}

async function getNextBannerSortOrder(
  adminClient: Awaited<ReturnType<typeof createAdminActionClient>>,
  position: BannerPosition
) {
  const { data, error } = await (adminClient.from('banners') as any)
    .select('sort_order')
    .eq('position', position)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (error) throw error;
  return Number(data?.[0]?.sort_order || 0) + 10;
}

export async function getAdminBanners(accessToken: string | null): Promise<ActionResult<BannerRecord[]>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data, error } = await (adminClient.from('banners') as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data || []) as BannerRecord[] };
  } catch (error) {
    logBannerError('getAdminBanners', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function createAdminBanner(
  accessToken: string | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let uploadedPath: string | null = null;
  let uploadedMobilePath: string | null = null;

  try {
    const adminClient = await createAdminActionClient(accessToken);
    const file = formData.get('image_file');
    const mobileFile = formData.get('mobile_image_file');
    let imageUrl = nullableText(formData.get('image_url'));
    let mobileImageUrl = nullableText(formData.get('mobile_image_url'));

    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadBannerFile(adminClient, file);
      uploadedPath = uploaded.path;
      imageUrl = uploaded.publicUrl;
    }

    if (mobileFile instanceof File && mobileFile.size > 0) {
      const uploaded = await uploadBannerFile(adminClient, mobileFile);
      uploadedMobilePath = uploaded.path;
      mobileImageUrl = uploaded.publicUrl;
    }

    if (!imageUrl) {
      throw new Error('أضف رابط صورة أو ارفع صورة للبانر');
    }

    const parsed = bannerPayloadFromForm(formData, imageUrl, mobileImageUrl);
    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من حقول البانر المطلوبة',
        fieldErrors: parsed.fieldErrors,
      };
    }

    if (parsed.data.sort_order <= 0) {
      parsed.data.sort_order = await getNextBannerSortOrder(adminClient, parsed.data.position);
    }

    const { data, error } = await (adminClient.from('banners') as any)
      .insert(parsed.data)
      .select('id')
      .single();

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/admin/banners');
    return { success: true, data: data ? { id: data.id } : undefined };
  } catch (error) {
    if (uploadedPath || uploadedMobilePath) {
      try {
        const adminClient = await createAdminActionClient(accessToken);
        const paths = [uploadedPath, uploadedMobilePath].filter(Boolean) as string[];
        if (paths.length) {
          await adminClient.storage.from(BANNERS_BUCKET).remove(paths);
        }
      } catch {
        // Best effort cleanup only.
      }
    }

    logBannerError('createAdminBanner', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminBanner(
  accessToken: string | null,
  bannerId: string,
  formData: FormData
): Promise<ActionResult> {
  let uploadedPath: string | null = null;
  let uploadedMobilePath: string | null = null;

  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data: currentBanner, error: currentError } = await (adminClient.from('banners') as any)
      .select('id, image_url, mobile_image_url')
      .eq('id', bannerId)
      .single();

    if (currentError || !currentBanner) throw currentError || new Error('البانر غير موجود');

    const file = formData.get('image_file');
    const mobileFile = formData.get('mobile_image_file');
    let imageUrl = nullableText(formData.get('image_url')) || currentBanner.image_url;
    let mobileImageUrl = nullableText(formData.get('mobile_image_url')) ?? currentBanner.mobile_image_url;

    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadBannerFile(adminClient, file);
      uploadedPath = uploaded.path;
      imageUrl = uploaded.publicUrl;
    }

    if (mobileFile instanceof File && mobileFile.size > 0) {
      const uploaded = await uploadBannerFile(adminClient, mobileFile);
      uploadedMobilePath = uploaded.path;
      mobileImageUrl = uploaded.publicUrl;
    }

    const parsed = bannerPayloadFromForm(formData, imageUrl, mobileImageUrl);
    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من حقول البانر المطلوبة',
        fieldErrors: parsed.fieldErrors,
      };
    }

    const { error } = await (adminClient.from('banners') as any)
      .update(parsed.data)
      .eq('id', bannerId);

    if (error) throw error;

    if (uploadedPath) {
      const oldPath = getStoragePathFromPublicUrl(currentBanner.image_url);
      if (oldPath) {
        await adminClient.storage.from(BANNERS_BUCKET).remove([oldPath]);
      }
    }

    if (uploadedMobilePath && currentBanner.mobile_image_url) {
      const oldMobilePath = getStoragePathFromPublicUrl(currentBanner.mobile_image_url);
      if (oldMobilePath) {
        await adminClient.storage.from(BANNERS_BUCKET).remove([oldMobilePath]);
      }
    }

    revalidatePath('/');
    revalidatePath('/admin/banners');
    return { success: true };
  } catch (error) {
    if (uploadedPath || uploadedMobilePath) {
      try {
        const adminClient = await createAdminActionClient(accessToken);
        const paths = [uploadedPath, uploadedMobilePath].filter(Boolean) as string[];
        if (paths.length) {
          await adminClient.storage.from(BANNERS_BUCKET).remove(paths);
        }
      } catch {
        // Best effort cleanup only.
      }
    }

    logBannerError('updateAdminBanner', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function toggleAdminBannerActive(
  accessToken: string | null,
  bannerId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { error } = await (adminClient.from('banners') as any)
      .update({ is_active: isActive })
      .eq('id', bannerId);

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/admin/banners');
    return { success: true };
  } catch (error) {
    logBannerError('toggleAdminBannerActive', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function deleteAdminBanner(accessToken: string | null, bannerId: string): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data: banner, error: bannerError } = await (adminClient.from('banners') as any)
      .select('id, image_url, mobile_image_url')
      .eq('id', bannerId)
      .single();

    if (bannerError || !banner) throw bannerError || new Error('البانر غير موجود');

    const storagePath = getStoragePathFromPublicUrl(banner.image_url);
    const mobileStoragePath = banner.mobile_image_url ? getStoragePathFromPublicUrl(banner.mobile_image_url) : null;
    const pathsToRemove = [storagePath, mobileStoragePath].filter(Boolean) as string[];
    if (pathsToRemove.length) {
      const { error: storageError } = await adminClient.storage.from(BANNERS_BUCKET).remove(pathsToRemove);
      if (storageError) throw storageError;
    }

    const { error } = await (adminClient.from('banners') as any).delete().eq('id', bannerId);
    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/admin/banners');
    return { success: true };
  } catch (error) {
    logBannerError('deleteAdminBanner', error);
    return { success: false, error: friendlyError(error) };
  }
}
