import Link from 'next/link';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';
import type { Category, ProductWithDetails, StoreSettings, Subcategory } from '@/types';

export const dynamic = 'force-dynamic';

interface CategoryPageProps {
  params: { slug: string };
  searchParams?: { subcategory?: string };
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

async function getCategoryData(slug: string, subcategorySlug?: string) {
  const { data: category, error: categoryError } = await (supabase.from('categories') as any)
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (categoryError || !category) return null;
  const categoryRecord = category as Category;

  const { data: subcategories } = await (supabase.from('subcategories') as any)
    .select('*')
    .eq('category_id', categoryRecord.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const subcategoryRecords = (subcategories || []) as Subcategory[];
  const selectedSubcategory = subcategorySlug
    ? subcategoryRecords.find((item) => item.slug === subcategorySlug)
    : null;

  let productsQuery = (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('category_id', categoryRecord.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (subcategorySlug && selectedSubcategory) {
    productsQuery = productsQuery.eq('subcategory_id', selectedSubcategory.id);
  }

  const { data: products } = await productsQuery;

  return {
    category: categoryRecord,
    subcategories: subcategoryRecords,
    selectedSubcategory: selectedSubcategory as Subcategory | null,
    products: ((products || []) as ProductWithDetails[]).map((product) => ({
      ...product,
      variants: [],
      images: [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order),
    })),
  };
}

async function getLegacyCategoryHref(slug: string) {
  if (slug !== 'electronics') return null;

  const { data } = await (supabase.from('categories') as any)
    .select('slug')
    .eq('is_active', true)
    .ilike('name', '%الكهرب%')
    .limit(1)
    .maybeSingle();

  return data?.slug ? `/category/${data.slug}` : null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const data = await getCategoryData(params.slug);
  if (!data) return { title: 'القسم غير موجود' };

  return {
    title: data.category.name,
    description: data.category.description || undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [data, settings] = await Promise.all([
    getCategoryData(params.slug, searchParams?.subcategory),
    getSettings(),
  ]);

  if (!data) {
    const legacyHref = await getLegacyCategoryHref(params.slug);
    if (legacyHref) {
      redirect(legacyHref);
    }

    notFound();
  }

  const { category, subcategories, products, selectedSubcategory } = data;
  const imageSrc = safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="border-b bg-muted/30">
          <div className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-[160px_1fr] md:items-center">
            <div className="relative aspect-square overflow-hidden rounded-lg border bg-background">
              <SafeImage
                src={imageSrc}
                fallbackSrc={PLACEHOLDER_CATEGORY}
                alt={category.name}
                fill
                priority
                className="object-cover"
                sizes="160px"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">قسم</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{category.name}</h1>
              {category.description && (
                <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{category.description}</p>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8">
          {subcategories.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              <Link
                href={`/category/${category.slug}`}
                className={
                  !selectedSubcategory
                    ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                    : 'rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted'
                }
              >
                الكل
              </Link>
              {subcategories.map((subcategory) => (
                <Link
                  key={subcategory.id}
                  href={`/category/${category.slug}?subcategory=${subcategory.slug}`}
                  className={
                    selectedSubcategory?.id === subcategory.id
                      ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                      : 'rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted'
                  }
                >
                  {subcategory.name}
                </Link>
              ))}
            </div>
          )}

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-16 text-center">
              <h2 className="text-lg font-semibold">لا توجد منتجات حالياً</h2>
              <p className="mt-2 text-sm text-muted-foreground">جرّب فئة أخرى أو ارجع لاحقاً.</p>
            </div>
          )}
        </section>
      </main>
      <Footer settings={settings} />
    </div>
  );
}
