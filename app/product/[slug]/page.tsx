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
import { sortOptionValues, sortProductOptions, sortProductVariants } from '@/lib/product-variants';
import {
  buildProductJsonLd,
  getProductSeoDescription,
  getProductSeoImages,
  getSiteUrl,
  jsonLdScriptValue,
  SITE_NAME,
} from '@/lib/seo';
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
  const variantSelect = `
    *,
    images:product_images(*),
    category:categories(*),
    subcategory:subcategories(*),
    options:product_options(
      *,
      values:product_option_values(*)
    ),
    variants:product_variants(
      *,
      values:product_variant_values(
        *,
        option:product_options(*),
        option_value:product_option_values(*)
      )
    ),
    bundle_items:bundle_items!bundle_items_bundle_product_id_fkey(
      *,
      item_product:products!bundle_items_item_product_id_fkey(
        *,
        images:product_images(*)
      ),
      item_variant:product_variants!bundle_items_item_variant_id_fkey(
        *,
        values:product_variant_values(
          *,
          option:product_options(*),
          option_value:product_option_values(*)
        )
      )
    )
  `;

  const { data, error } = await (supabase.from('products') as any)
    .select(variantSelect)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!error && data) {
    const options = sortProductOptions(data.options || []).map((option) => ({
      ...option,
      values: sortOptionValues(option.values || []),
    }));

    return {
      ...data,
      product_type: data.product_type || 'single',
      options,
      variants: sortProductVariants(data.variants || []),
      bundle_items: (data.bundle_items || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
      images: (data.images || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
    } as ProductWithDetails;
  }

  const { data: legacyData, error: legacyError } = await (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (legacyError || !legacyData) return null;
  return {
    ...legacyData,
    product_type: legacyData.product_type || 'single',
    options: [],
    variants: [],
    bundle_items: [],
    images: (legacyData.images || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
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
        options: [],
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
        options: [],
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

  const baseUrl = getSiteUrl();
  const canonical = `${baseUrl}/product/${product.slug}`;

  const description = getProductSeoDescription(product);

  const primaryImage = safeImageSrc(getPrimaryProductImage(product), PLACEHOLDER_PRODUCT);
  const ogImageUrl = primaryImage.startsWith('http') ? primaryImage : `${baseUrl}${primaryImage}`;

  const title = product.meta_title || `${product.name} | ${SITE_NAME}`;

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
      siteName: SITE_NAME,
      images: [
        {
          url: ogImageUrl,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: getProductSeoImages(product, baseUrl).slice(0, 4),
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
  const productJsonLd = buildProductJsonLd(product);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScriptValue(productJsonLd),
        }}
      />
      <Header whatsappUrl={whatsappUrl} />
      <main>
        <ProductDetail product={product} whatsappNumber={settings?.whatsapp_number} />
        {recommendedAddons.length > 0 && <RecommendedAddons products={recommendedAddons} />}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
