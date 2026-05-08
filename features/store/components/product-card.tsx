'use client';

import Link from 'next/link';
import { ShoppingCart, Flame, Tag } from 'lucide-react';
import { ProductWithDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import { getPrimaryProductImage, debugProductImage } from '@/lib/product-image';
import { formatPrice, calculateDiscountPercentage } from '@/lib/utils';
import useCartStore from '@/stores/cart';

interface ProductCardProps {
  product: ProductWithDetails;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem, openCart } = useCartStore();

  const imageSrc = getPrimaryProductImage(product);
  debugProductImage(product, 'ProductCard');

  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPercentage = hasDiscount
    ? calculateDiscountPercentage(product.price, product.compare_price!)
    : 0;

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      variant_id: null,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: imageSrc,
      stock_quantity: product.stock_quantity,
    });
    openCart();
  };

  const isAvailable = !product.track_stock || (product.stock_quantity ?? 0) > 0;

  return (
    <div className="group relative bg-card rounded-lg border overflow-hidden product-card">
      {/* Badges Stack */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
        {product.is_featured && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Flame className="h-3 w-3" />
            الأكثر طلبًا
          </span>
        )}
        {hasDiscount && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Tag className="h-3 w-3" />
            عرض
          </span>
        )}
        {isAvailable && (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            متوفر
          </span>
        )}
      </div>

      <div className="relative aspect-square overflow-hidden">
        <Link href={`/product/${product.slug}`} className="relative block h-full w-full image-zoom">
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
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full pointer-events-auto"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <span className="price-current">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="price-compare">{formatPrice(product.compare_price!)}</span>
          )}
        </div>

        {/* Out of stock warning only */}
        {!isAvailable && (
          <div className="mt-2 text-xs">
            <span className="out-of-stock">نفدت الكمية</span>
          </div>
        )}

        {/* Add to Cart Button - Only disabled when truly out of stock */}
        <Button
          onClick={handleAddToCart}
          disabled={product.track_stock && (product.stock_quantity ?? 0) <= 0}
          className="w-full mt-3 md:hidden"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4 ml-2" />
          أضف للسلة
        </Button>
      </div>
    </div>
  );
}
