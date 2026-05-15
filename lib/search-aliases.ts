import { normalizeSearchText, tokenizeSearch } from '@/lib/search-normalization';

/** Canonical synonym groups for multilingual smart search. */
const ALIAS_GROUPS: string[][] = [
  [
    'كاسات',
    'كاسة',
    'كبايات',
    'كباية',
    'اكواب',
    'أكواب',
    'اكواب',
    'كوب',
    'كاسلت',
    'cups',
    'cup',
    'paper cups',
    'paper cup',
    'coffee cups',
    'coffee cup',
  ],
  ['صحون', 'صحن', 'اطباق', 'أطباق', 'plate', 'plates', 'dish', 'dishes'],
  ['علب', 'علبة', 'بوكس', 'بوكسات', 'box', 'boxes', 'container', 'containers'],
  ['أكياس', 'اكياس', 'كيس', 'اكياس', 'bags', 'bag', 'plastic bags', 'nylon', 'نايلون'],
  ['محارم', 'مناديل', 'tissue', 'tissues', 'napkin', 'napkins', 'منشفة', 'مناشف'],
  [
    'منظفات',
    'منظف',
    'تنظيف',
    'سائل جلي',
    'جلي',
    'detergent',
    'dishwashing',
    'dish soap',
    'cleaner',
    'cleaners',
  ],
  ['تغليف', 'باكجنج', 'packaging', 'packing', 'wrap', 'wrapping'],
  ['سوشي', 'sushi', 'sushi box', 'علبة سوشي', 'علب سوشي'],
  ['مطاعم', 'مطعم', 'كافيه', 'كوفي', 'cafe', 'restaurant', 'restaurants', 'takeaway'],
  ['بلاستيك', 'بلاستيكي', 'plastic', 'disposable', 'سفري', 'استعمال مرة واحدة', 'one time use'],
];

const aliasLookup = new Map<string, Set<string>>();

function registerAliasGroup(group: string[]) {
  const normalizedTerms = Array.from(
    new Set(group.map((term) => normalizeSearchText(term)).filter(Boolean))
  );
  for (const term of normalizedTerms) {
    if (!aliasLookup.has(term)) {
      aliasLookup.set(term, new Set());
    }
    const bucket = aliasLookup.get(term)!;
    for (const other of normalizedTerms) {
      bucket.add(other);
    }
  }
}

for (const group of ALIAS_GROUPS) {
  registerAliasGroup(group);
}

/** Legacy export for direct token lookup. */
export const searchAliases: Record<string, string[]> = Object.fromEntries(
  Array.from(aliasLookup.entries()).map(([key, value]) => [key, Array.from(value)])
);

function textMatchesAliasTerm(normalizedContent: string, normalizedTerm: string): boolean {
  if (!normalizedTerm || normalizedTerm.length < 2) return false;
  if (normalizedContent.includes(normalizedTerm)) return true;

  const contentTokens = tokenizeSearch(normalizedContent);
  return contentTokens.some(
    (token) => token.includes(normalizedTerm) || normalizedTerm.includes(token)
  );
}

/**
 * Return alias terms from groups that match product text (no AI).
 */
export function suggestAliasesForText(text: string): string[] {
  const normalizedContent = normalizeSearchText(text);
  if (!normalizedContent) return [];

  const keywords = new Set<string>();

  for (const group of ALIAS_GROUPS) {
    const groupMatches = group.some((term) =>
      textMatchesAliasTerm(normalizedContent, normalizeSearchText(term))
    );

    if (!groupMatches) continue;

    for (const term of group) {
      const trimmed = term.trim();
      if (trimmed) keywords.add(trimmed);
    }
  }

  return Array.from(keywords);
}

/**
 * Expand a query into normalized tokens plus known synonyms.
 */
export function expandSearchTerms(input: string): string[] {
  const tokens = tokenizeSearch(input);
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    const aliases = aliasLookup.get(token);
    if (aliases) {
      Array.from(aliases).forEach((alias) => expanded.add(alias));
    }
  }

  const fullQuery = normalizeSearchText(input);
  if (fullQuery) {
    expanded.add(fullQuery);
    const fullAliases = aliasLookup.get(fullQuery);
    if (fullAliases) {
      Array.from(fullAliases).forEach((alias) => expanded.add(alias));
    }
  }

  return Array.from(expanded);
}
