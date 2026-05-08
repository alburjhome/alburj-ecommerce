import Link from 'next/link';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';
import { getWhatsAppLink } from '@/lib/store-settings';
import type { Category, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'الأقسام',
  description: 'تصفح أقسام متجر مؤسسة البرج.',
};

async function getSettings() {
  const { data } = await supabase
    .from('store_settings')
    .select(
      'store_name, store_description, whatsapp_number, contact_email, contact_phone, address, facebook_url, instagram_url, tiktok_url, snapchat_url, youtube_url'
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as Pick<
    StoreSettings,
    | 'store_name'
    | 'store_description'
    | 'whatsapp_number'
    | 'contact_email'
    | 'contact_phone'
    | 'address'
    | 'facebook_url'
    | 'instagram_url'
    | 'tiktok_url'
    | 'snapchat_url'
    | 'youtube_url'
  > | null;
}

async function getCategories() {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (data || []) as Category[];
}

export default async function CategoriesPage() {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">الكتالوج</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">الأقسام</h1>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="group overflow-hidden rounded-lg border bg-card"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <SafeImage
                    src={safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY)}
                    fallbackSrc={PLACEHOLDER_CATEGORY}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    priority={index < 4}
                  />
                </div>
                <div className="p-4">
                  <h2 className="font-semibold">{category.name}</h2>
                  {category.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-16 text-center">
            <h2 className="text-lg font-semibold">لا توجد أقسام حالياً</h2>
          </div>
        )}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
