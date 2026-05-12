'use client';

import Link from 'next/link';
import { Flame, ShoppingCart, Tag } from 'lucide-react';
import { ProductWithDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import { getPrimaryProductImage } from '@/lib/product-image';
import { calculateDiscountPercentage, formatPrice } from '@/lib/utils';
import { isVariantInStock } from '@/lib/product-variants';
import useCartStore from '@/stores/cart';

interface ProductCardProps {
  product: ProductWithDetails;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  const productHref = `/product/${product.slug}`;
  const imageSrc = getPrimaryProductImage(product);
  const hasDiscount = Boolean(product.compare_price && product.compare_price > product.price);
  const discountPercentage = hasDiscount
    ? calculateDiscountPercentage(product.price, product.compare_price || product.price)
    : 0;

  const hasActiveVariants = (product.variants || []).some((variant) => variant.is_active);
  const hasAvailableVariant = (product.variants || []).some(
    (variant) => variant.is_active && isVariantInStock(variant)
  );
  const isAvailable = hasActiveVariants
    ? hasAvailableVariant
    : !product.track_stock || (product.stock_quantity ?? 0) > 0;

  function handleAddToCart() {
    if (hasActiveVariants || !isAvailable) return;

    addItem({
      product_id: product.id,
      variant_id: null,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: imageSrc,
      sku: product.sku,
      stock_quantity: product.track_stock ? product.stock_quantity : 99,
    });
    openCart();
  }

  const marketingBadgeLabel = (badge: string) => {
    switch (badge) {
      case 'bestselling':
        return 'الأكثر طلبًا';
      case 'offer':
        return 'عرض';
      case 'new':
        return 'جديد';
      case 'wholesale':
        return 'سعر جملة';
      case 'limited':
        return 'كمية محدودة';
      default:
        return null;
    }
  };

  const firstMarketingBadge = product.product_badges?.[0]
    ? marketingBadgeLabel(product.product_badges[0])
    : null;

  return (
    <div className="group product-card relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5">
        {product.is_featured && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Flame className="h-3 w-3" />
            الأكثر طلبًا
          </span>
        )}
        {hasDiscount && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Tag className="h-3 w-3" />
            خصم {discountPercentage}%
          </span>
        )}
        {firstMarketingBadge && (
          <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            {firstMarketingBadge}
          </span>
        )}
        {isAvailable && (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            متوفر
          </span>
        )}
      </div>

      <div className="relative aspect-square overflow-hidden">
        <Link href={productHref} className="relative block h-full w-full image-zoom">
          <SafeImage
            src={imageSrc}
            fallbackSrc={PLACEHOLDER_PRODUCT}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            priority={priority}
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {hasActiveVariants ? (
            <Button asChild variant="secondary" size="icon" className="pointer-events-auto rounded-full">
              <Link href={productHref} aria-label="اختيار خيارات المنتج">
                <ShoppingCart className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="icon"
              className="pointer-events-auto rounded-full"
              onClick={handleAddToCart}
              disabled={!isAvailable}
              aria-label="إضافة للسلة"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        <Link href={productHref}>
          <h3 className="line-clamp-2 text-sm font-medium transition-colors hover:text-primary">
            {product.name}
          </h3>
        </Link>

        {product.marketing_tagline && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.marketing_tagline}</p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <span className="price-current">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="price-compare">{formatPrice(product.compare_price || 0)}</span>
          )}
        </div>

        {!isAvailable && (
          <div className="mt-2 text-xs">
            <span className="out-of-stock">نفدت الكمية</span>
          </div>
        )}

        {hasActiveVariants ? (
          <Button asChild className="mt-3 w-full md:hidden" size="sm">
            <Link href={productHref}>
              <ShoppingCart className="ml-2 h-4 w-4" />
              اختيار الخيارات
            </Link>
          </Button>
        ) : (
          <Button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className="mt-3 w-full md:hidden"
            size="sm"
          >
            <ShoppingCart className="ml-2 h-4 w-4" />
            أضف للسلة
          </Button>
        )}
      </div>
    </div>
  );
}
