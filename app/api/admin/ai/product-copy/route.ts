import 'server-only';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

type BadgeKey = 'bestselling' | 'offer' | 'new' | 'wholesale' | 'limited';
const ALLOWED_BADGES: BadgeKey[] = ['bestselling', 'offer', 'new', 'wholesale', 'limited'];

type IntentKey =
  | 'home'
  | 'kitchen'
  | 'plastics'
  | 'restaurants'
  | 'shops'
  | 'cleaning'
  | 'packaging'
  | 'bulk'
  | 'appliances'
  | 'furnishings';
const ALLOWED_INTENTS: IntentKey[] = [
  'home',
  'kitchen',
  'plastics',
  'restaurants',
  'shops',
  'cleaning',
  'packaging',
  'bulk',
  'appliances',
  'furnishings',
];

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface SubcategoryOption {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

interface ProductCopyRequestBody {
  name?: unknown;
  price?: unknown;
  comparePrice?: unknown;
  existingDescription?: unknown;
  existingShortDescription?: unknown;
  existingMarketingTagline?: unknown;
  existingKeyFeatures?: unknown;
  existingProductBadges?: unknown;
  existingIntentTags?: unknown;

  categories?: unknown;
  subcategories?: unknown;
  currentCategoryId?: unknown;
  currentSubcategoryId?: unknown;
  sku?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function normalizeCategoryOptions(value: unknown): CategoryOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = item && typeof item === 'object' ? (item as any) : null;
      const id = normalizeString(obj?.id);
      const name = normalizeString(obj?.name);
      const slug = normalizeString(obj?.slug);
      if (!id || !name || !slug) return null;
      return { id, name, slug };
    })
    .filter((item): item is CategoryOption => Boolean(item));
}

function normalizeSubcategoryOptions(value: unknown): SubcategoryOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = item && typeof item === 'object' ? (item as any) : null;
      const id = normalizeString(obj?.id);
      const name = normalizeString(obj?.name);
      const slug = normalizeString(obj?.slug);
      const category_id = normalizeString(obj?.category_id);
      if (!id || !name || !slug || !category_id) return null;
      return { id, name, slug, category_id };
    })
    .filter((item): item is SubcategoryOption => Boolean(item));
}

function clampString(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeSku(value: string) {
  const upper = value.toUpperCase().trim();
  const dashed = upper.replace(/\s+/g, '-');
  const safe = dashed.replace(/[^A-Z0-9-]/g, '');
  const collapsed = safe.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return clampString(collapsed, 40);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^json\s*/i, '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const direct = safeJsonParse(cleaned);
  if (direct) return direct;

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    const parsed = safeJsonParse(slice);
    if (parsed) return parsed;
  }

  throw new Error('AI response was not valid JSON');
}

async function readGeminiText(result: any): Promise<string | null> {
  try {
    if (typeof result?.text === 'function') {
      const value = await result.text();
      return typeof value === 'string' ? value : null;
    }

    if (typeof result?.text === 'string') {
      return result.text;
    }

    const candidateText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof candidateText === 'string' ? candidateText : null;
  } catch {
    return null;
  }
}

