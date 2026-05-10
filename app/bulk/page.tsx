import { Metadata } from 'next';
import Link from 'next/link';
import { Boxes, Store, Truck, Gift, MessageCircle, ArrowLeft, Percent, Package } from 'lucide-react';
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

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'عروض الكميات والجملة | مؤسسة البرج',
  description:
    'اطلب عروض الكميات والجملة من مؤسسة البرج على المنظفات، الورقيات، التغليف، البلاستيكيات، الأدوات المنزلية ومستلزمات المطاعم والمحلات مع توصيل لجميع المحافظات.',
  alternates: {
    canonical: `${baseUrl}/bulk`,
  },
  openGraph: {
    title: 'عروض الكميات والجملة | مؤسسة البرج',
    description:
      'اطلب عروض الكميات والجملة من مؤسسة البرج على المنظفات، الورقيات، التغليف، البلاستيكيات، الأدوات المنزلية ومستلزمات المطاعم والمحلات مع توصيل لجميع المحافظات.',
    url: `${baseUrl}/bulk`,
    type: 'website',
    images: [{ url: `${baseUrl}${PLACEHOLDER_BANNER}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'عروض الكميات والجملة | مؤسسة البرج',
    description:
      'اطلب عروض الكميات والجملة من مؤسسة البرج على المنظفات، الورقيات، التغليف، البلاستيكيات، الأدوات المنزلية ومستلزمات المطاعم والمحلات مع توصيل لجميع المحافظات.',
    images: [`${baseUrl}${PLACEHOLDER_BANNER}`],
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

function getProductBadges(product: unknown): string[] {
  if (!product || typeof product !== 'object') return [];
  const anyProduct = product as any;
  const badges = anyProduct.product_badges;
  if (!Array.isArray(badges)) return [];
  return badges.filter((b) => typeof b === 'string');
}

function productMatchesBulkCriteria(product: ProductWithDetails): boolean {
  const anyProduct = product as any;

  const intentTags = Array.isArray(anyProduct.intent_tags)
    ? anyProduct.intent_tags.filter((t: unknown) => typeof t === 'string')
    : [];

  const badges = getProductBadges(product).map((b) => b.toLowerCase());
  const badgeMatch = badges.includes('wholesale') || badges.includes('offer');

  return (
    intentTags.includes('bulk') ||
    badgeMatch ||
    anyProduct.is_featured === true ||
    productMatchesIntent(product, 'bulk')
  );
}

async function getBulkProducts() {
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

  return products.filter(productMatchesBulkCriteria);
}

function BulkTrustBar() {
  const items = [
    { icon: Percent, label: 'عروض للكميات' },
    { icon: Store, label: 'مناسب للمطاعم والمحلات' },
    { icon: Truck, label: 'توصيل لجميع المحافظات' },
    { icon: Gift, label: 'تجهيز حسب احتياجك' },
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

const bulkSections = [
  {
    name: 'كميات للمطاعم',
    description: 'تجهيز كميات للتغليف والورقيات والمنظفات للمطاعم.',
  },
  {
    name: 'كميات للكافيهات',
    description: 'كميات مناسبة للأكواب، الأكياس، المناديل ومستلزمات التقديم.',
  },
  {
    name: 'كميات للمحلات',
    description: 'كميات للمحلات: تنظيميّات، أكياس، ورقيات ومنتجات يومية.',
  },
  {
    name: 'كميات تنظيف وورقيات',
    description: 'عروض كميات للمنظفات، المعقمات، الورقيات والمناديل.',
  },
  {
    name: 'كميات تغليف',
    description: 'علب وأكياس ورولات وصحون سفري لكميات المطاعم والمحلات.',
  },
  {
    name: 'كميات للبيت والمطبخ',
    description: 'كميات للبيت: أدوات مطبخ، تنظيم، حافظات ومنتجات منزلية.',
  },
];

function BulkSections({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">أقسام طلبات الكميات</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            اختر نوع الطلب، وأرسل لنا الكمية المطلوبة عبر واتساب لنجهز لك العرض.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bulkSections.map((section) => {
            const message = `مرحبا، أريد عرض كمية بخصوص: ${section.name}`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={section.name} className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-bold leading-6">{section.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>

                {href ? (
                  <TrackedWhatsAppLink
                    href={href}
                    source="bulk_section_whatsapp"
                    metadata={{ section_name: section.name }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلب هذه الكمية
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

const bundles = [
  {
    name: 'باقة مطعم شهرية',
    description: 'تشمل: تغليف، مناديل، أكياس، منظفات',
  },
  {
    name: 'باقة كافيه',
    description: 'تشمل: أكواب، مناديل، أكياس، منظفات',
  },
  {
    name: 'باقة محل',
    description: 'تشمل: أكياس، ورقيات، أدوات تنظيم، منظفات',
  },
  {
    name: 'باقة بيت شهرية',
    description: 'تشمل: منظفات، ورقيات، أدوات مطبخ ومنتجات منزلية',
  },
];

function BulkBundlesSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">باقات كميات جاهزة</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            باقات شهرية مُقترحة لتسهيل طلبات الجملة والكميات.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((bundle) => {
            const message = `مرحبا، أريد الاستفسار عن ${bundle.name} من صفحة الكميات والجملة.`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={bundle.name} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-bold leading-6">{bundle.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{bundle.description}</p>

                {href ? (
                  <TrackedWhatsAppLink
                    href={href}
                    source="bulk_bundle"
                    metadata={{ bundle_name: bundle.name }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلب عرض هذه الباقة
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

function HowToOrderSection() {
  const steps = [
    { title: 'اختر نوع الطلب', description: 'حدد القسم المناسب حسب نشاطك أو نوع المنتجات المطلوبة.' },
    { title: 'أرسل الكمية عبر واتساب', description: 'أرسل لنا الأصناف والعدد المطلوب أو صور المنتجات إن لزم.' },
    { title: 'يصلك السعر والتجهيز', description: 'نرسل لك عرض السعر وخيارات التوصيل والتجهيز المناسبة.' },
  ];

  return (
    <section className="py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">كيف تطلب عرض كمية؟</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            ثلاث خطوات بسيطة لطلب عرض كميات من مؤسسة البرج.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-xl border bg-card p-5">
              <div className="text-sm font-semibold text-primary">{index + 1}</div>
              <h3 className="mt-2 text-base font-bold leading-6">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function BulkPage() {
  const [settings, bulkProducts] = await Promise.all([getSettings(), getBulkProducts()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);
  const featuredProducts = bulkProducts.slice(0, 8);

  const heroMessage = 'مرحبا، أريد عرض كمية من مؤسسة البرج.';
  const heroWhatsAppHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(heroMessage)}` : null;

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-10 md:py-14" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">تحتاج كميات؟ خلّي مؤسسة البرج تجهز طلبك</h1>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">
                سواء عندك مطعم، كافيه، محل، مكتب أو تجهيز بيت — اطلب كميات من التغليف، الورقيات، المنظفات، البلاستيكيات
                والأدوات المنزلية مباشرة عبر واتساب.
              </p>

              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                {heroWhatsAppHref ? (
                  <TrackedWhatsAppLink
                    href={heroWhatsAppHref}
                    source="bulk_hero_whatsapp"
                    metadata={{ cta_name: 'bulk_hero' }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اطلب عرض كمية عبر واتساب
                  </TrackedWhatsAppLink>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                    رقم واتساب غير مُعدّل حاليًا
                  </span>
                )}

                <Link
                  href="/offers"
                  className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  تصفح العروض
                </Link>
              </div>

              <div className="mt-3">
                <Link href="/products?intent=bulk" className="text-sm text-primary hover:underline">
                  تصفح منتجات الكميات ←
                </Link>
              </div>
            </div>
          </div>
        </section>

        <BulkTrustBar />

        <BulkSections whatsappUrl={whatsappUrl} />

        {/* Featured Products */}
        <section className="py-8 md:py-10" dir="rtl">
          <div className="container mx-auto px-4">
            <div className="mb-5 md:mb-6">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">منتجات مختارة للكميات والجملة</h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                منتجات مناسبة لعروض الكميات والجملة (حسب الوسوم/الشارات أو المنتجات المميزة).
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
                <h3 className="text-lg font-semibold">لا توجد منتجات كميات مضافة حاليًا</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  تواصل معنا لإرسال قائمة الكميات المطلوبة وسنرجع لك بعرض مناسب.
                </p>
                {whatsappUrl && (
                  <TrackedWhatsAppLink
                    href={whatsappUrl}
                    source="bulk_empty_whatsapp"
                    metadata={{ cta_name: 'bulk_empty' }}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    اطلب عرض كمية عبر واتساب
                  </TrackedWhatsAppLink>
                )}
              </div>
            )}
          </div>
        </section>

        <BulkBundlesSection whatsappUrl={whatsappUrl} />

        <HowToOrderSection />
      </main>

      <Footer settings={settings} />
    </div>
  );
}
