const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Normalize Arabic/English text for multilingual product search.
 */
export function normalizeSearchText(input: string): string {
  return input
    .replace(/[٠-٩]/g, (digit) => {
      const index = ARABIC_DIGITS.indexOf(digit);
      return index >= 0 ? String(index) : digit;
    })
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\u0640/g, '')
    .replace(/[\u064B-\u065F]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** @deprecated Use normalizeSearchText */
export function normalizeArabicSearch(input: string): string {
  return normalizeSearchText(input);
}

/** @deprecated Use normalizeSearchText */
export function normalizeEnglishSearch(input: string): string {
  return normalizeSearchText(input);
}

export function normalizeSearchQuery(input: string): string {
  return normalizeSearchText(input.trim());
}

export function tokenizeSearch(input: string): string[] {
  const normalized = normalizeSearchQuery(input);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}
