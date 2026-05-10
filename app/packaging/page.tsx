import { Metadata } from 'next';
import Link from 'next/link';
import { Package, Store, Truck, Percent, MessageCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import { getWhatsAppLink } from '@/lib/store-settings';
import { TrackedWhatsAppLink } from '@/components/tracked-whatsapp-link';
import { productMatchesIntent } from '@/lib/product-intents';
import { PLACEHOLDER_BANNER } from '@/lib/image-utils';
import type { ProductWithDetails, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'مستلزمات التغليف والعلب | مؤسسة البرج',
  description:
    'اطلب مستلزمات التغليف من مؤسسة البرج: علب، أكياس، رولات تغليف، صحون سفري، أكواب ومنتجات مناسبة للمطاعم والمحلات مع توصيل لجميع المحافظات.',
  alternates: {
    canonical: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/packaging`,
  },
  openGraph: {
    title: 'مستلزمات التغليف والعلب | مؤسسة البرج',
    description:
      'اطلب مستلزمات التغليف من مؤسسة البرج: علب، أكياس، رولات تغليف، صحون سفري، أكواب ومنتجات مناسبة للمطاعم والمحلات مع توصيل لجميع المحافظات.',
    url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/packaging`,
    type: 'website',
    images: [
      {
        url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}${PLACEHOLDER_BANNER}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مستلزمات التغليف والعلب | مؤسسة البرج',
    description:
      'اطلب مستلزمات التغليف من مؤسسة البرج: علب، أكياس، رولات تغليف، صحون سفري، أكواب ومنتجات مناسبة للمطاعم والمحلات مع توصيل لجميع المحافظات.',
    images: [
      `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}${PLACEHOLDER_BANNER}`,
    ],
  },
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

async function getPackagingProducts() {
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

  return products.filter((product) => productMatchesIntent(product, 'packaging'));
}

function PackagingTrustBar() {
  const items = [
    { icon: Package, label: 'خيارات متعددة للتغليف' },
    { icon: Store, label: 'مناسب للمطاعم والمحلات' },
    { icon: Truck, label: 'توصيل لجميع المحافظات' },
    { icon: Percent, label: 'عروض للكميات' },
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

const needCategories = [
  {
    title: 'علب تغليف',
    description: 'علب بأحجام مختلفة مناسبة للحلويات والأطعمة والمشروبات.',
    search: 'علب',
  },
  {
    title: 'أكياس',
    description: 'أكياس تغليف متنوعة لجميع الاستخدامات التجارية.',
    search: 'أكياس',
  },
  {
    title: 'رولات تغليف',
    description: 'رولات تغليف عملية للحفاظ على الطعام والمنتجات.',
    search: 'رولات',
  },
  {
    title: 'صحون سفري',
    description: 'صحون سفري متنوعة للمطاعم والمحلات والتوصيل.',
    search: 'صحون',
  },
  {
    title: 'أكواب',
    description: 'أكواب تقديم مناسبة للمشروبات الساخنة والباردة.',
    search: 'أكواب',
  },
  {
    title: 'تغليف للمطاعم',
    description: 'حلول تغليف متكاملة للمطاعم والمحلات الغذائية.',
    search: 'مطاعم',
  },
];

function NeedCategoriesSection() {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">احتياجات التغليف</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            اختر القسم المناسب لتصفح منتجات التغليف والعلب والأكياس.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {needCategories.map((category) => (
            <div key={category.title} className="rounded-xl border bg-card p-5">
              <h3 className="text-base font-bold leading-6">{category.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              <Link
                href={`/products?intent=packaging&search=${encodeURIComponent(category.search)}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                عرض المنتجات
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const bundles = [
  {
    name: 'باقة مطعم سفري',
    description: 'تشمل: علب، أكياس، مناديل، صحون سفري',
  },
  {
    name: 'باقة كافيه',
    description: 'تشمل: أكواب، أكياس، مناديل، مواد تغليف',
  },
  {
    name: 'باقة محل حلويات',
    description: 'تشمل: علب تغليف، أكياس، رولات، أدوات تقديم',
  },
];

function PackagingBundlesSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">باقات جاهزة للتغليف</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            باقات مُجهزة مسبقًا لتسهيل طلبك وتوفير الوقت.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const message = `مرحبا، أريد الاستفسار عن ${bundle.name} من صفحة التغليف.`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={bundle.name} className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-bold leading-6">{bundle.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{bundle.description}</p>

                {href ? (
                  <TrackedWhatsAppLink
                    href={href}
                    source="packaging_bundle"
                    metadata={{ bundle_name: bundle.name }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلب هذه الباقة عبر واتساب
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

export default async function PackagingPage() {
  const [settings, packagingProducts] = await Promise.all([getSettings(), getPackagingProducts()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);
  const featuredProducts = packagingProducts.slice(0, 8);

  const heroMessage = 'مرحبا، أريد الاستفسار عن مستلزمات التغليف لمحلي.';
  const heroWhatsAppHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(heroMessage)}` : null;

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-10 md:py-14" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                مستلزمات التغليف لمحلك من مكان واحد
              </h1>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">
                علب، أكياس، رولات، صحون سفري وأدوات تغليف مناسبة للمطاعم والمحلات — اطلب الكمية المناسبة عبر واتساب.
              </p>

              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                {heroWhatsAppHref ? (
                  <TrackedWhatsAppLink
                    href={heroWhatsAppHref}
                    source="packaging_hero_whatsapp"
                    metadata={{ cta_name: 'packaging_hero' }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اطلب التغليف عبر واتساب
                  </TrackedWhatsAppLink>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                    رقم واتساب غير مُعدّل حاليًا
                  </span>
                )}

                <Link
                  href="/products?intent=packaging"
                  className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  تصفح منتجات التغليف
                </Link>
              </div>
            </div>
          </div>
        </section>

        <PackagingTrustBar />

        <NeedCategoriesSection />

        {/* Featured Products */}
        <section className="py-8 md:py-10" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mb-5 md:mb-6">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">منتجات مختارة للتغليف</h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                منتجات عملية تناسب احتياجات التغليف للمطاعم والمحلات والأسر المنتجة.
              </p>
            </div>

            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {featuredProducts.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-14 text-center">
                <h3 className="text-lg font-semibold">لم يتم إضافة منتجات تغليف بعد</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  تواصل معنا لمعرفة المنتجات المتاحة للتغليف والعلب والأكياس.
                </p>
                {whatsappUrl && (
                  <TrackedWhatsAppLink
                    href={whatsappUrl}
                    source="packaging_empty_whatsapp"
                    metadata={{ cta_name: 'packaging_empty' }}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اسألنا عن منتجات التغليف
                  </TrackedWhatsAppLink>
                )}
              </div>
            )}
          </div>
        </section>

        <PackagingBundlesSection whatsappUrl={whatsappUrl} />
      </main>

      <Footer settings={settings} />
    </div>
  );
}
