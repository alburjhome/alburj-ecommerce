'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminActionClient } from '@/lib/admin-auth';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface StoreSettingsRecord {
  id: string;
  store_name: string;
  store_description: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  snapchat_url: string | null;
  youtube_url: string | null;
  currency: string;
  currency_symbol: string;
  free_shipping_threshold: number | null;
  min_order_amount: number | null;
  maintenance_mode: boolean;
  created_at: string;
  updated_at: string;
}

const nullableText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().nullable()
);

const nullableNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : value),
  z.coerce.number().min(0, 'القيمة يجب ألا تقل عن صفر').nullable()
);

const nullableUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .refine((val) => val === null || val.startsWith('http://') || val.startsWith('https://'), {
      message: 'يجب أن يبدأ الرابط بـ http:// أو https://',
    })
    .nullable()
);

const settingsSchema = z.object({
  store_name: z.string().trim().min(1, 'اسم المتجر مطلوب'),
  store_description: nullableText,
  whatsapp_number: nullableText,
  contact_email: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().email('البريد الإلكتروني غير صالح').nullable()
  ),
  contact_phone: nullableText,
  address: nullableText,
  facebook_url: nullableUrl,
  instagram_url: nullableUrl,
  tiktok_url: nullableUrl,
  snapchat_url: nullableUrl,
  youtube_url: nullableUrl,
  currency: z.string().trim().min(1, 'العملة مطلوبة'),
  currency_symbol: z.string().trim().min(1, 'رمز العملة مطلوب'),
  free_shipping_threshold: nullableNumber,
  min_order_amount: nullableNumber,
  maintenance_mode: z.boolean(),
});

export type StoreSettingsInput = z.infer<typeof settingsSchema>;

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logSettingsError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-settings:${action}] ${message}`);
}

export async function getAdminStoreSettings(
  accessToken: string | null
): Promise<ActionResult<StoreSettingsRecord>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data, error } = await (adminClient.from('store_settings') as any)
      .select(
        'id, store_name, store_description, whatsapp_number, contact_email, contact_phone, address, facebook_url, instagram_url, tiktok_url, snapchat_url, youtube_url, currency, currency_symbol, free_shipping_threshold, min_order_amount, maintenance_mode, created_at, updated_at'
      )
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) throw error || new Error('إعدادات المتجر غير موجودة');

    return { success: true, data: data as StoreSettingsRecord };
  } catch (error) {
    logSettingsError('getAdminStoreSettings', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminStoreSettings(
  accessToken: string | null,
  settingsId: string,
  input: StoreSettingsInput
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = settingsSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من حقول الإعدادات المطلوبة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { error } = await (adminClient.from('store_settings') as any)
      .update(parsed.data)
      .eq('id', settingsId);

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/products');
    revalidatePath('/categories');
    revalidatePath('/category/[slug]');
    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error) {
    logSettingsError('updateAdminStoreSettings', error);
    return { success: false, error: friendlyError(error) };
  }
}
