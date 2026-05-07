import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import type { ProductWithDetails, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
  searchParams?: { search?: string };
}

export const metadata: Metadata = {
  title: 'المنتجات',
  description: 'تصفح منتجات مؤسسة البرج.',
};

async function getSettings() {
  const { data } = await supabase
    .from('store_settings')
    .select('store_name, store_description, whatsapp_number, contact_email, contact_phone, address')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as Pick<
    StoreSettings,
    'store_name' | 'store_description' | 'whatsapp_number' | 'contact_email' | 'contact_phone' | 'address'
  > | null;
}

async function getProducts(search?: string) {
  let query = (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const term = search?.trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  const { data } = await query;
  return ((data || []) as ProductWithDetails[]).map((product) => ({
    ...product,
    variants: [],
    images: [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const [products, settings] = await Promise.all([getProducts(searchParams?.search), getSettings()]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">الكتالوج</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">المنتجات</h1>
          {searchParams?.search && (
            <p className="mt-2 text-sm text-muted-foreground">نتائج البحث عن: {searchParams.search}</p>
          )}
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-16 text-center">
            <h2 className="text-lg font-semibold">لا توجد منتجات مطابقة</h2>
            <p className="mt-2 text-sm text-muted-foreground">جرّب البحث بكلمة أخرى.</p>
          </div>
        )}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
