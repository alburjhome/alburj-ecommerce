import { ProductImage } from '@/types';

const PLACEHOLDER_PRODUCT = '/placeholder-product.svg';

/**
 * Safely extract the primary product image from various data shapes.
 * Supports multiple source formats:
 * - product.images (ProductImage[])
 * - product.product_images (ProductImage[])
 * - product.image_url (string)
 * - product.primary_image_url (string)
 *
 * Priority:
 * 1. Image with is_primary = true
 * 2. First image sorted by sort_order
 * 3. image_url if available
 * 4. Placeholder
 */
export function getPrimaryProductImage(product: any): string {
  if (!product) {
    return PLACEHOLDER_PRODUCT;
  }

  // Try product.images (most common alias)
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const sortedImages = [...product.images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const primaryImage = sortedImages.find((img) => img.is_primary);
    if (primaryImage?.url) return primaryImage.url;
    if (sortedImages[0]?.url) return sortedImages[0].url;
  }

  // Try product.product_images (direct table name)
  if (product.product_images && Array.isArray(product.product_images) && product.product_images.length > 0) {
    const sortedImages = [...product.product_images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const primaryImage = sortedImages.find((img) => img.is_primary);
    if (primaryImage?.url) return primaryImage.url;
    if (sortedImages[0]?.url) return sortedImages[0].url;
  }

  // Try direct image_url on product
  if (product.image_url) {
    return product.image_url;
  }

  // Try primary_image_url
  if (product.primary_image_url) {
    return product.primary_image_url;
  }

  return PLACEHOLDER_PRODUCT;
}

/**
 * Get all product images sorted by sort_order
 */
export function getProductImages(product: any): ProductImage[] {
  if (!product) return [];

  const images = product.images || product.product_images || [];
  if (!Array.isArray(images)) return [];

  return [...images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

/**
 * Debug helper - logs image extraction issues (dev only)
 */
export function debugProductImage(product: any, source: string): void {
  if (process.env.NODE_ENV !== 'development') return;

  const hasImages = !!(product?.images?.length || product?.product_images?.length);
  const imageUrl = getPrimaryProductImage(product);
  const isPlaceholder = imageUrl === PLACEHOLDER_PRODUCT;

  if (hasImages && isPlaceholder) {
    console.warn(`[ProductImage Debug] ${source}: Product "${product?.name || product?.id}" has images but helper returned placeholder`, {
      productId: product?.id,
      imagesCount: product?.images?.length || product?.product_images?.length || 0,
      images: product?.images || product?.product_images,
    });
  }
}
