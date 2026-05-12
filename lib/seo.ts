import { PLACEHOLDER_CATEGORY, PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { getProductImages, getPrimaryProductImage } from '@/lib/product-image';
import type { Category, ProductVariant, ProductWithDetails } from '@/types';

export const SITE_NAME = 'مؤسسة البرج';
export const DEFAULT_SITE_URL = 'https://alburj-ecommerce.vercel.app';
export const DEFAULT_CURRENCY = 'JOD';

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export function absoluteUrl(value: string | null | undefined, baseUrl = getSiteUrl()) {
  const safeValue = value?.trim();
  if (!safeValue) return baseUrl;
  if (safeValue.startsWith('http://') || safeValue.startsWith('https://')) return safeValue;
  if (safeValue.startsWith('/')) return `${baseUrl}${safeValue}`;
  return `${baseUrl}/${safeValue}`;
}

export function truncateMeta(value: string | null | undefined, maxLength = 160) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function getProductSeoDescription(product: ProductWithDetails) {
  return (
    truncateMeta(product.meta_description || product.short_description || product.description, 180) ||
    `تسوق ${product.name} من ${SITE_NAME} مع خيارات مناسبة للبيت والمحل والمطعم في الأردن.`
  );
}

export function getCategorySeoDescription(category: Category) {
  return (
    truncateMeta(category.description, 180) ||
    `تسوق منتجات قسم ${category.name} في الأردن من ${SITE_NAME} مع خيارات مناسبة للبيت والمحل والمطعم.`
  );
}

export function getCategorySeoImage(category: Category, baseUrl = getSiteUrl()) {
  return absoluteUrl(safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY), baseUrl);
}

function variantIsSellable(variant: ProductVariant) {
  if (!variant.is_active) return false;
  if (!variant.track_stock) return true;
  return (variant.stock_quantity ?? 0) > 0;
}

function productIsSellable(product: ProductWithDetails) {
  if (!product.track_stock) return true;
  if (product.allow_backorders) return true;
  return (product.stock_quantity ?? 0) > 0;
}

export function getActiveProductVariants(product: ProductWithDetails) {
  return (product.variants || []).filter((variant) => variant.is_active);
}

export function getProductOfferInfo(product: ProductWithDetails) {
  const activeVariants = getActiveProductVariants(product);

  if (activeVariants.length > 0) {
    const prices = activeVariants
      .map((variant) => Number(variant.price))
      .filter((price) => Number.isFinite(price) && price >= 0);
    const price = prices.length > 0 ? Math.min(...prices) : Number(product.price || 0);

    return {
      price,
      inStock: activeVariants.some(variantIsSellable),
    };
  }

  return {
    price: Number(product.price || 0),
    inStock: productIsSellable(product),
  };
}

export function getProductSeoImages(product: ProductWithDetails, baseUrl = getSiteUrl()) {
  const images = getProductImages(product)
    .map((image) => safeImageSrc(image.url, PLACEHOLDER_PRODUCT))
    .filter(Boolean);
  const variantImages = getActiveProductVariants(product)
    .map((variant) => safeImageSrc(variant.image_url, ''))
    .filter(Boolean);

  const uniqueImages = Array.from(new Set([...images, ...variantImages]));
  const fallback = safeImageSrc(getPrimaryProductImage(product), PLACEHOLDER_PRODUCT);
  const finalImages = uniqueImages.length > 0 ? uniqueImages : [fallback];

  return finalImages.map((image) => absoluteUrl(image, baseUrl));
}

export function buildProductJsonLd(product: ProductWithDetails, baseUrl = getSiteUrl()) {
  const canonical = `${baseUrl}/product/${product.slug}`;
  const offer = getProductOfferInfo(product);
  const images = getProductSeoImages(product, baseUrl);
  const description = getProductSeoDescription(product);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: images,
    sku: product.sku || undefined,
    brand: {
      '@type': 'Brand',
      name: product.brand || SITE_NAME,
    },
    category: product.category?.name || product.subcategory?.name || undefined,
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: DEFAULT_CURRENCY,
      price: offer.price.toFixed(2),
      availability: offer.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  return JSON.parse(JSON.stringify(productSchema));
}

export function jsonLdScriptValue(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
