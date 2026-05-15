import { expandSearchTerms } from '@/lib/search-aliases';
import { normalizeSearchQuery, normalizeSearchText } from '@/lib/search-normalization';
import type { ProductWithDetails } from '@/types';

export { buildProductSearchFields, suggestSearchKeywordsForProduct } from '@/lib/product-search-fields';
export type { ProductSearchFieldsInput, ProductSearchFieldsResult } from '@/lib/product-search-fields';

export interface SearchableProductFields {
  name?: string | null;
  description?: string | null;
  short_description?: string | null;
  marketing_tagline?: string | null;
  sku?: string | null;
  brand?: string | null;
  tags?: string[] | null;
  search_keywords?: string[] | null;
  normalized_search_text?: string | null;
  product_type?: string | null;
  category?: { name?: string | null } | null;
  subcategory?: { name?: string | null } | null;
  variants?: Array<{ name?: string | null; sku?: string | null; is_active?: boolean | null }> | null;
}

export function buildProductNormalizedSearchText(product: SearchableProductFields): string {
  const parts: string[] = [];

  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) parts.push(trimmed);
  };

  push(product.name);
  push(product.short_description);
  push(product.description);
  push(product.marketing_tagline);
  push(product.sku);
  push(product.brand);
  push(product.category?.name);
  push(product.subcategory?.name);

  for (const tag of product.tags || []) {
    push(tag);
  }

  for (const keyword of product.search_keywords || []) {
    push(keyword);
  }

  for (const variant of product.variants || []) {
    if (variant.is_active === false) continue;
    push(variant.name);
    push(variant.sku);
  }

  if (product.product_type === 'bundle') {
    parts.push('باكج', 'bundle', 'عرض');
  }

  return normalizeSearchText(parts.join(' '));
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return shorter / longer;
  }

  const aGrams = trigrams(a);
  const bGrams = trigrams(b);
  if (aGrams.size === 0 || bGrams.size === 0) return 0;

  let intersection = 0;
  aGrams.forEach((gram) => {
    if (bGrams.has(gram)) intersection += 1;
  });

  return (2 * intersection) / (aGrams.size + bGrams.size);
}

function scoreTermInHaystack(term: string, haystack: string): number {
  if (!term || !haystack) return 0;
  if (haystack.includes(term)) {
    if (haystack === term) return 100;
    if (haystack.startsWith(term) || haystack.endsWith(` ${term}`)) return 85;
    return 70;
  }

  const similarity = trigramSimilarity(term, haystack);
  if (similarity >= 0.45) return Math.round(similarity * 55);
  return 0;
}

export function scoreProductSearchMatch(product: SearchableProductFields, rawQuery: string): number {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return 0;

  const terms = expandSearchTerms(rawQuery);
  const haystack =
    product.normalized_search_text?.trim() ||
    buildProductNormalizedSearchText(product);
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedName = normalizeSearchText(product.name || '');
  const keywordSet = new Set(
    (product.search_keywords || []).map((keyword) => normalizeSearchText(keyword)).filter(Boolean)
  );

  let best = 0;

  for (const term of terms) {
    let termScore = scoreTermInHaystack(term, normalizedHaystack);
    if (normalizedName.includes(term)) {
      termScore = Math.max(termScore, normalizedName === term ? 95 : 80);
    }
    if (keywordSet.has(term)) {
      termScore = Math.max(termScore, 88);
    }
    keywordSet.forEach((keyword) => {
      if (keyword.includes(term) || term.includes(keyword)) {
        termScore = Math.max(termScore, 75);
      }
    });
    best = Math.max(best, termScore);
  }

  const fullQueryScore = Math.max(
    scoreTermInHaystack(query, normalizedHaystack),
    trigramSimilarity(query, normalizedHaystack) * 65
  );

  return Math.max(best, fullQueryScore);
}

export function filterProductsBySearch<T extends ProductWithDetails>(
  products: T[],
  rawQuery: string | undefined | null,
  options: { minScore?: number; limit?: number } = {}
): T[] {
  const query = rawQuery?.trim();
  if (!query) return products;

  const minScore = options.minScore ?? 35;
  const limit = options.limit;

  const ranked = products
    .map((product) => ({
      product,
      score: scoreProductSearchMatch(product, query),
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const sliced = limit ? ranked.slice(0, limit) : ranked;
  return sliced.map((entry) => entry.product);
}

export function getSearchQueryFromParams(
  params: { q?: string; search?: string } | undefined
): string {
  return params?.q?.trim() || params?.search?.trim() || '';
}

export function buildProductsSearchHref(
  query: string,
  extra?: { intent?: string; sort?: string }
): string {
  const searchParams = new URLSearchParams();
  const term = query.trim();
  if (term) searchParams.set('q', term);
  if (extra?.intent && extra.intent !== 'all') searchParams.set('intent', extra.intent);
  if (extra?.sort && extra.sort !== 'newest') searchParams.set('sort', extra.sort);
  const qs = searchParams.toString();
  return qs ? `/products?${qs}` : '/products';
}
