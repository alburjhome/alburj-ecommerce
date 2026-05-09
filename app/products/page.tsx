import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import { ProductIntentFilters } from '@/features/store/components/product-intent-filters';
import { getWhatsAppLink } from '@/lib/store-settings';
import {
  getIntentConfig,
  normalizeIntent,
  productMatchesIntent,
  type ProductIntentKey,
} from '@/lib/product-intents';
import type { ProductWithDetails, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
  searchParams?: { search?: string; intent?: string };
}

export const metadata: Metadata = {
  title: 'منتجات مؤسسة البرج | مستلزمات البيت والمحل',
  description:
    'تصفح منتجات مؤسسة البرج من منظفات، بلاستيكيات، تغليف، أدوات منزلية، أدوات مطبخ، أجهزة كهربائية ومفروشات.',
};

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function productMatchesSearch(product: ProductWithDetails, term: string) {
  const q = normalizeSearchTerm(term);
  if (!q) return true;

  const candidates: string[] = [];
  if (product.name) candidates.push(product.name);
  if ((product as any).description) candidates.push((product as any).description);
  if ((product as any).short_description) candidates.push((product as any).short_description);
  if ((product as any).marketing_tagline) candidates.push((product as any).marketing_tagline);
  if ((product as any).sku) candidates.push((product as any).sku);
  if ((product as any).brand) candidates.push((product as any).brand);
  if ((product as any).category?.name) candidates.push((product as any).category.name);
  if ((product as any).subcategory?.name) candidates.push((product as any).subcategory.name);

  const tags = ((product as any).tags as string[] | null | undefined) || [];
  for (const tag of tags) {
    if (tag) candidates.push(tag);
  }

  const haystack = candidates
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();

  return haystack.includes(q);
}

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

async function getProducts(search?: string) {
  let query = (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const term = search?.trim();

  const { data } = await query;
  const products = ((data || []) as ProductWithDetails[]).map((product) => ({
    ...product,
    variants: [],
    images: [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  if (!term) return products;
  return products.filter((product) => productMatchesSearch(product, term));
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const [products, settings] = await Promise.all([getProducts(searchParams?.search), getSettings()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  const selectedIntent = normalizeIntent((searchParams as any)?.intent);
  const intentConfig = getIntentConfig(selectedIntent);

  const searchTerm = searchParams?.search?.trim() || '';

  let filteredProducts = products;
  try {
    filteredProducts =
      selectedIntent === 'all'
        ? products
        : products.filter((product) => productMatchesIntent(product, selectedIntent));
  } catch (error) {
    console.error('Products intent filter failed', {
      selectedIntent,
      error,
    });
    filteredProducts = products;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">الكتالوج</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{intentConfig.title}</h1>
          {searchTerm && (
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedIntent !== 'all'
                ? `نتائج "${searchTerm}" ضمن: ${intentConfig.title}`
                : `نتائج البحث عن: "${searchTerm}"`}
            </p>
          )}
        </div>

        <ProductIntentFilters selected={selectedIntent} />

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-16 text-center">
            {searchTerm ? (
              <>
                <h2 className="text-lg font-semibold">لم نجد منتجات مطابقة لبحثك</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  جرّب كلمة أبسط مثل: شامبو، تغليف، كرسي، مناديل
                </p>
              </>
            ) : (
              <h2 className="text-lg font-semibold">لا توجد منتجات ضمن هذا الاختيار حاليًا</h2>
            )}
          </div>
        )}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
