import Link from 'next/link';
import { ProductWithDetails } from '@/types';
import { ArrowLeft, Package } from 'lucide-react';
import { ProductCard } from './product-card';

interface FeaturedProductsProps {
  products: ProductWithDetails[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section id="featured-products" className="bg-slate-50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-primary ring-1 ring-border">
              مختارة بعناية
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">منتجات يحتاجها البيت والمحل يوميًا</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground md:text-base">
              مجموعة سريعة من المنتجات الأكثر طلبًا لتبدأ الطلب بدون بحث طويل.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-primary/80"
          >
            عرض كل المنتجات
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد منتجات مختارة حاليًا</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:gap-5">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
