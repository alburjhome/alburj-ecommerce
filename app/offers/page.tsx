import { Metadata } from 'next';
import Link from 'next/link';
import { BadgePercent, CreditCard, MessageCircle, ShieldCheck, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import { getWhatsAppLink } from '@/lib/store-settings';
import { TrackedWhatsAppLink } from '@/components/tracked-whatsapp-link';
import { getIntentConfig, normalizeIntent, productMatchesIntent, type ProductIntentKey } from '@/lib/product-intents';
import { PLACEHOLDER_BANNER } from '@/lib/image-utils';
import type { ProductWithDetails, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'عروض مؤسسة البرج | منتجات بلاستيكية ومنظفات وتغليف',
  description: 'تسوق عروض مؤسسة البرج على مستلزمات البيت والمحل، المنظفات، البلاستيكيات، التغليف والأدوات المنزلية.',
  alternates: {
    canonical: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/offers`,
  },
  openGraph: {
    title: 'عروض مؤسسة البرج | منتجات بلاستيكية ومنظفات وتغليف',
    description: 'تسوق عروض مؤسسة البرج على مستلزمات البيت والمحل، المنظفات، البلاستيكيات، التغليف والأدوات المنزلية.',
    url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/offers`,
    type: 'website',
    images: [
      {
        url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}${PLACEHOLDER_BANNER}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'عروض مؤسسة البرج | منتجات بلاستيكية ومنظفات وتغليف',
    description: 'تسوق عروض مؤسسة البرج على مستلزمات البيت والمحل، المنظفات، البلاستيكيات، التغليف والأدوات المنزلية.',
    images: [
      `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}${PLACEHOLDER_BANNER}`,
    ],
  },
};

interface OffersPageProps {
  searchParams?: { intent?: string };
}

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

function isOfferProduct(product: ProductWithDetails) {
  const hasDiscount = Boolean(product.compare_price && product.compare_price > product.price);
  const badges = (product as any).product_badges as string[] | null | undefined;
  const hasOfferBadge = Array.isArray(badges) && badges.includes('offer');
  return hasDiscount || hasOfferBadge || product.is_featured === true;
}

async function getOfferProducts() {
  const { data } = await (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500);

  const products = ((data || []) as ProductWithDetails[]).map((product) => ({
    ...product,
    variants: [],
    images: [...((product as any).images || [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  }));

  return products.filter(isOfferProduct);
}

function OfferTrustBar() {
  const items = [
    { icon: Truck, label: 'توصيل لجميع المحافظات' },
    { icon: CreditCard, label: 'الدفع عند الاستلام' },
    { icon: BadgePercent, label: 'عروض للكميات' },
    { icon: ShieldCheck, label: 'منتجات مختارة بعناية' },
  ];

  return (
    <section className="border-y bg-muted/40 py-3 md:py-4" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground md:text-sm"
            >
              <item.icon className="h-4 w-4 shrink-0 text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OffersBundlesSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const bundles = [
    { name: 'باقة تنظيف البيت', description: 'منظفات وورقيات أساسية للبيت بسعر موفّر.' },
    { name: 'باقة تجهيز مطعم', description: 'تغليف وورقيات للمطاعم والكافيهات مع اختيارات عملية.' },
    { name: 'باقة المحلات', description: 'مستلزمات يومية للمحلات بأسعار مناسبة.' },
    { name: 'باقة الكميات والعروض', description: 'خيارات للكميات بأسعار موفّرة للطلبات الكبيرة.' },
  ];

  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">باقات موفرة</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">باقات جاهزة لتسهيل اختيارك وتوفير الوقت.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((bundle) => {
            const message = `مرحبا، أريد الاستفسار عن:\n${bundle.name}\nمن صفحة العروض.`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={bundle.name} className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-bold leading-6">{bundle.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{bundle.description}</p>

                {href ? (
                  <TrackedWhatsAppLink
                    href={href}
                    source="offers_bundle"
                    metadata={{ bundle_name: bundle.name }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلب الباقة عبر واتساب
                  </TrackedWhatsAppLink>
                ) : (
                  <div className="mt-4 rounded-lg border bg-muted px-4 py-2.5 text-center text-sm text-muted-foreground">
                    رقم واتساب غير مُعدّل حاليًا
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const [settings, offerProducts] = await Promise.all([getSettings(), getOfferProducts()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  const selectedIntent = normalizeIntent((searchParams as any)?.intent) as ProductIntentKey;
  const intent = selectedIntent === 'all' ? 'all' : selectedIntent;

  const filterOptions: Array<{ key: ProductIntentKey; label: string }> = [
    { key: 'all', label: 'كل العروض' },
    { key: 'home', label: 'للبيت' },
    { key: 'restaurants', label: 'للمطاعم والمحلات' },
    { key: 'packaging', label: 'للتغليف' },
    { key: 'cleaning', label: 'للتنظيف' },
    { key: 'bulk', label: 'للكميات' },
  ];

  const filteredOffers =
    intent === 'all' ? offerProducts : offerProducts.filter((product) => productMatchesIntent(product, intent));

  const selectedConfig = getIntentConfig(intent);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />

      <main>
        <section className="bg-gradient-to-b from-primary/5 to-background py-10 md:py-14" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">عروض مؤسسة البرج</h1>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">
                منتجات مختارة بعروض وأسعار مناسبة للبيت والمحل.
              </p>

              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                {whatsappUrl ? (
                  <TrackedWhatsAppLink
                    href={whatsappUrl}
                    source="offers_hero_whatsapp"
                    metadata={{ cta_name: 'offers_hero' }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اسأل عن العروض عبر واتساب
                  </TrackedWhatsAppLink>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                    رقم واتساب غير مُعدّل حاليًا
                  </span>
                )}

                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  تصفح كل المنتجات
                </Link>
              </div>
              <div className="mt-3 flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
                <Link
                  href="/restaurants"
                  className="text-sm text-primary hover:underline"
                >
                  عروض المطاعم والكافيهات ←
                </Link>
                <Link
                  href="/plastic-products"
                  className="text-sm text-primary hover:underline"
                >
                  شاهد عروض البلاستيكيات ←
                </Link>
                <Link
                  href="/home-kitchen"
                  className="text-sm text-primary hover:underline"
                >
                  شاهد عروض البيت والمطبخ ←
                </Link>
                <Link
                  href="/cleaning"
                  className="text-sm text-primary hover:underline"
                >
                  شاهد عروض المنظفات والورقيات ←
                </Link>
                <Link
                  href="/bulk"
                  className="text-sm text-primary hover:underline"
                >
                  اطلب عروض الكميات والجملة ←
                </Link>
              </div>
            </div>
          </div>
        </section>

        <OfferTrustBar />

        <section className="py-8 md:py-10" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">صفحة العروض</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{selectedConfig.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">اختر تصنيف بسيط للوصول للعروض بسرعة.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {filterOptions.map((option) => {
                const active = intent === option.key;
                return (
                  <Link
                    key={option.key}
                    href={
                      option.key === 'all'
                        ? { pathname: '/offers' }
                        : { pathname: '/offers', query: { intent: option.key } }
                    }
                    className={
                      active
                        ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                        : 'rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted'
                    }
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>

            {filteredOffers.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {filteredOffers.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed px-4 py-14 text-center">
                <h3 className="text-lg font-semibold">لا توجد عروض مضافة حاليًا</h3>
                <p className="mt-2 text-sm text-muted-foreground">جرّب تصنيفًا آخر أو تواصل معنا لمعرفة عروض اليوم.</p>
                {whatsappUrl && (
                  <TrackedWhatsAppLink
                    href={whatsappUrl}
                    source="offers_hero_whatsapp"
                    metadata={{ cta_name: 'offers_empty' }}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    تواصل معنا لمعرفة عروض اليوم
                  </TrackedWhatsAppLink>
                )}
              </div>
            )}
          </div>
        </section>

        <OffersBundlesSection whatsappUrl={whatsappUrl} />
      </main>

      <Footer settings={settings} />
    </div>
  );
}
