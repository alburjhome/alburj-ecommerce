import { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';
import { HeroBanner } from '@/features/store/components/hero-banner';
import { CategorySection } from '@/features/store/components/category-section';
import { FeaturedProducts } from '@/features/store/components/featured-products';
import { TrustSection } from '@/features/store/components/trust-section';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ArrowLeft, BadgePercent, CreditCard, Home, MessageCircle, Package, Shield, ShoppingBag, Sparkles, Store, Truck, UtensilsCrossed } from 'lucide-react';
import { getWhatsAppLink } from '@/lib/store-settings';
import { TrackedWhatsAppLink } from '@/components/tracked-whatsapp-link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'مؤسسة البرج | مستلزمات البيت والمحل',
  description:
    'مؤسسة البرج توفر مستلزمات البيت والمحل من منظفات، ورقيات، بلاستيكيات، تغليف، أدوات منزلية ومطبخ، أجهزة كهربائية ومفروشات.',
};

async function getCategoriesWithProducts() {
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (!categories || categories.length === 0) {
    return [];
  }

  // Filter to only include categories with active products
  const categoriesWithProducts = await Promise.all(
    categories.map(async (category: { id: string; [key: string]: unknown }) => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', category.id)
        .eq('is_active', true);

      return { category, hasProducts: (count || 0) > 0 };
    })
  );

  return categoriesWithProducts.filter((item) => item.hasProducts).map((item) => item.category as unknown as Category);
}

