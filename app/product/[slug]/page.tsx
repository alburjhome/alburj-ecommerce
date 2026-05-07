import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductDetail } from '@/features/store/components/product-detail';
import type { ProductWithDetails, StoreSettings } from '@/types';

interface ProductPageProps {
  params: { slug: string };
}

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

async function getProduct(slug: string) {
  const { data, error } = await (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    variants: [],
    images: (data.images || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
  } as ProductWithDetails;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) {
    return { title: 'المنتج غير موجود' };
  }

  return {
    title: product.meta_title || product.name,
    description: product.meta_description || product.short_description || product.description || undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const [product, settings] = await Promise.all([getProduct(params.slug), getSettings()]);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <ProductDetail product={product} />
      </main>
      <Footer settings={settings} />
    </div>
  );
}
