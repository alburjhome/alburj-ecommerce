import { Metadata } from 'next';
import Link from 'next/link';
import { Sofa, Package, Truck, Percent, MessageCircle, ArrowLeft } from 'lucide-react';
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
  title: 'بلاستيكيات منزلية وتجارية | مؤسسة البرج',
  description:
    'تسوق البلاستيكيات من مؤسسة البرج: كراسي، طاولات، سلات، علب تخزين، أدوات منزلية ومستلزمات محلات مع توصيل لجميع المحافظات.',
  alternates: {
    canonical: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/plastic-products`,
  },
  openGraph: {
    title: 'بلاستيكيات منزلية وتجارية | مؤسسة البرج',
    description:
      'تسوق البلاستيكيات من مؤسسة البرج: كراسي، طاولات، سلات، علب تخزين، أدوات منزلية ومستلزمات محلات مع توصيل لجميع المحافظات.',
    url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/plastic-products`,
    type: 'website',
    images: [
      {
        url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}${PLACEHOLDER_BANNER}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'بلاستيكيات منزلية وتجارية | مؤسسة البرج',
    description:
      'تسوق البلاستيكيات من مؤسسة البرج: كراسي، طاولات، سلات، علب تخزين، أدوات منزلية ومستلزمات محلات مع توصيل لجميع المحافظات.',
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

async function getPlasticsProducts() {
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

  return products.filter((product) => productMatchesIntent(product, 'plastics'));
}

function PlasticsTrustBar() {
  const items = [
    { icon: Package, label: 'منتجات عملية للبيت والمحل' },
    { icon: Sofa, label: 'خيارات متعددة' },
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
    title: 'كراسي بلاستيك',
    description: 'كراسي بلاستيك متينة مناسبة للبيت والمحل والجلسات.',
    search: 'كراسي',
  },
  {
    title: 'طاولات بلاستيك',
    description: 'طاولات بلاستيك عملية بأحجام مختلفة للاستخدام المنزلي والتجاري.',
    search: 'طاولات',
  },
  {
    title: 'سلات',
    description: 'سلات تخزين وعرض منظمة للمطبخ والمحلات والبيت.',
    search: 'سلات',
  },
  {
    title: 'علب تخزين',
    description: 'علب تخزين بلاستيكية عملية للحفاظ على الطعام والمقتنيات.',
    search: 'تخزين',
  },
  {
    title: 'أدوات منزلية بلاستيك',
    description: 'أدوات منزلية بلاستيكية عملية للاستخدام اليومي في البيت.',
    search: 'أدوات منزلية',
  },
  {
    title: 'مستلزمات محلات',
    description: 'مستلزمات تنظيم وعرض بلاستيكية للمحلات التجارية.',
    search: 'محلات',
  },
];

function NeedCategoriesSection() {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">احتياجات البلاستيكيات</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            اختر القسم المناسب لتصفح منتجات البلاستيكيات المنزلية والتجارية.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {needCategories.map((category) => (
            <div key={category.title} className="rounded-xl border bg-card p-5">
              <h3 className="text-base font-bold leading-6">{category.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              <Link
                href={`/products?intent=plastics&search=${encodeURIComponent(category.search)}`}
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
    name: 'باقة تجهيز بيت',
    description: 'تشمل: سلات، علب تخزين، أدوات بلاستيكية منزلية',
  },
  {
    name: 'باقة محل',
    description: 'تشمل: سلات عرض، علب، مستلزمات تنظيم',
  },
  {
    name: 'باقة جلسات خارجية',
    description: 'تشمل: كراسي، طاولات، مستلزمات بلاستيكية عملية',
  },
];

function PlasticsBundlesSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">باقات جاهزة للبلاستيكيات</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            باقات مُجهزة مسبقًا لتسهيل طلبك وتوفير الوقت.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const message = `مرحبا، أريد الاستفسار عن ${bundle.name} من صفحة البلاستيكيات.`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={bundle.name} className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-bold leading-6">{bundle.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{bundle.description}</p>

                {href ? (
                  <TrackedWhatsAppLink
                    href={href}
                    source="plastics_bundle"
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

export default async function PlasticProductsPage() {
  const [settings, plasticsProducts] = await Promise.all([getSettings(), getPlasticsProducts()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);
  const featuredProducts = plasticsProducts.slice(0, 8);

  const heroMessage = 'مرحبا، أريد الاستفسار عن البلاستيكيات المتوفرة.';
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
                بلاستيكيات للبيت والمحل من مكان واحد
              </h1>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">
                كراسي، طاولات، سلات، علب تخزين وأدوات بلاستيكية عملية للبيت والمحل — اطلب المتوفر مباشرة عبر واتساب.
              </p>

              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                {heroWhatsAppHref ? (
                  <TrackedWhatsAppLink
                    href={heroWhatsAppHref}
                    source="plastics_hero_whatsapp"
                    metadata={{ cta_name: 'plastics_hero' }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اطلب عبر واتساب
                  </TrackedWhatsAppLink>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                    رقم واتساب غير مُعدّل حاليًا
                  </span>
                )}

                <Link
                  href="/products?intent=plastics"
                  className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  تصفح البلاستيكيات
                </Link>
              </div>
            </div>
          </div>
        </section>

        <PlasticsTrustBar />

        <NeedCategoriesSection />

        {/* Featured Products */}
        <section className="py-8 md:py-10" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mb-5 md:mb-6">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">منتجات مختارة من البلاستيكيات</h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                منتجات بلاستيكية عملية تناسب احتياجات البيت والمحل والمطاعم.
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
                <h3 className="text-lg font-semibold">لم يتم إضافة منتجات بلاستيكيات بعد</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  تواصل معنا لمعرفة البلاستيكيات المتاحة حاليًا.
                </p>
                {whatsappUrl && (
                  <TrackedWhatsAppLink
                    href={whatsappUrl}
                    source="plastics_empty_whatsapp"
                    metadata={{ cta_name: 'plastics_empty' }}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اسألنا عن البلاستيكيات المتوفرة
                  </TrackedWhatsAppLink>
                )}
              </div>
            )}
          </div>
        </section>

        <PlasticsBundlesSection whatsappUrl={whatsappUrl} />
      </main>

      <Footer settings={settings} />
    </div>
  );
}
