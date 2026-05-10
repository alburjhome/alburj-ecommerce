import { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ShieldCheck, Truck, Percent, MessageCircle, ArrowLeft } from 'lucide-react';
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
  title: 'منظفات وورقيات للبيت والمحل | مؤسسة البرج',
  description:
    'تسوق المنظفات والورقيات من مؤسسة البرج: منظفات، مناديل، فوط، معقمات، أدوات تنظيف ومنتجات نظافة يومية للبيت والمطاعم والمحلات مع توصيل لجميع المحافظات.',
  alternates: {
    canonical: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/cleaning`,
  },
  openGraph: {
    title: 'منظفات وورقيات للبيت والمحل | مؤسسة البرج',
    description:
      'تسوق المنظفات والورقيات من مؤسسة البرج: منظفات، مناديل، فوط، معقمات، أدوات تنظيف ومنتجات نظافة يومية للبيت والمطاعم والمحلات مع توصيل لجميع المحافظات.',
    url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}/cleaning`,
    type: 'website',
    images: [
      {
        url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '')}${PLACEHOLDER_BANNER}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'منظفات وورقيات للبيت والمحل | مؤسسة البرج',
    description:
      'تسوق المنظفات والورقيات من مؤسسة البرج: منظفات، مناديل، فوط، معقمات، أدوات تنظيف ومنتجات نظافة يومية للبيت والمطاعم والمحلات مع توصيل لجميع المحافظات.',
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

async function getCleaningProducts() {
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

  return products.filter((product) => productMatchesIntent(product, 'cleaning'));
}

function CleaningTrustBar() {
  const items = [
    { icon: Sparkles, label: 'منتجات نظافة يومية' },
    { icon: ShieldCheck, label: 'مناسب للبيت والمطاعم والمحلات' },
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
    title: 'منظفات البيت',
    description: 'منظفات متنوعة للأرضيات والزجاج والأسطح والحمامات.',
    search: 'منظفات',
  },
  {
    title: 'منظفات المطاعم',
    description: 'منظفات قوية ومتخصصة للمطابخ والمطاعم والمحلات الغذائية.',
    search: 'مطاعم',
  },
  {
    title: 'الورقيات والمناديل',
    description: 'مناديل ورقية، فوط، ورقيات متعددة الاستخدامات.',
    search: 'مناديل',
  },
  {
    title: 'المعقمات',
    description: 'معقمات أسطح وأيدي ومنتجات تعقيم عملية للبيت والمحل.',
    search: 'معقمات',
  },
  {
    title: 'أدوات تنظيف',
    description: 'أدوات تنظيف عملية لتسهيل أعمال النظافة اليومية.',
    search: 'أدوات تنظيف',
  },
  {
    title: 'عروض التنظيف',
    description: 'عروض وكميات على منتجات النظافة والتنظيف بأسعار مميزة.',
    search: 'عروض',
  },
];

function NeedCategoriesSection() {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">احتياجات التنظيف والورقيات</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            اختر القسم المناسب لتصفح منتجات النظافة والمنظفات والورقيات.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {needCategories.map((category) => (
            <div key={category.title} className="rounded-xl border bg-card p-5">
              <h3 className="text-base font-bold leading-6">{category.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              <Link
                href={`/products?intent=cleaning&search=${encodeURIComponent(category.search)}`}
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
    name: 'باقة تنظيف البيت',
    description: 'تشمل: منظفات، مناديل، فوط، أدوات تنظيف يومية',
  },
  {
    name: 'باقة مطعم نظيف',
    description: 'تشمل: منظفات قوية، ورقيات، معقمات، أدوات تنظيف',
  },
  {
    name: 'باقة شهرية للورقيات',
    description: 'تشمل: مناديل، فوط، ورقيات استخدام يومي ومنتجات نظافة',
  },
];

function CleaningBundlesSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">باقات جاهزة للتنظيف والورقيات</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            باقات مُجهزة مسبقًا لتسهيل طلبك وتوفير الوقت.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const message = `مرحبا، أريد الاستفسار عن ${bundle.name} من صفحة المنظفات والورقيات.`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={bundle.name} className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-bold leading-6">{bundle.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{bundle.description}</p>

                {href ? (
                  <TrackedWhatsAppLink
                    href={href}
                    source="cleaning_bundle"
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

export default async function CleaningPage() {
  const [settings, cleaningProducts] = await Promise.all([getSettings(), getCleaningProducts()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);
  const featuredProducts = cleaningProducts.slice(0, 8);

  const heroMessage = 'مرحبا، أريد الاستفسار عن منتجات التنظيف والورقيات.';
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
                منظفات وورقيات للبيت والمحل من مكان واحد
              </h1>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">
                كل ما تحتاجه للنظافة اليومية: منظفات، ورقيات، مناديل، فوط، معقمات وأدوات تنظيف مناسبة للبيت والمطاعم
                والمحلات — اطلب مباشرة عبر واتساب.
              </p>

              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                {heroWhatsAppHref ? (
                  <TrackedWhatsAppLink
                    href={heroWhatsAppHref}
                    source="cleaning_hero_whatsapp"
                    metadata={{ cta_name: 'cleaning_hero' }}
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
                  href="/products?intent=cleaning"
                  className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  تصفح منتجات التنظيف
                </Link>
              </div>
            </div>
          </div>
        </section>

        <CleaningTrustBar />

        <NeedCategoriesSection />

        {/* Featured Products */}
        <section className="py-8 md:py-10" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mb-5 md:mb-6">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">منتجات مختارة للتنظيف والورقيات</h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                منتجات نظافة ومنظفات وورقيات تناسب احتياجات البيت والمطاعم والمحلات.
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
                <h3 className="text-lg font-semibold">لم يتم إضافة منتجات تنظيف وورقيات بعد</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  تواصل معنا لمعرفة المنتجات المتاحة للتنظيف والورقيات.
                </p>
                {whatsappUrl && (
                  <TrackedWhatsAppLink
                    href={whatsappUrl}
                    source="cleaning_empty_whatsapp"
                    metadata={{ cta_name: 'cleaning_empty' }}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اسألنا عن منتجات التنظيف المتوفرة
                  </TrackedWhatsAppLink>
                )}
              </div>
            )}
          </div>
        </section>

        <CleaningBundlesSection whatsappUrl={whatsappUrl} />
      </main>

      <Footer settings={settings} />
    </div>
  );
}
