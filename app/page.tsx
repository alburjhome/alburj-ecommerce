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
import { Truck, CreditCard, Shield, BadgePercent, Store, MessageCircle, Home, UtensilsCrossed, Package, ShoppingBag } from 'lucide-react';
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
    { icon: Truck, label: 'توصيل لجميع المحافظات' },
    { icon: CreditCard, label: 'الدفع عند الاستلام' },
    { icon: Shield, label: 'منتجات أصلية ومضمونة' },
    { icon: BadgePercent, label: 'أسعار مناسبة للجملة والمفرق' },
  ];
  return (
    <section className="border-b bg-muted/40 py-3 md:py-4">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 justify-center text-xs md:text-sm text-muted-foreground">
              <item.icon className="h-4 w-4 shrink-0 text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
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
    <section className="py-8 md:py-10">
      <div className="container mx-auto px-4">
        <div className="mb-5 md:mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">باقات جاهزة لك</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
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
              <div key={bundle.name} className="rounded-xl border bg-card p-5">
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
    <section className="py-8 md:py-10 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 rounded-xl bg-gradient-to-r from-blue-50 to-slate-100 p-6 md:p-8 text-center">
          <Store className="h-10 w-10 text-primary" />
          <h3 className="text-xl md:text-2xl font-bold">تجهّز محل أو مطعم؟</h3>
          <p className="max-w-xl text-sm md:text-base text-muted-foreground">
            نوفر لك مستلزمات التغليف، البلاستيك، الورقيات والمنظفات بكميات وأسعار مناسبة.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
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
              className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
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
        <HeroBanner banners={banners} />
        <QuickTrustBar />
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
