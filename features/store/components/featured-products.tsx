import { ProductWithDetails } from '@/types';
import { ProductCard } from './product-card';

interface FeaturedProductsProps {
  products: ProductWithDetails[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  if (!products.length) return null;

  return (
    <section id="featured-products" className="py-12 md:py-16 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">منتجات مميزة</h2>
          <a href="#featured-products" className="text-primary hover:underline">
            عرض الكل
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
