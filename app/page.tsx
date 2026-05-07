import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { HeroBanner } from '@/features/store/components/hero-banner';
import { CategorySection } from '@/features/store/components/category-section';
import { FeaturedProducts } from '@/features/store/components/featured-products';
import { TrustSection } from '@/features/store/components/trust-section';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';

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
      .select('store_name, store_description, whatsapp_number, contact_email, contact_phone, address')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    banners: bannersResult.data || [],
    categories: categoriesResult.data || [],
    featuredProducts: featuredProductsResult.data || [],
    settings: settingsResult.data || null,
  };
}

export default async function HomePage() {
  const { banners, categories, featuredProducts, settings } = await getHomeData();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroBanner banners={banners} />
        <CategorySection categories={categories} />
        <FeaturedProducts products={featuredProducts} />
        <TrustSection />
      </main>
      <Footer settings={settings} />
    </div>
  );
}
