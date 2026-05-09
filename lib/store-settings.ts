import { supabase } from '@/lib/supabase';

export interface PublicStoreSettings {
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
  meta_pixel_id: string | null;
  ga4_measurement_id: string | null;
}

export async function getPublicStoreSettings(): Promise<PublicStoreSettings> {
  const { data, error } = await supabase
    .from('store_settings')
    .select(
      'store_name, store_description, whatsapp_number, contact_email, contact_phone, address, facebook_url, instagram_url, tiktok_url, snapchat_url, youtube_url, meta_pixel_id, ga4_measurement_id'
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      store_name: 'مؤسسة البرج',
      store_description: null,
      whatsapp_number: null,
      contact_email: null,
      contact_phone: null,
      address: null,
      facebook_url: null,
      instagram_url: null,
      tiktok_url: null,
      snapchat_url: null,
      youtube_url: null,
      meta_pixel_id: null,
      ga4_measurement_id: null,
    };
  }

  return data as PublicStoreSettings;
}

export function normalizeWhatsAppNumber(value: string | null | undefined): string | null {
  if (!value || value.includes('X')) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;

  if (normalized.length < 8 || normalized.length > 15) {
    return null;
  }

  return normalized;
}

export function getWhatsAppLink(number: string | null | undefined): string | null {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;
  return `https://wa.me/${normalized}`;
}
