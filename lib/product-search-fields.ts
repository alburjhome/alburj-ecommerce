import { suggestAliasesForText } from '@/lib/search-aliases';
import { normalizeSearchText, tokenizeSearch } from '@/lib/search-normalization';
import {
  buildProductNormalizedSearchText,
  type SearchableProductFields,
} from '@/lib/product-search';

export interface ProductSearchFieldsInput extends SearchableProductFields {
  key_features?: string[] | null;
}

export interface ProductSearchFieldsResult {
  search_keywords: string[];
  normalized_search_text: string;
}

const MAX_KEYWORDS = 30;
const MAX_KEYWORD_LENGTH = 60;

function keywordKey(value: string): string {
  return normalizeSearchText(value);
}

function mergeSearchKeywords(
  existing: string[] | null | undefined,
  suggested: string[]
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  const add = (value: string) => {
    const trimmed = value.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (!trimmed) return;
    const key = keywordKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  };

  for (const keyword of existing || []) {
    if (merged.length >= MAX_KEYWORDS) break;
    add(keyword);
  }

  for (const keyword of suggested) {
    if (merged.length >= MAX_KEYWORDS) break;
    add(keyword);
  }

  return merged;
}

function collectNameTokens(name: string | null | undefined): string[] {
  if (!name?.trim()) return [];
  const tokens: string[] = [];
  for (const part of name.split(/[\s,/|،+&-]+/)) {
    const trimmed = part.trim();
    if (trimmed.length >= 2) tokens.push(trimmed);
  }
  return tokens;
}

/**
 * Suggest search keywords from product content using aliases (no AI).
 */
export function suggestSearchKeywordsForProduct(product: ProductSearchFieldsInput): string[] {
  const contentParts: string[] = [];

  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) contentParts.push(trimmed);
  };

  push(product.name);
  push(product.short_description);
  push(product.description);
  push(product.marketing_tagline);
  push(product.category?.name);
  push(product.subcategory?.name);
  push(product.brand);
  push(product.sku);

  for (const tag of product.tags || []) push(tag);
  for (const feature of product.key_features || []) push(feature);

  const content = contentParts.join(' ');
  const suggested = new Set<string>();

  for (const token of collectNameTokens(product.name)) {
    suggested.add(token);
  }

  for (const token of tokenizeSearch(content)) {
    if (token.length >= 2) suggested.add(token);
  }

  for (const alias of suggestAliasesForText(content)) {
    suggested.add(alias);
  }

  if (product.product_type === 'bundle') {
    suggested.add('باكج');
    suggested.add('bundle');
  }

  return Array.from(suggested).slice(0, MAX_KEYWORDS);
}

/**
 * Build search_keywords (merge-safe) and normalized_search_text for a product.
 */
export function buildProductSearchFields(product: ProductSearchFieldsInput): ProductSearchFieldsResult {
  const suggested = suggestSearchKeywordsForProduct(product);
  const search_keywords = mergeSearchKeywords(product.search_keywords, suggested);
  const normalized_search_text = buildProductNormalizedSearchText({
    ...product,
    search_keywords,
  });

  return {
    search_keywords,
    normalized_search_text,
  };
}
