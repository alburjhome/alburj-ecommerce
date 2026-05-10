import Link from 'next/link';
import { Metadata } from 'next';
import { Tag, Store, Box, Sofa, ChefHat, Sparkles, Boxes, Package, MessageCircle, Search, ArrowDownUp, HelpCircle, ArrowUpDown, Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { ProductCard } from '@/features/store/components/product-card';
import { ProductIntentFilters } from '@/features/store/components/product-intent-filters';
import { TrackedWhatsAppLink } from '@/components/tracked-whatsapp-link';
import { getWhatsAppLink } from '@/lib/store-settings';
import {
  getIntentConfig,
  normalizeIntent,
  productMatchesIntent,
  type ProductIntentKey,
} from '@/lib/product-intents';
import type { ProductWithDetails, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
  searchParams?: { search?: string; intent?: string; sort?: string };
}

export const metadata: Metadata = {
  title: 'منتجات مؤسسة البرج | مستلزمات البيت والمحل',
  description:
    'تصفح منتجات مؤسسة البرج من منظفات، بلاستيكيات، تغليف، أدوات منزلية، أدوات مطبخ، أجهزة كهربائية ومفروشات.',
};

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function productMatchesSearch(product: ProductWithDetails, term: string) {
  const q = normalizeSearchTerm(term);
  if (!q) return true;

  const candidates: string[] = [];
  if (product.name) candidates.push(product.name);
  if ((product as any).description) candidates.push((product as any).description);
  if ((product as any).short_description) candidates.push((product as any).short_description);
  if ((product as any).marketing_tagline) candidates.push((product as any).marketing_tagline);
  if ((product as any).sku) candidates.push((product as any).sku);
  if ((product as any).brand) candidates.push((product as any).brand);
  if ((product as any).category?.name) candidates.push((product as any).category.name);
  if ((product as any).subcategory?.name) candidates.push((product as any).subcategory.name);

  const tags = ((product as any).tags as string[] | null | undefined) || [];
  for (const tag of tags) {
    if (tag) candidates.push(tag);
  }

  const haystack = candidates
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();

  return haystack.includes(q);
}

async function getSettings() {
  const { data } = await supabase
    .from('store_settings')
    .select(
      'store_name, store_description, whatsapp_number, contact_email, contact_phone, address, facebook_url, instagram_url, tiktok_url, snapchat_url, youtube_url'
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as Pick<
    StoreSettings,
    | 'store_name'
    | 'store_description'
    | 'whatsapp_number'
    | 'contact_email'
    | 'contact_phone'
    | 'address'
    | 'facebook_url'
    | 'instagram_url'
    | 'tiktok_url'
    | 'snapchat_url'
    | 'youtube_url'
  > | null;
}

async function getProducts(search?: string) {
  let query = (supabase.from('products') as any)
    .select('*, images:product_images(*), category:categories(*), subcategory:subcategories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const term = search?.trim();

  const { data } = await query;
  const products = ((data || []) as ProductWithDetails[]).map((product) => ({
    ...product,
    variants: [],
    images: [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  if (!term) return products;
  return products.filter((product) => productMatchesSearch(product, term));
}

const quickShortcuts = [
  { href: '/offers', label: 'العروض', icon: Tag, color: 'bg-orange-100 text-orange-600' },
  { href: '/restaurants', label: 'للمطاعم', icon: Store, color: 'bg-blue-100 text-blue-600' },
  { href: '/packaging', label: 'التغليف', icon: Box, color: 'bg-green-100 text-green-600' },
  { href: '/plastic-products', label: 'البلاستيكيات', icon: Sofa, color: 'bg-purple-100 text-purple-600' },
  { href: '/home-kitchen', label: 'البيت والمطبخ', icon: ChefHat, color: 'bg-red-100 text-red-600' },
  { href: '/cleaning', label: 'التنظيف', icon: Sparkles, color: 'bg-cyan-100 text-cyan-600' },
  { href: '/bulk', label: 'الكميات', icon: Boxes, color: 'bg-amber-100 text-amber-600' },
];

const sortOptions = [
  { key: 'newest', label: 'الأحدث', icon: ArrowDownUp },
  { key: 'price_asc', label: 'السعر: الأقل', icon: ArrowUpDown },
  { key: 'price_desc', label: 'السعر: الأعلى', icon: ArrowUpDown },
  { key: 'offers', label: 'العروض', icon: Percent },
];

function buildProductsHref(params: { search?: string; intent?: string; sort?: string }) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.intent && params.intent !== 'all') searchParams.set('intent', params.intent);
  if (params.sort && params.sort !== 'newest') searchParams.set('sort', params.sort);
  const qs = searchParams.toString();
  return qs ? `/products?${qs}` : '/products';
}

function sortProducts(products: ProductWithDetails[], sort: string): ProductWithDetails[] {
  const sorted = [...products];

  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price_desc':
      return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'offers':
      return sorted.sort((a, b) => {
        const aIsOffer = a.compare_price && a.compare_price > (a.price || 0);
        const bIsOffer = b.compare_price && b.compare_price > (b.price || 0);
        const aHasOfferBadge = (a.product_badges || []).includes('offer');
        const bHasOfferBadge = (b.product_badges || []).includes('offer');
        const aScore = (aIsOffer ? 2 : 0) + (aHasOfferBadge ? 1 : 0);
        const bScore = (bIsOffer ? 2 : 0) + (bHasOfferBadge ? 1 : 0);
        return bScore - aScore;
      });
    case 'newest':
    default:
      return sorted.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
  }
}

function HeroSection({
  searchTerm,
  selectedIntent,
  intentConfig,
  whatsappUrl,
}: {
  searchTerm: string;
  selectedIntent: ProductIntentKey;
  intentConfig: { title: string; label: string };
  whatsappUrl: string | null;
}) {
  let title = 'كل منتجات مؤسسة البرج';
  let description = 'تصفح مستلزمات البيت والمحل من منظفات، تغليف، بلاستيكيات، أدوات منزلية، مطبخ، عروض وكميات.';

  if (searchTerm && selectedIntent !== 'all') {
    title = `نتائج "${searchTerm}" ضمن: ${intentConfig.title}`;
    description = 'هذه المنتجات تطابق بحثك والتصنيف المختار.';
  } else if (searchTerm) {
    title = `نتائج البحث عن: "${searchTerm}"`;
    description = 'جرّب كلمة أبسط إذا لم تجد المطلوب.';
  } else if (selectedIntent !== 'all') {
    title = intentConfig.title;
    description = `تصفح ${intentConfig.label} من مؤسسة البرج.`;
  }

  const heroMessage = 'مرحبا، أريد الاستفسار عن المنتجات المتوفرة.';
  const heroWhatsAppHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(heroMessage)}` : null;

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-8 md:py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{description}</p>

          <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
            {heroWhatsAppHref && !searchTerm && selectedIntent === 'all' && (
              <TrackedWhatsAppLink
                href={heroWhatsAppHref}
                source="products_hero_whatsapp"
                metadata={{ cta_name: 'products_hero' }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                استفسر عبر واتساب
              </TrackedWhatsAppLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickShortcutsSection() {
  return (
    <section className="py-4 md:py-6" dir="rtl">
      <div className="container mx-auto px-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">اختصارات سريعة:</p>
        <div className="flex flex-wrap gap-2">
          {quickShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80 ${item.color}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SortBar({
  currentSort,
  searchTerm,
  selectedIntent,
}: {
  currentSort: string;
  searchTerm: string;
  selectedIntent: ProductIntentKey;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3" dir="rtl">
      <span className="text-sm text-muted-foreground">الترتيب:</span>
      <div className="flex flex-wrap gap-2">
        {sortOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentSort === option.key;
          return (
            <Link
              key={option.key}
              href={buildProductsHref({
                search: searchTerm,
                intent: selectedIntent,
                sort: option.key,
              })}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ResultsCount({ count }: { count: number }) {
  return (
    <p className="text-sm text-muted-foreground" dir="rtl">
      {count === 0 ? 'لا توجد منتجات' : count === 1 ? 'منتج واحد' : `عرض ${count} منتج`}
    </p>
  );
}

function EmptyState({
  searchTerm,
  hasIntent,
  whatsappUrl,
}: {
  searchTerm: string;
  hasIntent: boolean;
  whatsappUrl: string | null;
}) {
  const emptyMessage = searchTerm
    ? 'مرحبا، أبحث عن منتج باسم "' + searchTerm + '" ولكن لم أجد نتائج. هل يمكنك المساعدة؟'
    : 'مرحبا، أحتاج مساعدة في العثور على المنتج المناسب.';
  const emptyHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(emptyMessage)}` : null;

  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-16 text-center" dir="rtl">
      <div className="mb-4 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <h2 className="text-lg font-semibold">لم نجد منتجات مطابقة</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {searchTerm
          ? 'جرّب كلمة أبسط مثل: شامبو، تغليف، كراسي، مناديل.'
          : hasIntent
            ? 'يمكنك تصفح كل المنتجات أو التواصل معنا لنساعدك.'
            : 'جرّب بحث مختلف أو تصفح الأقسام.'}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Package className="h-4 w-4" />
          تصفح كل المنتجات
        </Link>
        {emptyHref && (
          <TrackedWhatsAppLink
            href={emptyHref}
            source="products_empty_whatsapp"
            metadata={{ cta_name: 'products_empty', search_term: searchTerm }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            <MessageCircle className="h-4 w-4" />
            اسألنا عبر واتساب
          </TrackedWhatsAppLink>
        )}
      </div>
    </div>
  );
}

function HelpSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const helpMessage = 'مرحبا، أرسل لكم اسم منتج أو صورة وأحتاج مساعدة في توفره.';
  const helpHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(helpMessage)}` : null;

  return (
    <section className="py-8 md:py-12" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-6 md:p-10">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-right">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HelpCircle className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold md:text-2xl">لم تجد المنتج المطلوب؟</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  أرسل لنا اسم المنتج أو صورة منه وسنخبرك بالمتوفر
                </p>
              </div>
            </div>

            {helpHref ? (
              <TrackedWhatsAppLink
                href={helpHref}
                source="products_help_whatsapp"
                metadata={{ cta_name: 'products_help' }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-5 w-5" />
                اسأل عن منتج عبر واتساب
              </TrackedWhatsAppLink>
            ) : (
              <span className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                رقم واتساب غير مُعدّل حاليًا
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const [products, settings] = await Promise.all([getProducts(searchParams?.search), getSettings()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  const selectedIntent = normalizeIntent(searchParams?.intent);
  const intentConfig = getIntentConfig(selectedIntent);
  const searchTerm = searchParams?.search?.trim() || '';
  const currentSort = searchParams?.sort || 'newest';

  // Apply intent filter
  let filteredProducts = products;
  try {
    filteredProducts =
      selectedIntent === 'all'
        ? products
        : products.filter((product) => productMatchesIntent(product, selectedIntent));
  } catch (error) {
    console.error('Products intent filter failed', { selectedIntent, error });
    filteredProducts = products;
  }

  // Apply sort
  const sortedProducts = sortProducts(filteredProducts, currentSort);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />

      <main>
        <HeroSection
          searchTerm={searchTerm}
          selectedIntent={selectedIntent}
          intentConfig={intentConfig}
          whatsappUrl={whatsappUrl}
        />

        <QuickShortcutsSection />

        <section className="container mx-auto px-4 py-4" dir="rtl">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ProductIntentFilters selected={selectedIntent} />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ResultsCount count={sortedProducts.length} />
            <SortBar
              currentSort={currentSort}
              searchTerm={searchTerm}
              selectedIntent={selectedIntent}
            />
          </div>

          {sortedProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {sortedProducts.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
              <HelpSection whatsappUrl={whatsappUrl} />
            </>
          ) : (
            <EmptyState
              searchTerm={searchTerm}
              hasIntent={selectedIntent !== 'all'}
              whatsappUrl={whatsappUrl}
            />
          )}
        </section>
      </main>

      <Footer settings={settings} />
    </div>
  );
}
