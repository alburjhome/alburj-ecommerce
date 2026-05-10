import { ProductWithDetails } from '@/types';
import { Package } from 'lucide-react';
import { ProductCard } from './product-card';

interface FeaturedProductsProps {
  products: ProductWithDetails[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section id="featured-products" className="py-8 md:py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">منتجات مختارة</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            أفضل المنتجات طلبًا من زبائن مؤسسة البرج
          </p>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد منتجات مختارة حاليًا</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
