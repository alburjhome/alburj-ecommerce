import { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { getWhatsAppLink } from '@/lib/store-settings';
import type { StoreSettings } from '@/types';
import { QuickOrderForm } from '@/features/store/components/quick-order-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'جهّز طلبك خلال دقيقة',
  description: 'اختر احتياجك وسنساعدك بتجهيز الطلب المناسب عبر واتساب.',
};

async function getSettings() {
  const { data } = await supabase
    .from('store_settings')
    .select('store_name, whatsapp_number')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as Pick<StoreSettings, 'store_name' | 'whatsapp_number'> | null;
}

export default async function QuickOrderPage() {
  const settings = await getSettings();
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header whatsappUrl={whatsappUrl} />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">جهّز طلبك خلال دقيقة</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              اختر احتياجك وسنساعدك بتجهيز الطلب المناسب عبر واتساب.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <QuickOrderForm whatsappNumber={settings?.whatsapp_number ?? null} />
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            <Link href="/products" className="underline underline-offset-4">
              أو تصفح المنتجات
            </Link>
          </div>
        </div>
      </main>
      <Footer settings={settings as any} />
    </div>
  );
}
