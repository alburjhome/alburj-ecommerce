'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import { getPrimaryProductImage } from '@/lib/product-image';
import { formatPrice } from '@/lib/utils';
import type { ProductWithDetails } from '@/types';
import useCartStore from '@/stores/cart';

interface RecommendedAddonsProps {
  products: ProductWithDetails[];
}

export function RecommendedAddons({ products }: RecommendedAddonsProps) {
  const { addItem, openCart } = useCartStore();

  if (!products.length) return null;

  return (
    <section className="container mx-auto px-4 pb-10">
      <div className="mb-4">
        <h2 className="text-xl font-bold">يكمل معه</h2>
        <p className="mt-1 text-sm text-muted-foreground">منتجات قد تحتاجها مع هذا المنتج</p>
      </div>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {products.map((product) => {
          const imageSrc = getPrimaryProductImage(product);
          const href = `/product/${product.slug}`;

          return (
            <div
              key={product.id}
              className="min-w-[240px] rounded-xl border bg-card p-3 sm:min-w-0"
            >
              <Link href={href} className="block">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  <SafeImage
                    src={imageSrc}
                    fallbackSrc={PLACEHOLDER_PRODUCT}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 60vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
              </Link>

              <div className="mt-3">
                <Link href={href}>
                  <h3 className="line-clamp-2 text-sm font-semibold hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                </Link>

                <div className="mt-2 text-sm font-bold text-primary">{formatPrice(product.price)}</div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
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
                    }}
                    disabled={product.track_stock && (product.stock_quantity ?? 0) <= 0 && !product.allow_backorders}
                  >
                    <ShoppingCart className="ml-2 h-4 w-4" />
                    أضف للسلة
                  </Button>

                  <Button asChild type="button" size="sm" variant="outline">
                    <Link href={href}>عرض المنتج</Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
