'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export type ProductIntentKey =
  | 'all'
  | 'home'
  | 'restaurants'
  | 'shops'
  | 'packaging'
  | 'cleaning'
  | 'bulk';

export const INTENT_CONFIG: Array<{
  key: ProductIntentKey;
  label: string;
  title: string;
  categorySlugs: string[];
}> = [
  { key: 'all', label: 'الكل', title: 'جميع المنتجات', categorySlugs: [] },
  {
    key: 'home',
    label: 'للبيت',
    title: 'منتجات مناسبة للبيت',
    categorySlugs: ['home-kitchen', 'cleaning-paper-personal-care', 'furnishings-linens', 'electrical-appliances'],
  },
  {
    key: 'restaurants',
    label: 'للمطاعم والكافيهات',
    title: 'منتجات مناسبة للمطاعم والكافيهات',
    categorySlugs: ['restaurants-shops', 'plastic-packaging', 'cleaning-paper-personal-care'],
  },
  {
    key: 'shops',
    label: 'للمحلات',
    title: 'منتجات مناسبة للمحلات',
    categorySlugs: ['restaurants-shops', 'plastic-packaging', 'cleaning-paper-personal-care', 'offers-bulk'],
  },
  {
    key: 'packaging',
    label: 'للتغليف',
    title: 'مستلزمات التغليف',
    categorySlugs: ['plastic-packaging', 'restaurants-shops'],
  },
  {
    key: 'cleaning',
    label: 'للتنظيف اليومي',
    title: 'منتجات التنظيف اليومي',
    categorySlugs: ['cleaning-paper-personal-care', 'home-kitchen'],
  },
  {
    key: 'bulk',
    label: 'للكميات والعروض',
    title: 'عروض وكميات',
    categorySlugs: ['offers-bulk', 'plastic-packaging', 'restaurants-shops'],
  },
];

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
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold">تسوق حسب احتياجك</h2>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {INTENT_CONFIG.map((intent) => {
          const active = selected === intent.key;
          return (
            <Link
              key={intent.key}
              href={buildProductsHref(intent.key, search)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
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
