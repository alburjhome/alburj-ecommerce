'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { ProductWithDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { formatPrice, calculateDiscountPercentage } from '@/lib/utils';
import useCartStore from '@/stores/cart';

interface ProductCardProps {
  product: ProductWithDetails;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, openCart } = useCartStore();

  const primaryImage =
    product.images?.find((img) => img.is_primary)?.url ||
    product.images?.[0]?.url ||
    PLACEHOLDER_PRODUCT;
  const imageSrc = safeImageSrc(primaryImage, PLACEHOLDER_PRODUCT);

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

  return (
    <div className="group relative bg-card rounded-lg border overflow-hidden product-card">
      {hasDiscount && <span className="discount-badge">-{discountPercentage}%</span>}

      <div className="relative aspect-square overflow-hidden">
        <Link href={`/product/${product.slug}`} className="relative block h-full w-full image-zoom">
          <SafeImage
            src={imageSrc}
            fallbackSrc={PLACEHOLDER_PRODUCT}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
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

        <div className="mt-2 text-xs">
          {product.stock_quantity > 0 ? (
            <span className="in-stock">متوفر</span>
          ) : (
            <span className="out-of-stock">نفدت الكمية</span>
          )}
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={product.stock_quantity <= 0}
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
