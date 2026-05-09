import Link from 'next/link';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import { getWhatsAppLink } from '@/lib/store-settings';
import { safeImageSrc, PLACEHOLDER_CATEGORY } from '@/lib/image-utils';
import type { Category, ProductWithDetails, StoreSettings, Subcategory } from '@/types';

export const dynamic = 'force-dynamic';

interface CategoryPageProps {
  params: { slug: string };
  searchParams?: { subcategory?: string };
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

  // Debug: Log first product's image data (dev only)
  if (process.env.NODE_ENV === 'development' && products && products.length > 0) {
    const firstProduct = products[0];
    console.log('[Category Debug] First product:', {
      id: firstProduct.id,
      name: firstProduct.name,
      imagesCount: firstProduct.images?.length || 0,
      hasImages: !!firstProduct.images,
      imageKeys: firstProduct.images ? Object.keys(firstProduct.images) : 'none',
    });
  }

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

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '');
  const canonical = `${baseUrl}/category/${data.category.slug}`;

  const title = `${data.category.name} | مؤسسة البرج`;
  const rawDescription = data.category.description || `تصفح منتجات قسم ${data.category.name} من مؤسسة البرج.`;
  const description = rawDescription.length > 180 ? `${rawDescription.slice(0, 177)}...` : rawDescription;

  const image = safeImageSrc((data.category as any).image_url, PLACEHOLDER_CATEGORY);
  const ogImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: ogImageUrl
        ? [
            {
              url: ogImageUrl,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [categoryData, settings] = await Promise.all([
    getCategoryData(params.slug, searchParams?.subcategory),
    getSettings(),
  ]);

  if (!categoryData) {
    const legacyHref = await getLegacyCategoryHref(params.slug);
    if (legacyHref) {
      redirect(legacyHref);
    }

    notFound();
  }

  const { category, subcategories, selectedSubcategory, products } = categoryData;
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />
      <main>
        {/* Clean Hero - No large image */}
        <section className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-6 md:py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-foreground transition-colors">الرئيسية</Link>
              <span>/</span>
              <Link href="/categories" className="hover:text-foreground transition-colors">الأقسام</Link>
              <span>/</span>
              <span className="text-foreground font-medium">{category.name}</span>
            </nav>
            {/* Title & Description */}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{category.name}</h1>
            {category.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm md:text-base">{category.description}</p>
            )}
          </div>
        </section>

        <section className="container mx-auto px-4 py-6 md:py-8">
          {/* Filter Chips - Professional Horizontal Scroll on Mobile */}
          {subcategories.length > 0 && (
            <div className="mb-6 md:mb-8">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {/* All Button - Sticky/Pinned at start */}
                <Link
                  href={`/category/${category.slug}`}
                  className={
                    !selectedSubcategory
                      ? 'shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm'
                      : 'shrink-0 rounded-full border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors'
                  }
                >
                  الكل
                </Link>
                {/* Subcategory Chips */}
                {subcategories.map((subcategory) => (
                  <Link
                    key={subcategory.id}
                    href={`/category/${category.slug}?subcategory=${subcategory.slug}`}
                    className={
                      selectedSubcategory?.id === subcategory.id
                        ? 'shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm'
                        : 'shrink-0 rounded-full border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors'
                    }
                  >
                    {subcategory.name}
                  </Link>
                ))}
              </div>
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