async function getHomeData() {
  const [bannersResult, categoriesResult, featuredProductsResult, settingsResult] = await Promise.all([
    supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .eq('position', 'home_hero')
      .order('sort_order', { ascending: true }),
    getCategoriesWithProducts(),
    supabase
      .from('products')
      .select('*, images:product_images(*), variants:product_variants(*), category:categories(*)')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('store_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    banners: bannersResult.data || [],
    categories: categoriesResult || [],
    featuredProducts: featuredProductsResult.data || [],
    settings: (settingsResult.data as any) || null,
  };
}

function QuickTrustBar() {
  const items = [
    { icon: Truck, label: 'توصيل للمحافظات', detail: 'طلبات البيت والمحل' },
    { icon: CreditCard, label: 'الدفع عند الاستلام', detail: 'أسهل وأوضح' },
    { icon: Shield, label: 'منتجات مختارة', detail: 'جودة مناسبة للاستخدام اليومي' },
    { icon: BadgePercent, label: 'جملة ومفرق', detail: 'أسعار تناسب الكميات' },
  ];
  return (
    <section className="border-b bg-white py-3 md:py-4">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 md:justify-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-foreground md:text-sm">{item.label}</span>
                <span className="hidden text-xs text-muted-foreground lg:block">{item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShopByNeedSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const needs = [
    {
      icon: UtensilsCrossed,
      title: 'للمطاعم والكافيهات',
      description: 'تغليف، أكواب، ورقيات ومستلزمات تشغيل يومية.',
      href: '/restaurants',
      accent: 'bg-amber-50 text-amber-700 ring-amber-100',
    },
    {
      icon: Sparkles,
      title: 'للتنظيف والورقيات',
      description: 'منظفات، رولات، مناديل وأساسيات البيت والمكتب.',
      href: '/cleaning',
      accent: 'bg-sky-50 text-sky-700 ring-sky-100',
    },
    {
      icon: ShoppingBag,
      title: 'للتغليف والبلاستيك',
      description: 'أكياس، علب، صحون وكاسات للطلبات اليومية.',
      href: '/packaging',
      accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
    {
      icon: Store,
      title: 'للمحلات والجملة',
      description: 'كميات مناسبة وخيارات عملية للتزويد المستمر.',
      href: '/bulk',
      accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    },
  ];

  return (
    <section className="bg-slate-50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex flex-col gap-2 md:mb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-primary ring-1 ring-border">
              ابدأ من احتياجك
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">تسوق حسب طريقة استخدامك</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              اختصر الوقت واختر المسار الأقرب لطلبك، سواء للبيت أو المطعم أو المحل.
            </p>
          </div>
          {whatsappUrl && (
            <TrackedWhatsAppLink
              href={whatsappUrl}
              source="homepage_need_whatsapp"
              metadata={{ cta_name: 'need_section' }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              اسألنا عبر واتساب
            </TrackedWhatsAppLink>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {needs.map((need) => {
            const Icon = need.icon;
            return (
              <Link
                key={need.href}
                href={need.href}
                className="group rounded-lg border bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ring-1 ${need.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold">{need.title}</h3>
                <p className="mt-2 min-h-[52px] text-sm leading-6 text-muted-foreground">{need.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
                  تصفح الآن
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReadyBundlesSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const bundles = [
    {
      icon: Home,
      name: 'باقة تنظيف البيت',
      description: 'منظفات وورقيات أساسية للاستخدام اليومي.',
      items: ['شامبو سجاد', 'منظف أرضيات', 'أكياس نفايات', 'رول مطبخ'],
    },
    {
      icon: UtensilsCrossed,
      name: 'باقة تجهيز مطعم',
      description: 'مستلزمات تغليف وورقيات مناسبة للمطاعم والكافيهات.',
      items: ['علب تغليف', 'أكواب', 'مناديل', 'رول تغليف'],
    },
    {
      icon: Package,
      name: 'باقة الورقيات الشهرية',
      description: 'كل ما تحتاجه من ورقيات للبيت أو المكتب.',
      items: ['رول حمام', 'رول مطبخ', 'مناديل', 'أكياس نفايات'],
    },
    {
      icon: ShoppingBag,
      name: 'باقة المحلات',
      description: 'مستلزمات يومية للمحلات بأسعار مناسبة.',
      items: ['أكياس', 'تغليف', 'منظفات', 'أدوات بلاستيكية'],
    },
  ];

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-5 max-w-2xl md:mb-7">
          <div className="mb-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            طلبات أسرع
          </div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">باقات جاهزة تختصر عليك الاختيار</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground md:text-base">
            اختصر وقتك واختر باقة مناسبة لاحتياجك اليومي أو لمحلك.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((bundle) => {
            const Icon = bundle.icon;
            const message = `مرحبا، أريد طلب باقة:\n${bundle.name}\n\nالعناصر:\n- ${bundle.items.join(
              '\n- '
            )}\n\nهل يمكن تزويدي بالسعر والتفاصيل؟`;
            const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

            return (
              <div key={bundle.name} className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold leading-6">{bundle.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{bundle.description}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-sm">
                  {bundle.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span className="leading-6">{item}</span>
                    </li>
                  ))}
                </ul>

                {href && (
                  <TrackedWhatsAppLink
                    href={href}
                    source="homepage_bundle"
                    metadata={{ bundle_name: bundle.name }}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلب الباقة عبر واتساب
                  </TrackedWhatsAppLink>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ShopCTA({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="bg-slate-950 py-8 text-white md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/90 ring-1 ring-white/15">
              <Store className="h-4 w-4" />
              تجهيزات للمحلات والمطاعم
            </div>
            <h3 className="text-2xl font-bold md:text-3xl">تجهّز محل أو مطعم؟</h3>
            <p className="mt-2 text-sm leading-7 text-white/70 md:text-base">
            نوفر لك مستلزمات التغليف، البلاستيك، الورقيات والمنظفات بكميات وأسعار مناسبة.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            {whatsappUrl ? (
              <TrackedWhatsAppLink
                href={whatsappUrl}
                source="homepage_shop_cta"
                metadata={{ cta_name: 'shop_cta' }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-5 w-5" />
                تواصل عبر واتساب
              </TrackedWhatsAppLink>
            ) : (
              <span className="inline-flex items-center justify-center rounded-lg border bg-white px-5 py-2.5 text-sm text-muted-foreground">
                رقم واتساب غير مُعدّل حاليًا
              </span>
            )}

            <Link
              href="/quick-order"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-white/90"
            >
              جهّز طلبك خلال دقيقة
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { banners, categories, featuredProducts, settings } = await getHomeData();
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />
      <main>
        <HeroBanner banners={banners} whatsappUrl={whatsappUrl} />
        <QuickTrustBar />
        <ShopByNeedSection whatsappUrl={whatsappUrl} />
        <CategorySection categories={categories} />
        <FeaturedProducts products={featuredProducts} />
        <ReadyBundlesSection whatsappUrl={whatsappUrl} />
        <ShopCTA whatsappUrl={whatsappUrl} />
        <TrustSection />
      </main>
      <Footer settings={settings} />
    </div>
  );
}