function normalizeModelResponse(raw: unknown) {
  const obj = raw && typeof raw === 'object' ? (raw as any) : null;
  if (!obj) return null;

  const marketing_tagline = normalizeString(obj.marketing_tagline);
  const description = normalizeString(obj.description);
  const meta_title = normalizeString(obj.meta_title);
  const meta_description = normalizeString(obj.meta_description);
  const suggested_sku = normalizeString(obj.suggested_sku);
  const category_id = normalizeString(obj.category_id);
  const subcategory_id = normalizeString(obj.subcategory_id);

  const key_features = normalizeStringArray(obj.key_features)
    .slice(0, 6)
    .map((f) => clampString(f, 80));

  const product_badges = normalizeStringArray(obj.product_badges)
    .filter((b): b is BadgeKey => (ALLOWED_BADGES as string[]).includes(b))
    .slice(0, 5);

  const intent_tags = normalizeStringArray(obj.intent_tags)
    .filter((t): t is IntentKey => (ALLOWED_INTENTS as string[]).includes(t))
    .slice(0, 10);

  return {
    marketing_tagline: marketing_tagline ? clampString(marketing_tagline, 120) : null,
    key_features,
    product_badges,
    intent_tags,
    description,
    meta_title: meta_title ? clampString(meta_title, 60) : null,
    meta_description: meta_description ? clampString(meta_description, 155) : null,
    suggested_sku: suggested_sku ? sanitizeSku(suggested_sku) : null,
    category_id: category_id || null,
    subcategory_id: subcategory_id || null,
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('bearer '.length).trim()
      : null;

    await requireAdmin(token);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 500 });
    }

    const body = (await request.json()) as ProductCopyRequestBody;
    const name = normalizeString(body.name);

    if (!name) {
      return NextResponse.json({ error: 'Missing product name' }, { status: 400 });
    }

    const price = typeof body.price === 'number' ? body.price : null;
    const comparePrice = typeof body.comparePrice === 'number' ? body.comparePrice : null;

    const existingDescription = normalizeString(body.existingDescription);
    const existingShortDescription = normalizeString(body.existingShortDescription);
    const existingMarketingTagline = normalizeString(body.existingMarketingTagline);
    const existingKeyFeatures = normalizeStringArray(body.existingKeyFeatures).slice(0, 6);
    const existingProductBadges = normalizeStringArray(body.existingProductBadges).slice(0, 5);
    const existingIntentTags = normalizeStringArray(body.existingIntentTags).slice(0, 10);

    const categories = normalizeCategoryOptions(body.categories);
    const subcategories = normalizeSubcategoryOptions(body.subcategories);
    const currentCategoryId = normalizeString(body.currentCategoryId);
    const currentSubcategoryId = normalizeString(body.currentSubcategoryId);
    const sku = normalizeString(body.sku);
    const metaTitle = normalizeString(body.metaTitle);
    const metaDescription = normalizeString(body.metaDescription);

    if (categories.length === 0) {
      return NextResponse.json({ error: 'Missing categories list' }, { status: 400 });
    }

    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({ apiKey });

    const basePrompt = `أنت كاتب محتوى تسويقي عربي لمتجر "مؤسسة البرج" في الأردن.

سياق البراند:
مؤسسة البرج متجر يبيع مستلزمات البيت والمحل، مثل المنظفات والورقيات، البلاستيكيات، التغليف، مستلزمات المطاعم والمحلات، الأدوات المنزلية، أدوات المطبخ، الأجهزة الكهربائية، المفروشات والبياضات.
أسلوب الكتابة: عربي واضح، تسويقي، مختصر، موثوق، مناسب للسوق الأردني، بدون مبالغة كاذبة.

معلومات المنتج:
- الاسم: ${name}
- SKU الحالي: ${sku ?? ''}
- Meta title الحالي: ${metaTitle ?? ''}
- Meta description الحالي: ${metaDescription ?? ''}
- category_id الحالي: ${currentCategoryId ?? ''}
- subcategory_id الحالي: ${currentSubcategoryId ?? ''}
- السعر: ${price ?? ''}
- قبل الخصم: ${comparePrice ?? ''}

محتوى موجود (قد يكون فارغًا):
- وصف: ${existingDescription ?? ''}
- وصف مختصر: ${existingShortDescription ?? ''}
- عبارة تسويقية: ${existingMarketingTagline ?? ''}
- مميزات: ${existingKeyFeatures.join(' | ')}
- وسوم: ${existingProductBadges.join(' | ')}
- مناسب لـ: ${existingIntentTags.join(' | ')}

قائمة الأقسام المتاحة (استخدم id فقط من هذه القائمة أو null):
${categories.map((c) => `- ${c.id} | ${c.name} | ${c.slug}`).join('\n')}

قائمة الفئات المتاحة (استخدم id فقط من هذه القائمة أو null) — كل عنصر مرتبط بـ category_id:
${subcategories.map((s) => `- ${s.id} | ${s.name} | ${s.slug} | category_id=${s.category_id}`).join('\n')}

المطلوب:
Return ONLY valid JSON. No markdown. No explanation. No code fences.
أرجع JSON صالح فقط بدون Markdown أو شرح أو أسوار كود، وبالشكل التالي تمامًا (لا تضف حقول أخرى):
{
  "marketing_tagline": "string max 120 chars",
  "key_features": ["max 6 items, each max 80 chars"],
  "product_badges": ["bestselling" | "offer" | "new" | "wholesale" | "limited"],
  "intent_tags": ["home" | "kitchen" | "plastics" | "restaurants" | "shops" | "cleaning" | "packaging" | "bulk" | "appliances" | "furnishings"],
  "description": "Arabic product description, 2-4 lines",
  "meta_title": "SEO title max 60 chars",
  "meta_description": "SEO description max 155 chars",
  "suggested_sku": "short uppercase SKU",
  "category_id": "one id from provided categories only, or null",
  "subcategory_id": "one id from provided subcategories only, or null"
}

ملاحظات:
- اختر intent_tags بشكل منطقي للمنتج.
- لا تستخدم ادعاءات طبية أو ضمانات غير حقيقية.
- إذا كان المنتج مناسب لـ intent واحد أو اثنين فقط، لا تملأ القائمة بلا داع.
- category_id يجب أن يكون من IDs الأقسام المرسلة فقط، أو null إذا غير متأكد.
- subcategory_id يجب أن يكون من IDs الفئات المرسلة فقط، أو null إذا غير متأكد.
- إذا اخترت subcategory_id يجب أن يتبع category_id المختار.
- ممنوع اختراع قسم/فئة جديدة أو إرجاع الاسم بدل id.`;

    const retryPrompt = `Return ONLY valid JSON. No markdown. No explanation. No code fences.
اكتب JSON مختصر فقط لهذا المنتج:
الاسم: ${name}
السعر: ${price ?? ''}
أرجع نفس الحقول تمامًا:
marketing_tagline, key_features, product_badges, intent_tags, description, meta_title, meta_description, suggested_sku, category_id, subcategory_id
تذكير: category_id/subcategory_id يجب أن تكون IDs من القوائم المرسلة فقط أو null.`;

    const generate = async (prompt: string) => {
      return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
        },
      } as any);
    };

    const result = await generate(basePrompt);
    const rawText = await readGeminiText(result);
    if (!rawText) {
      return NextResponse.json({ error: 'AI response was empty' }, { status: 502 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Gemini raw response:', rawText.slice(0, 500));
    }

    let normalized = null as ReturnType<typeof normalizeModelResponse>;

    try {
      const parsed = extractJsonObject(rawText);
      normalized = normalizeModelResponse(parsed);
    } catch {
      normalized = null;
    }

    if (!normalized) {
      const retryResult = await generate(retryPrompt);
      const retryRawText = await readGeminiText(retryResult);

      if (retryRawText && process.env.NODE_ENV !== 'production') {
        console.error('Gemini raw response (retry):', retryRawText.slice(0, 500));
      }

      try {
        const parsed = extractJsonObject(retryRawText || '');
        normalized = normalizeModelResponse(parsed);
      } catch {
        normalized = null;
      }
    }

    if (!normalized) {
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
    }

    const categoryIds = new Set(categories.map((c) => c.id));
    const subcategoryMap = new Map(subcategories.map((s) => [s.id, s] as const));

    const validCategoryId = normalized.category_id && categoryIds.has(normalized.category_id)
      ? normalized.category_id
      : null;

    const validSubcategoryId = (() => {
      if (!normalized.subcategory_id) return null;
      const found = subcategoryMap.get(normalized.subcategory_id);
      if (!found) return null;
      if (!validCategoryId) return null;
      return found.category_id === validCategoryId ? found.id : null;
    })();

    const sanitized = {
      ...normalized,
      meta_title: normalized.meta_title ? clampString(normalized.meta_title, 60) : null,
      meta_description: normalized.meta_description ? clampString(normalized.meta_description, 155) : null,
      suggested_sku: normalized.suggested_sku ? sanitizeSku(normalized.suggested_sku) : null,
      category_id: validCategoryId,
      subcategory_id: validSubcategoryId,
    };

    return NextResponse.json(sanitized);
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to generate product copy' }, { status: 500 });
  }
}
