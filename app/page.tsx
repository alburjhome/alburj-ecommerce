import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { HeroBanner } from '@/features/store/components/hero-banner';
import { CategorySection } from '@/features/store/components/category-section';
import { FeaturedProducts } from '@/features/store/components/featured-products';
import { TrustSection } from '@/features/store/components/trust-section';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { Truck, CreditCard, Shield, BadgePercent, Store, MessageCircle } from 'lucide-react';
import { getWhatsAppLink } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'الرئيسية',
  description: 'مؤسسة البرج - وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن',
};

async function getHomeData() {
  const [bannersResult, categoriesResult, featuredProductsResult, settingsResult] = await Promise.all([
    supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .eq('position', 'home_hero')
      .order('sort_order', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('*, images:product_images(*), category:categories(*)')
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
    categories: categoriesResult.data || [],
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
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <MessageCircle className="h-5 w-5" />
              تواصل عبر واتساب
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">رقم واتساب غير مُعدّل حاليًا</span>
          )}
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
        <ShopCTA whatsappUrl={whatsappUrl} />
        <TrustSection />
      </main>
      <Footer settings={settings} />
    </div>
  );
}
