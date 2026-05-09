import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductDetail } from '@/features/store/components/product-detail';
import { RecommendedAddons } from '@/features/store/components/recommended-addons';
import { getWhatsAppLink } from '@/lib/store-settings';
import { getPrimaryProductImage } from '@/lib/product-image';
import { safeImageSrc, PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import type { ProductWithDetails, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: { slug: string };
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

async function getRecommendedAddons(product: ProductWithDetails) {
  const isAvailable = (item: ProductWithDetails) => {
    const stockQty = item.stock_quantity ?? 0;
    if (!item.is_active) return false;
    if (!item.track_stock) return true;
    if (item.allow_backorders) return true;
    return stockQty > 0;
  };

  const selected: ProductWithDetails[] = [];
  const selectedIds = new Set<string>();

  async function fetchBy(field: 'subcategory_id' | 'category_id', value: string) {
    const { data } = await (supabase.from('products') as any)
      .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
      .eq('is_active', true)
      .eq(field, value)
      .neq('id', product.id)
      .order('created_at', { ascending: false })
      .limit(12);

    return (data || []) as ProductWithDetails[];
  }

  if (product.subcategory_id) {
    const candidates = await fetchBy('subcategory_id', product.subcategory_id);
    for (const candidate of candidates) {
      if (selected.length >= 4) break;
      if (selectedIds.has(candidate.id)) continue;
      if (!isAvailable(candidate)) continue;
      selected.push({
        ...candidate,
        variants: [],
        images: [...(candidate.images || [])].sort((a, b) => a.sort_order - b.sort_order),
      });
      selectedIds.add(candidate.id);
    }
  }

  if (selected.length < 4 && product.category_id) {
    const candidates = await fetchBy('category_id', product.category_id);
    for (const candidate of candidates) {
      if (selected.length >= 4) break;
      if (selectedIds.has(candidate.id)) continue;
      if (!isAvailable(candidate)) continue;
      selected.push({
        ...candidate,
        variants: [],
        images: [...(candidate.images || [])].sort((a, b) => a.sort_order - b.sort_order),
      });
      selectedIds.add(candidate.id);
    }
  }

  return selected.slice(0, 4);
}

async function getLegacyProductHref(slug: string) {
  if (slug !== '1') return null;

  const { data } = await (supabase.from('products') as any)
    .select('slug')
    .eq('is_active', true)
    .ilike('name', '%بلص فايف%')
    .limit(1)
    .maybeSingle();

  return data?.slug ? `/product/${data.slug}` : null;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) {
    return { title: 'المنتج غير موجود' };
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '');
  const canonical = `${baseUrl}/product/${product.slug}`;

  const rawDescription =
    product.meta_description || product.short_description || product.description || '';
  const description = rawDescription
    ? rawDescription.length > 180
      ? `${rawDescription.slice(0, 177)}...`
      : rawDescription
    : undefined;

  const primaryImage = safeImageSrc(getPrimaryProductImage(product), PLACEHOLDER_PRODUCT);
  const ogImageUrl = primaryImage.startsWith('http') ? primaryImage : `${baseUrl}${primaryImage}`;

  const title = product.meta_title || product.name;

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

export default async function ProductPage({ params }: ProductPageProps) {
  const [product, settings] = await Promise.all([getProduct(params.slug), getSettings()]);

  if (!product) {
    const legacyHref = await getLegacyProductHref(params.slug);
    if (legacyHref) {
      redirect(legacyHref);
    }

    notFound();
  }

  const recommendedAddons = await getRecommendedAddons(product);

  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />
      <main>
        <ProductDetail product={product} whatsappNumber={settings?.whatsapp_number} />
        {recommendedAddons.length > 0 && <RecommendedAddons products={recommendedAddons} />}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
