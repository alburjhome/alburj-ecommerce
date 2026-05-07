const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PHRASE_MAP: Array<[string, string]> = [
  ['الأجهزة الكهربائية', 'electrical appliances'],
  ['الاجهزة الكهربائية', 'electrical appliances'],
  ['المنظفات والورقيات', 'cleaning paper'],
  ['المنظفات والورقيات والعناية الشخصية', 'cleaning paper personal care'],
  ['مستلزمات المطاعم والمحلات', 'restaurants shops'],
  ['الأدوات المنزلية والمطبخ', 'home kitchen'],
  ['الادوات المنزلية والمطبخ', 'home kitchen'],
  ['البلاستيك والتغليف', 'plastic packaging'],
  ['المفروشات والبياضات', 'furnishings linens'],
  ['العروض والكميات', 'offers bulk'],
  ['منظفات الأرضيات والأسطح', 'floor surface cleaners'],
  ['منظفات الارضيات والاسطح', 'floor surface cleaners'],
  ['منظفات المطابخ والحمامات', 'kitchen bathroom cleaners'],
  ['سوائل الجلي والصابون', 'dishwashing soap liquids'],
  ['المعقمات والمطهرات', 'sanitizers disinfectants'],
  ['الورقيات والمحارم', 'paper tissues'],
  ['أكياس النفايات', 'garbage bags'],
  ['اكياس النفايات', 'garbage bags'],
  ['أدوات التنظيف', 'cleaning tools'],
  ['ادوات التنظيف', 'cleaning tools'],
  ['العناية الشخصية والصحية', 'personal health care'],
];

const WORD_MAP: Record<string, string> = {
  'الأجهزة': 'electrical',
  'الاجهزة': 'electrical',
  'كهربائية': 'electrical',
  'الكهربائية': 'electrical',
  'المنظفات': 'cleaning',
  'منظفات': 'cleaning',
  'الورقيات': 'paper',
  'ورقيات': 'paper',
  'والورقيات': 'paper',
  'مستلزمات': 'supplies',
  'المطاعم': 'restaurants',
  'والمطاعم': 'restaurants',
  'المحلات': 'shops',
  'والمحلات': 'shops',
  'الأدوات': 'tools',
  'الادوات': 'tools',
  'المنزلية': 'home',
  'المطبخ': 'kitchen',
  'والمطبخ': 'kitchen',
  'البلاستيك': 'plastic',
  'التغليف': 'packaging',
  'والتغليف': 'packaging',
  'المفروشات': 'furnishings',
  'البياضات': 'linens',
  'والبياضات': 'linens',
  'العروض': 'offers',
  'الكميات': 'bulk',
  'والكميات': 'bulk',
  'شامبو': 'shampoo',
  'بلص': 'plus',
  'فايف': 'five',
  'سجاد': 'carpet',
  'للسجاد': 'carpet',
  'عالي': 'high',
  'الرغوة': 'foam',
  'لتر': 'liter',
};

const ARABIC_LETTER_MAP: Record<string, string> = {
  'ا': 'a',
  'أ': 'a',
  'إ': 'i',
  'آ': 'a',
  'ب': 'b',
  'ت': 't',
  'ث': 'th',
  'ج': 'j',
  'ح': 'h',
  'خ': 'kh',
  'د': 'd',
  'ذ': 'dh',
  'ر': 'r',
  'ز': 'z',
  'س': 's',
  'ش': 'sh',
  'ص': 's',
  'ض': 'd',
  'ط': 't',
  'ظ': 'z',
  'ع': 'a',
  'غ': 'gh',
  'ف': 'f',
  'ق': 'q',
  'ك': 'k',
  'ل': 'l',
  'م': 'm',
  'ن': 'n',
  'ه': 'h',
  'و': 'w',
  'ي': 'y',
  'ى': 'a',
  'ة': 'h',
  'ؤ': 'w',
  'ئ': 'y',
  'ء': '',
};

function normalizeArabic(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .trim();
}

function transliterateArabicToken(token: string) {
  return Array.from(token)
    .map((letter) => ARABIC_LETTER_MAP[letter] ?? '')
    .join('');
}

function normalizeSlugText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function isValidSlug(value: string) {
  return SLUG_PATTERN.test(value);
}

export function normalizeSlug(value: string) {
  return normalizeSlugText(value);
}

export function createReadableSlug(value: string, fallback = 'item') {
  const normalized = normalizeArabic(value);
  let working = normalized;

  for (const [phrase, replacement] of PHRASE_MAP) {
    working = working.replaceAll(phrase, replacement);
  }

  const parts = working
    .split(/[^a-zA-Z0-9\u0600-\u06FF]+/)
    .flatMap((token) => {
      if (!token) return [];
      const direct = normalizeSlugText(token);
      if (direct) return [direct];

      const mapped = WORD_MAP[token];
      if (mapped) return mapped.split(/\s+/);

      const transliterated = normalizeSlugText(transliterateArabicToken(token));
      return transliterated ? [transliterated] : [];
    })
    .map((part) => normalizeSlugText(part))
    .filter(Boolean);

  const slug = normalizeSlugText(parts.join('-'));
  return slug || fallback;
}
