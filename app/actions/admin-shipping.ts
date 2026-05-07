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

export interface ShippingRateRecord {
  id: string;
  governorate: string;
  governorate_en: string;
  rate: number;
  free_shipping_threshold: number | null;
  is_active: boolean;
  estimated_days: number;
  created_at: string;
  updated_at: string;
}

const shippingRateSchema = z.object({
  rate: z.coerce.number().min(0, 'سعر الشحن يجب ألا يقل عن صفر'),
  free_shipping_threshold: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    z.coerce.number().min(0, 'حد الشحن المجاني يجب ألا يقل عن صفر').nullable()
  ),
  estimated_days: z.coerce
    .number()
    .int('عدد الأيام يجب أن يكون رقمًا صحيحًا')
    .min(1, 'عدد الأيام يجب ألا يقل عن يوم واحد')
    .max(30, 'عدد الأيام كبير جدًا'),
  is_active: z.boolean(),
});

export type ShippingRateInput = z.infer<typeof shippingRateSchema>;

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logShippingError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-shipping:${action}] ${message}`);
}

export async function getAdminShippingRates(
  accessToken: string | null
): Promise<ActionResult<ShippingRateRecord[]>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { data, error } = await (adminClient.from('shipping_rates') as any)
      .select('*')
      .order('governorate_en', { ascending: true });

    if (error) throw error;

    return { success: true, data: (data || []) as ShippingRateRecord[] };
  } catch (error) {
    logShippingError('getAdminShippingRates', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminShippingRate(
  accessToken: string | null,
  shippingRateId: string,
  input: ShippingRateInput
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = shippingRateSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من حقول الشحن المطلوبة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const payload = {
      rate: parsed.data.rate,
      free_shipping_threshold: parsed.data.free_shipping_threshold,
      estimated_days: parsed.data.estimated_days,
      is_active: parsed.data.is_active,
    };

    const { error } = await (adminClient.from('shipping_rates') as any)
      .update(payload)
      .eq('id', shippingRateId);

    if (error) throw error;

    revalidatePath('/admin/shipping');
    return { success: true };
  } catch (error) {
    logShippingError('updateAdminShippingRate', error);
    return { success: false, error: friendlyError(error) };
  }
}
