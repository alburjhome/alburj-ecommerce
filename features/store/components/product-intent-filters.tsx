'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { INTENT_CONFIG, type ProductIntentKey } from '@/lib/product-intents';

interface ProductIntentFiltersProps {
  selected: ProductIntentKey;
}

function buildProductsHref(intent: ProductIntentKey, search: string | null) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (intent !== 'all') params.set('intent', intent);
  const qs = params.toString();
  return qs ? `/products?${qs}` : '/products';
}

export function ProductIntentFilters({ selected }: ProductIntentFiltersProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get('search');

  return (
    <section className="mb-3 md:mb-6">
      <div className="mb-2 md:mb-3">
        <h2 className="text-sm font-semibold md:text-base">تسوق حسب احتياجك</h2>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {INTENT_CONFIG.map((intent) => {
          const active = selected === intent.key;
          return (
            <Link
              key={intent.key}
              href={buildProductsHref(intent.key, search)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors md:px-4 md:py-2 md:text-sm',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground hover:bg-muted'
              )}
            >
              {intent.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
