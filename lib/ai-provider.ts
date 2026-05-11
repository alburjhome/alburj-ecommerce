import 'server-only';

import { createServerClient } from '@/lib/supabase-server';

export type AiProvider = 'gemini' | 'openai';

export interface ProductCopyInput {
  name: string;
  notes?: string | null;
  template?: string | null;
  price: number | null;
  comparePrice: number | null;
  existingDescription: string | null;
  existingShortDescription: string | null;
  existingMarketingTagline: string | null;
  existingKeyFeatures: string[];
  existingProductBadges: string[];
  existingIntentTags: string[];
  categories: { id: string; name: string; slug: string }[];
  subcategories: { id: string; name: string; slug: string; category_id: string }[];
  currentCategoryId: string | null;
  currentSubcategoryId: string | null;
  sku: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface ProductCopyOutput {
  name: string | null;
  short_description: string | null;
  marketing_tagline: string | null;
  key_features: string[];
  product_badges: string[];
  intent_tags: string[];
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  suggested_sku: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  category_confidence: 'high' | 'medium' | 'low';
  subcategory_confidence: 'high' | 'medium' | 'low';
}

export interface ImageAltTextInput {
  productName: string;
  categoryName: string | null;
  shortDescription: string | null;
  marketingTagline: string | null;
  keyFeatures: string[];
}

export interface ImageAltTextOutput {
  alt_text: string;
}

export interface ProductFromImagesInput {
  imageUrls: string[];
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
  images?: { base64: string; mimeType: string }[];
}

export interface ProductFromImagesOutput {
  name: string;
  short_description: string | null;
  description: string | null;
  brand: string | null;
  sku: string | null;
  key_features: string[];
  meta_title: string | null;
  meta_description: string | null;
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  has_variants: boolean;
  variant_types: string[];
  image_alt_texts: Record<string, string>;
  // New strict analysis fields
  detected_product_type: string | null;
  visible_text: string[];
  confidence: 'high' | 'medium' | 'low';
  uncertainty_reason: string | null;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AiProvider,
    public readonly code: 'MISSING_API_KEY' | 'API_ERROR' | 'INVALID_RESPONSE' | 'CONFIG_ERROR' | 'INVALID_IMAGE'
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/**
 * Get user-friendly error message in Arabic based on error code
 */
export function getUserFriendlyErrorMessage(error: AiProviderError): string {
  switch (error.code) {
    case 'MISSING_API_KEY':
      return error.provider === 'openai'
        ? 'OpenAI API key is not configured.'
        : 'Gemini API key is not configured.';
    case 'CONFIG_ERROR':
      return 'موديل OpenAI غير متاح لهذا الحساب. جرّب gpt-4.1-mini.';
    case 'API_ERROR':
      if (error.message.includes('billing') || error.message.includes('رصيد')) {
        return 'رصيد OpenAI أو الفوترة غير مفعّلة.';
      }
      return 'حدث خطأ في الاتصال بمزود الذكاء الاصطناعي. حاول مرة أخرى لاحقًا.';
    case 'INVALID_RESPONSE':
      return 'لم أتمكن من قراءة الصورة بوضوح. يرجى إدخال اسم المنتج يدويًا.';
    default:
      return 'حدث خطأ غير متوقع.';
  }
}

/**
 * Get the active AI provider from store settings
 * Falls back to 'gemini' if not set
 */
export async function getActiveAiProvider(): Promise<AiProvider> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('store_settings')
      .select('ai_provider')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      return 'gemini';
    }

    // Type-safe access to ai_provider field
    const provider = (data as Record<string, unknown>)['ai_provider'];
    if (provider === 'gemini' || provider === 'openai') {
      return provider;
    }

    return 'gemini';
  } catch {
    return 'gemini';
  }
}

/**
 * Check if the API key for the given provider is configured
 */
export function isApiKeyConfigured(provider: AiProvider): boolean {
  if (provider === 'gemini') {
    return !!process.env.GEMINI_API_KEY;
  }
  if (provider === 'openai') {
    return !!process.env.OPENAI_API_KEY;
  }
  return false;
}

/**
 * Get a human-readable error message for missing API key
 */
export function getMissingApiKeyMessage(provider: AiProvider): string {
  if (provider === 'gemini') {
    return 'Gemini API key is not configured.';
  }
  if (provider === 'openai') {
    return 'OpenAI API key is not configured.';
  }
  return 'AI provider API key is not configured.';
}

/**
 * Get the OpenAI model from env or use default
 */
function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4.1-mini';
}

// ============================================
// GEMINI IMPLEMENTATION
// ============================================

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

async function generateWithGemini(
  prompt: string,
  retryPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError('Gemini API key is not configured.', 'gemini', 'MISSING_API_KEY');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const generate = async (p: string) => {
    return ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: p }] }],
      config: {
        responseMimeType: 'application/json',
      },
    } as any);
  };

  const result = await generate(prompt);
  const rawText = await readGeminiText(result);

  if (!rawText) {
    throw new AiProviderError('AI response was empty', 'gemini', 'INVALID_RESPONSE');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Gemini] raw response:', rawText.slice(0, 500));
  }

  try {
    extractJsonObject(rawText);
    return rawText;
  } catch {
    // Try retry prompt
    const retryResult = await generate(retryPrompt);
    const retryRawText = await readGeminiText(retryResult);

    if (retryRawText && process.env.NODE_ENV !== 'production') {
      console.error('[Gemini] retry raw response:', retryRawText.slice(0, 500));
    }

    if (!retryRawText) {
      throw new AiProviderError('AI retry response was empty', 'gemini', 'INVALID_RESPONSE');
    }

    try {
      extractJsonObject(retryRawText);
      return retryRawText;
    } catch {
      throw new AiProviderError('AI response was not valid JSON', 'gemini', 'INVALID_RESPONSE');
    }
  }
}

// Multimodal version for Gemini with base64 images
async function generateWithGeminiMultimodal(
  prompt: string,
  retryPrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError('Gemini API key is not configured.', 'gemini', 'MISSING_API_KEY');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const sanitizedImages = images.map((img) => {
    const base64 = typeof img.base64 === 'string' ? img.base64.trim() : '';
    let mimeType = typeof img.mimeType === 'string' ? img.mimeType.trim() : '';

    if (!mimeType || !mimeType.startsWith('image/')) {
      mimeType = 'image/jpeg';
    }

    // Gemini expects raw base64 (no data URL prefix)
    const base64NoPrefix = base64.replace(/^data:image\/\w+;base64,/, '');

    if (!base64NoPrefix || base64NoPrefix.length < 100) {
      throw new AiProviderError(
        'لم أتمكن من قراءة الصورة بوضوح. يرجى إدخال اسم المنتج يدويًا.',
        'gemini',
        'INVALID_IMAGE'
      );
    }

    return { base64: base64NoPrefix, mimeType };
  });

  const imageParts = sanitizedImages.map((image) => ({
    inlineData: {
      data: image.base64,
      mimeType: image.mimeType || 'image/jpeg',
    },
  }));

  const generate = async (p: string) => {
    return ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [...imageParts, { text: p }] }],
      config: {
        responseMimeType: 'application/json',
      },
    } as any);
  };

  const result = await generate(prompt);
  const rawText = await readGeminiText(result);

  if (!rawText) {
    throw new AiProviderError('AI response was empty', 'gemini', 'INVALID_RESPONSE');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Gemini Multimodal] raw response:', rawText.slice(0, 500));
  }

  try {
    extractJsonObject(rawText);
    return rawText;
  } catch {
    // Try retry prompt
    const retryResult = await generate(retryPrompt);
    const retryRawText = await readGeminiText(retryResult);

    if (retryRawText && process.env.NODE_ENV !== 'production') {
      console.error('[Gemini Multimodal] retry raw response:', retryRawText.slice(0, 500));
    }

    if (!retryRawText) {
      throw new AiProviderError('AI retry response was empty', 'gemini', 'INVALID_RESPONSE');
    }

    try {
      extractJsonObject(retryRawText);
      return retryRawText;
    } catch {
      throw new AiProviderError('AI response was not valid JSON', 'gemini', 'INVALID_RESPONSE');
    }
  }
}

// ============================================
// OPENAI IMPLEMENTATION
// ============================================

async function generateWithOpenAI(
  prompt: string,
  retryPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError('OpenAI API key is not configured.', 'openai', 'MISSING_API_KEY');
  }

  const { OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey });
  const model = getOpenAiModel();

  const generate = async (p: string): Promise<string> => {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates structured JSON responses. Always return valid JSON without markdown formatting.',
          },
          { role: 'user', content: p },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });
      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      // Log error details for debugging (without API key)
      const errorCode = error?.code || error?.type || 'UNKNOWN';
      const errorMessage = error?.message || 'Unknown error';
      const errorStatus = error?.status || error?.statusCode || 'N/A';

      console.error(`[OpenAI] Error - Code: ${errorCode}, Status: ${errorStatus}, Message: ${errorMessage.slice(0, 200)}`);

      // Handle specific OpenAI errors
      if (errorCode === 'model_not_found' || errorStatus === 404) {
        throw new AiProviderError(
          'موديل OpenAI غير متاح لهذا الحساب. جرّب gpt-4.1-mini.',
          'openai',
          'CONFIG_ERROR'
        );
      }

      if (errorCode === 'insufficient_quota' || errorCode === 'billing_not_active' || errorMessage?.includes('billing')) {
        throw new AiProviderError(
          'رصيد OpenAI أو الفوترة غير مفعّلة.',
          'openai',
          'API_ERROR'
        );
      }

      if (errorCode === 'invalid_api_key' || errorCode === 'authentication_error') {
        throw new AiProviderError(
          'OpenAI API key is not configured.',
          'openai',
          'MISSING_API_KEY'
        );
      }

      if (errorCode === 'rate_limit_exceeded' || errorStatus === 429) {
        throw new AiProviderError(
          'تم تجاوز حد الطلبات لـ OpenAI. حاول مرة أخرى لاحقًا.',
          'openai',
          'API_ERROR'
        );
      }

      // Re-throw as API_ERROR for other cases
      throw new AiProviderError(
        `OpenAI API error: ${errorMessage}`,
        'openai',
        'API_ERROR'
      );
    }
  };

  const rawText = await generate(prompt);

  if (!rawText) {
    throw new AiProviderError('AI response was empty', 'openai', 'INVALID_RESPONSE');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[OpenAI] raw response:', rawText.slice(0, 500));
  }

  try {
    extractJsonObject(rawText);
    return rawText;
  } catch {
    // Try retry prompt
    const retryRawText = await generate(retryPrompt);

    if (retryRawText && process.env.NODE_ENV !== 'production') {
      console.error('[OpenAI] retry raw response:', retryRawText.slice(0, 500));
    }

    if (!retryRawText) {
      throw new AiProviderError('AI retry response was empty', 'openai', 'INVALID_RESPONSE');
    }

    try {
      extractJsonObject(retryRawText);
      return retryRawText;
    } catch {
      throw new AiProviderError('AI response was not valid JSON', 'openai', 'INVALID_RESPONSE');
    }
  }
}

// Multimodal version for OpenAI with base64 images
async function generateWithOpenAIMultimodal(
  prompt: string,
  retryPrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError('OpenAI API key is not configured.', 'openai', 'MISSING_API_KEY');
  }

  const { OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey });
  const model = getOpenAiModel();

  // Build content with images and text
  const content: any[] = [];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'high',
      },
    });
  }
  content.push({ type: 'text', text: prompt });

  const generate = async (p: string): Promise<string> => {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates structured JSON responses. Always return valid JSON without markdown formatting.',
          },
          {
            role: 'user',
            content: [...images.map((img) => ({
              type: 'image_url' as const,
              image_url: {
                url: `data:${img.mimeType};base64,${img.base64}`,
                detail: 'high' as const,
              },
            })), { type: 'text' as const, text: p }],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 2000,
      });
      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      // Log error details for debugging (without API key)
      const errorCode = error?.code || error?.type || 'UNKNOWN';
      const errorMessage = error?.message || 'Unknown error';
      const errorStatus = error?.status || error?.statusCode || 'N/A';

      if (process.env.NODE_ENV !== 'production') {
        console.error(`[OpenAI Multimodal] Error: ${errorCode} (${errorStatus}) - ${errorMessage.slice(0, 200)}`);
      }

      // Handle specific error cases
      if (errorCode === 'insufficient_quota' || errorCode === 'billing_not_active' || errorMessage?.includes('billing')) {
        throw new AiProviderError(
          'رصيد OpenAI أو الفوترة غير مفعّلة.',
          'openai',
          'API_ERROR'
        );
      }

      if (errorCode === 'invalid_api_key' || errorCode === 'authentication_error') {
        throw new AiProviderError(
          'OpenAI API key is not configured.',
          'openai',
          'MISSING_API_KEY'
        );
      }

      if (errorCode === 'rate_limit_exceeded' || errorStatus === 429) {
        throw new AiProviderError(
          'تم تجاوز حد الطلبات لـ OpenAI. حاول مرة أخرى لاحقًا.',
          'openai',
          'API_ERROR'
        );
      }

      // Re-throw as API_ERROR for other cases
      throw new AiProviderError(
        `OpenAI API error: ${errorMessage}`,
        'openai',
        'API_ERROR'
      );
    }
  };

  const rawText = await generate(prompt);

  if (!rawText) {
    throw new AiProviderError('AI response was empty', 'openai', 'INVALID_RESPONSE');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[OpenAI Multimodal] raw response:', rawText.slice(0, 500));
  }

  try {
    extractJsonObject(rawText);
    return rawText;
  } catch {
    // Try retry prompt
    const retryRawText = await generate(retryPrompt);

    if (retryRawText && process.env.NODE_ENV !== 'production') {
      console.error('[OpenAI Multimodal] retry raw response:', retryRawText.slice(0, 500));
    }

    if (!retryRawText) {
      throw new AiProviderError('AI retry response was empty', 'openai', 'INVALID_RESPONSE');
    }

    try {
      extractJsonObject(retryRawText);
      return retryRawText;
    } catch {
      throw new AiProviderError('AI response was not valid JSON', 'openai', 'INVALID_RESPONSE');
    }
  }
}

// ============================================
// UNIFIED GENERATION FUNCTIONS
// ============================================

function clampString(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeSku(value: string): string {
  const upper = value.toUpperCase().trim();
  const dashed = upper.replace(/\s+/g, '-');
  const safe = dashed.replace(/[^A-Z0-9-]/g, '');
  const collapsed = safe.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return clampString(collapsed, 40);
}

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

function normalizeProductCopyResponse(raw: unknown): ProductCopyOutput | null {
  const obj = raw && typeof raw === 'object' ? (raw as any) : null;
  if (!obj) return null;

  const name = normalizeString(obj.name);
  const short_description = normalizeString(obj.short_description);
  const marketing_tagline = normalizeString(obj.marketing_tagline);
  const key_features = normalizeStringArray(obj.key_features).slice(0, 6);
  const product_badges = normalizeStringArray(obj.product_badges)
    .map((b) => b.toLowerCase())
    .filter((b) => b.length > 0)
    .slice(0, 5);
  const intent_tags = normalizeStringArray(obj.intent_tags)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0)
    .slice(0, 10);
  const description = normalizeString(obj.description);
  const meta_title = normalizeString(obj.meta_title);
  const meta_description = normalizeString(obj.meta_description);
  const suggested_sku = normalizeString(obj.suggested_sku);
  const category_id = normalizeString(obj.category_id);
  const subcategory_id = normalizeString(obj.subcategory_id);

  const rawCategoryConfidence = normalizeString(obj.category_confidence);
  const category_confidence: 'high' | 'medium' | 'low' =
    rawCategoryConfidence === 'high' || rawCategoryConfidence === 'medium' || rawCategoryConfidence === 'low'
      ? rawCategoryConfidence
      : 'low';

  const rawSubcategoryConfidence = normalizeString(obj.subcategory_confidence);
  const subcategory_confidence: 'high' | 'medium' | 'low' =
    rawSubcategoryConfidence === 'high' || rawSubcategoryConfidence === 'medium' || rawSubcategoryConfidence === 'low'
      ? rawSubcategoryConfidence
      : 'low';

  return {
    name,
    short_description: short_description ? clampString(short_description, 180) : null,
    marketing_tagline: marketing_tagline ? clampString(marketing_tagline, 60) : null,
    key_features,
    product_badges,
    intent_tags,
    description,
    meta_title: meta_title ? clampString(meta_title, 60) : null,
    meta_description: meta_description ? clampString(meta_description, 155) : null,
    suggested_sku: suggested_sku ? sanitizeSku(suggested_sku) : null,
    category_id: category_id || null,
    subcategory_id: subcategory_id || null,
    category_confidence,
    subcategory_confidence,
  };
}

function buildProductCopyPrompts(input: ProductCopyInput): { base: string; retry: string } {
  const {
    name,
    notes,
    template,
    price,
    comparePrice,
    existingDescription,
    existingShortDescription,
    existingMarketingTagline,
    existingKeyFeatures,
    existingProductBadges,
    existingIntentTags,
    categories,
    subcategories,
    currentCategoryId,
    currentSubcategoryId,
    sku,
    metaTitle,
    metaDescription,
  } = input;

  const categoriesText = categories.map((c) => `- ${c.id} | ${c.name}`).join('\n');
  const subcategoriesText = subcategories
    .map((s) => {
      const parent = categories.find((c) => c.id === s.category_id);
      return `- ${s.id} | ${s.name} | category_id: ${s.category_id} | category_name: ${parent?.name ?? s.category_id}`;
    })
    .join('\n');

  const basePrompt = `أنت كاتب محتوى عربي لمتجر "مؤسسة البرج" في الأردن.

المطلوب: اقتراح محتوى منتج (وصف/مميزات/SEO) + اقتراح التصنيف من قاعدة البيانات فقط.

المدخلات:
- الاسم: ${name}
- ملاحظات إضافية (قد تكون null): ${notes ?? ''}
- قالب/سياق إضافي (قد يكون null): ${template ?? ''}
- السعر: ${price ?? ''}
- السعر قبل الخصم: ${comparePrice ?? ''}
- الوصف الحالي: ${existingDescription ?? ''}
- الوصف المختصر الحالي: ${existingShortDescription ?? ''}
- العبارة التسويقية الحالية: ${existingMarketingTagline ?? ''}
- المميزات الحالية: ${(existingKeyFeatures || []).join(' | ')}
- شارات المنتج الحالية: ${(existingProductBadges || []).join(' | ')}
- intent tags الحالية: ${(existingIntentTags || []).join(' | ')}
- SKU الحالي: ${sku ?? ''}
- Meta Title الحالي: ${metaTitle ?? ''}
- Meta Description الحالي: ${metaDescription ?? ''}
- القسم الحالي (قد يكون فارغ): ${currentCategoryId ?? ''}
- الفئة الحالية (قد تكون null): ${currentSubcategoryId ?? ''}

قائمة الأقسام المتاحة (اختر id فقط أو null):
${categoriesText}

قائمة الفئات الفرعية المتاحة (اختر id فقط أو null):
${subcategoriesText}

قواعد صارمة (STRICT):
- ممنوع اختراع أي معلومة غير موجودة في الاسم/الملاحظات/القالب.
- ممنوع اختراع بلد منشأ أو ضمان أو خامة أو عدد قطع أو رائحة أو فوائد طبية غير مذكورة.
- ممنوع استخدام عبارات مثل "آمن للأطفال" أو "يزيل 99.9%" إلا إذا كانت مذكورة صراحة في الاسم أو الملاحظات.
- ممنوع اختراع category_id أو subcategory_id. اختر فقط IDs من القوائم أعلاه أو null.
- إذا اخترت subcategory_id يجب أن تتبع category_id.
- إذا كان الاسم غامض (مثل: "شامبو 1 لتر") لا تختار subcategory_id عشوائيًا.
- إذا كان القسم واضحًا والفئة غير واضحة: اختر category_id بثقة high واجعل subcategory_id=null و subcategory_confidence=low.
- إذا كان القسم يحتوي فئة واحدة فقط وكان المنتج مناسبًا للقسم: اختر هذه الفئة.

أمثلة توجيهية للتصنيف:
- "كاسات ورقية بيضاء دبل 12 أونصة عدد 50 كاسة": مستلزمات/تغليف/كافيهات حسب القوائم المتاحة.
- "كاسات بلاستيك شفافة 50 حبة": البلاستيك والتغليف، وفئة الصحون/الكاسات إن وجدت.
- "سائل جلي ليمون 1 لتر": المنظفات والورقيات، وفئة سوائل الجلي/الصابون إن وجدت.
- "منشفة قطن وجه": المفروشات والبياضات، وفئة البشاكير/المناشف إن وجدت.
- "خلاط كهربائي 2 لتر": الأجهزة الكهربائية، وفئة الخلاطات/العصارات إن وجدت.

قواعد المحتوى لتجنب التكرار (مهم جدًا):
- marketing_tagline: عبارة قصيرة جدًا من 3 إلى 7 كلمات، جذابة ومباشرة، بدون مبالغة، ولا تكرر نص short_description.
- short_description: جملة واحدة أو جملتان فقط، تشرح المنتج وفائدته بسرعة، وحاول ألا تتجاوز 180 حرفًا قدر الإمكان. لا تكرر marketing_tagline.
- key_features: من 4 إلى 6 نقاط. كل نقطة قصيرة وعملية. لا تكرر الوصف القصير حرفيًا.
- description: لا يبدأ بنفس نص short_description، ويضيف تفاصيل جديدة فقط. ممنوع تكرار نفس الجمل الموجودة في short_description أو key_features.
- إذا لا توجد معلومات إضافية حقيقية: اجعل description مختصرًا جدًا أو null بدل التكرار.
- ممنوع أن يكون short_description و description متطابقين أو شبه متطابقين.

Return ONLY valid JSON. No markdown. No explanation. No code fences.
أرجع JSON صالح فقط بالشكل التالي تمامًا (لا تضف حقول أخرى):
{
  "name": "اسم المنتج بالعربية أو null",
  "short_description": "وصف مختصر: جملتان فقط أو null",
  "marketing_tagline": "عبارة تسويقية قصيرة جدًا (3-7 كلمات) أو null",
  "key_features": ["ميزة 1", "ميزة 2", "ميزة 3", "ميزة 4"],
  "product_badges": ["bestselling"],
  "intent_tags": ["home"],
  "description": "تفاصيل إضافية غير مكررة (قد تكون null)",
  "meta_title": "عنوان SEO (max 60 حرف) أو null",
  "meta_description": "وصف SEO (max 155 حرف) أو null",
  "suggested_sku": "SKU مقترح بالإنجليزية أو null",
  "category_id": "id من قائمة الأقسام أو null",
  "subcategory_id": "id من قائمة الفئات الفرعية أو null",
  "category_confidence": "high | medium | low",
  "subcategory_confidence": "high | medium | low"
}`;

  const retryPrompt = `Return ONLY valid JSON. No markdown. No code fences.
أعد المحاولة مع الالتزام الصارم:
- لا تخمن التصنيف.
- category_id/subcategory_id IDs فقط من القوائم أو null.
- إذا غير متأكد من الفئة الفرعية: subcategory_id=null و subcategory_confidence=low.
أرجع نفس الحقول تمامًا.`;

  return { base: basePrompt, retry: retryPrompt };
}

function normalizeArabicSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(normalizeArabicSearchText(keyword)));
}

function findSubcategoryBySignals(
  subcategories: ProductCopyInput['subcategories'],
  signals: string[]
) {
  return subcategories.find((subcategory) => {
    const haystack = normalizeArabicSearchText(`${subcategory.name} ${subcategory.slug}`);
    return includesAny(haystack, signals);
  });
}

function inferTaxonomyFromProductName(input: ProductCopyInput) {
  const name = normalizeArabicSearchText(`${input.name} ${input.notes ?? ''} ${input.template ?? ''}`);

  const rules: Array<{
    productSignals: string[];
    subcategorySignals: string[];
  }> = [
    {
      productSignals: ['سائل جلي', 'سائل الجلي', 'صابون جلي', 'صابون الصحون', 'جلي ليمون'],
      subcategorySignals: ['سوائل الجلي', 'الجلي', 'dishwashing', 'soap-liquids'],
    },
    {
      productSignals: ['كاسات بلاستيك', 'كاسات شفافه', 'اكواب بلاستيك', 'كوب بلاستيك'],
      subcategorySignals: ['صحون وكاسات بلاستيك', 'plastic-plates-cups'],
    },
    {
      productSignals: ['كاسات ورقيه', 'اكواب ورقيه', 'كوب ورقي'],
      subcategorySignals: ['مستلزمات الكافيهات', 'مستلزمات المطاعم', 'صحون واكواب', 'paper-cups'],
    },
    {
      productSignals: ['منشفه', 'مناشف', 'بشكير', 'بشاكير'],
      subcategorySignals: ['مناشف', 'بشاكير', 'towels'],
    },
    {
      productSignals: ['خلاط', 'عصاره', 'عصارة'],
      subcategorySignals: ['خلاطات', 'عصارات', 'blenders', 'juicers'],
    },
  ];

  for (const rule of rules) {
    if (!includesAny(name, rule.productSignals)) continue;
    const subcategory = findSubcategoryBySignals(input.subcategories, rule.subcategorySignals);
    if (subcategory) {
      return { category_id: subcategory.category_id, subcategory_id: subcategory.id };
    }
  }

  return null;
}

export async function generateProductCopy(provider: AiProvider, input: ProductCopyInput): Promise<ProductCopyOutput> {
  if (!isApiKeyConfigured(provider)) {
    throw new AiProviderError(getMissingApiKeyMessage(provider), provider, 'MISSING_API_KEY');
  }

  const prompts = buildProductCopyPrompts(input);

  let rawText: string;
  try {
    rawText =
      provider === 'gemini'
        ? await generateWithGemini(prompts.base, prompts.retry)
        : await generateWithOpenAI(prompts.base, prompts.retry);
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError(error instanceof Error ? error.message : 'Unknown error', provider, 'API_ERROR');
  }

  const parsed = extractJsonObject(rawText);
  const normalized = normalizeProductCopyResponse(parsed);
  if (!normalized) {
    throw new AiProviderError('AI response was empty or invalid', provider, 'INVALID_RESPONSE');
  }

  const categoryIds = new Set(input.categories.map((c) => c.id));
  const subcategoryById = new Map(input.subcategories.map((s) => [s.id, s] as const));

  // Validate category id
  if (normalized.category_id && !categoryIds.has(normalized.category_id)) {
    normalized.category_id = null;
    normalized.category_confidence = 'low';
  }

  // Validate subcategory id + category match
  if (normalized.subcategory_id) {
    const sub = subcategoryById.get(normalized.subcategory_id);
    const matchesCategory = Boolean(sub && (!normalized.category_id || sub.category_id === normalized.category_id));
    if (!sub || !matchesCategory) {
      normalized.subcategory_id = null;
      normalized.subcategory_confidence = 'low';
    } else {
      normalized.category_id = sub.category_id;
      if (normalized.category_confidence === 'low' && normalized.subcategory_confidence === 'high') {
        normalized.category_confidence = 'high';
      }
    }
  }

  if (
    normalized.category_id &&
    normalized.category_confidence === 'high' &&
    !normalized.subcategory_id
  ) {
    const subcategoriesForCategory = input.subcategories.filter(
      (subcategory) => subcategory.category_id === normalized.category_id
    );
    if (subcategoriesForCategory.length === 1) {
      normalized.subcategory_id = subcategoriesForCategory[0]!.id;
      normalized.subcategory_confidence = 'high';
    }
  }

  const deterministicTaxonomy = inferTaxonomyFromProductName(input);
  if (deterministicTaxonomy) {
    normalized.category_id = deterministicTaxonomy.category_id;
    normalized.subcategory_id = deterministicTaxonomy.subcategory_id;
    normalized.category_confidence = 'high';
    normalized.subcategory_confidence = 'high';
  }

  return normalized;
}

export async function generateImageAltText(provider: AiProvider, input: ImageAltTextInput): Promise<ImageAltTextOutput> {
  if (!isApiKeyConfigured(provider)) {
    throw new AiProviderError(getMissingApiKeyMessage(provider), provider, 'MISSING_API_KEY');
  }

  const basePrompt = `Return ONLY valid JSON. No markdown. No explanation. No code fences.
اكتب alt text عربي قصير وواضح للصورة (6-14 كلمة) يساعد في SEO بدون مبالغة.
اعتمد فقط على هذه المعلومات:
- اسم المنتج: ${input.productName}
- القسم: ${input.categoryName ?? ''}
- وصف مختصر: ${input.shortDescription ?? ''}
- عبارة تسويقية: ${input.marketingTagline ?? ''}
- مميزات: ${(input.keyFeatures || []).join(' | ')}

JSON schema:
{ "alt_text": "..." }`;

  const retryPrompt = `Return ONLY valid JSON. No markdown. No code fences.
{ "alt_text": "${input.productName}" }`;

  const rawText =
    provider === 'gemini'
      ? await generateWithGemini(basePrompt, retryPrompt)
      : await generateWithOpenAI(basePrompt, retryPrompt);

  const parsed = extractJsonObject(rawText);
  const obj = parsed && typeof parsed === 'object' ? (parsed as any) : null;
  const altText = normalizeString(obj?.alt_text);
  if (!altText) {
    throw new AiProviderError('AI response was empty', provider, 'INVALID_RESPONSE');
  }

  return { alt_text: clampString(altText, 150) };
}

// ...

function buildProductFromImagesPrompts(
  categories: { id: string; name: string }[],
  subcategories: { id: string; name: string; category_id: string }[]
): { base: string; retry: string } {
  // ...

  const basePrompt = `أعد المحاولة مع الالتزام الصارم بالنقاط التالية:
  // ...

  JSON schema المطلوب:
  {
    "detected_product_type": "نوع المنتج كما يظهر في الصورة - اكتب 'غير واضح' إذا غير واضح",
    "visible_text": ["كل النصوص الظاهرة على العبوة/المنتج"],
    "brand": "العلامة التجارية إن ظهرت بالضبط، وإلا null",
    "confidence": "high | medium | low",
    "uncertainty_reason": "سبب عدم التأكد إذا confidence ليست high، وإلا null",
    "name": "اسم المنتج كما يظهر أو 'منتج غير محدد' إذا غير واضح",
    "short_description": "وصف مختصر فقط إذا كانت الثقة high، وإلا null",
    "description": "وصف تفصيلي فقط إذا كانت الثقة high، وإلا null",
    "sku": "كود SKU مقترح بالإنجليزية أو null",
    "key_features": ["الميزات المرئية فقط"],
    "meta_title": "SEO title فقط إذا كانت الثقة high",
    "meta_description": "SEO description فقط إذا كانت الثقة high",
    "suggested_category_id": "id القسم أو null إذا غير واضح",
    "suggested_subcategory_id": "id الفئة أو null إذا غير واضح",
    "has_variants": false,
    "variant_types": [],
    "image_alt_texts": {
      "image_1": "وصف الصورة 1"
2. اعتمد فقط على ما يظهر بوضوح في الصور:
   - النص الظاهر على العبوة/المنتج
   - الشكل والألوان المرئية
   - العلامة التجارية المرئية
3. ممنوع التخمين - إذا لم تكن متأكدًا، قل ذلك صراحة

قواعد منع الهلوسة (STRICT RULES):
- ممنوع افتراض أن أي منتج هو "سائل جلي" أو "منظف" أو "شامبو" إلا إذا كانت هذه الكلمات ظاهرة بوضوح على العبوة
- ممنوع توليد وصف عن منتج مختلف عما في الصورة
- ممنوع استخدام fallback عام مثل "منتج منظف" أو "منتج عناية"
- اكتب "غير واضح" في detected_product_type إذا لم تستطع التحديد

قائمة الأقسام المتاحة (استخدم id فقط أو null):
${categories.map((c) => `- ${c.id} | ${c.name}`).join('\n')}

قائمة الفئات المتاحة (استخدم id فقط أو null):
${subcategories.map((s) => `- ${s.id} | ${s.name}`).join('\n')}

Return ONLY valid JSON. No markdown. No explanation. No code fences.

JSON schema المطلوب:
{
  "detected_product_type": "نوع المنتج كما يظهر في الصورة - اكتب 'غير واضح' إذا غير واضح",
  "visible_text": ["كل النصوص الظاهرة على العبوة/المنتج"],
  "brand": "العلامة التجارية إن ظهرت بالضبط، وإلا null",
  "confidence": "high | medium | low",
  "uncertainty_reason": "سبب عدم التأكد إذا confidence ليست high، وإلا null",
  "name": "اسم المنتج كما يظهر أو 'منتج غير محدد' إذا غير واضح",
  "short_description": "وصف مختصر فقط إذا كانت الثقة high، وإلا null",
  "description": "وصف تفصيلي فقط إذا كانت الثقة high، وإلا null",
  "sku": "كود SKU مقترح بالإنجليزية أو null",
  "key_features": ["الميزات المرئية فقط"],
  "meta_title": "SEO title فقط إذا كانت الثقة high",
  "meta_description": "SEO description فقط إذا كانت الثقة high",
  "suggested_category_id": "id القسم أو null إذا غير واضح",
  "suggested_subcategory_id": "id الفئة أو null إذا غير واضح",
  "has_variants": false,
  "variant_types": [],
  "image_alt_texts": {
    "image_1": "وصف الصورة 1"
  }
}

قواعد الثقة (confidence):
- "high": النص واضح، العلامة التجارية واضحة، نوع المنتج مؤكد من العبوة
- "medium": بعض النصوص واضحة لكن هناك غموض في نوع المنتج بالضبط
- "low": الصورة غير واضحة أو لا يمكن قراءة النص

ممنوعات صارمة:
- لا تكتب "سائل جلي" إلا إذا كانت هذه الكلمة ظاهرة على العبوة
- لا تكتب "منظف" إلا إذا كانت هذه الكلمة ظاهرة
- لا تكتب "شامبو" إلا إذا كانت هذه الكلمة ظاهرة
- لا تضع منتجًا في قسم المنظفات إلا إذا كان المنظف واضحًا في الصورة`;

  const retryPrompt = `Return ONLY valid JSON. No markdown. No code fences.
تحليل صارم للمنتج:
{
  "detected_product_type": "غير واضح",
  "visible_text": [],
  "brand": null,
  "confidence": "low",
  "uncertainty_reason": "لم أتمكن من قراءة الصورة بوضوح",
  "name": "منتج غير محدد",
  "short_description": null,
  "description": null,
  "sku": null,
  "key_features": [],
  "meta_title": null,
  "meta_description": null,
  "suggested_category_id": null,
  "suggested_subcategory_id": null,
  "has_variants": false,
  "variant_types": [],
  "image_alt_texts": {}
}`;

  return { base: basePrompt, retry: retryPrompt };
}

function normalizeProductFromImagesResponse(raw: unknown, imageUrls: string[]): ProductFromImagesOutput {
  const obj = raw && typeof raw === 'object' ? (raw as any) : null;
  if (!obj) {
    throw new Error('Invalid AI response structure');
  }

  // Parse confidence level
  const rawConfidence = normalizeString(obj.confidence);
  const confidence: 'high' | 'medium' | 'low' =
    rawConfidence === 'high' || rawConfidence === 'medium' || rawConfidence === 'low'
      ? rawConfidence
      : 'low';

  // Parse detected product type
  let detectedProductType = normalizeString(obj.detected_product_type);
  if (!detectedProductType || detectedProductType === 'null') {
    detectedProductType = null;
  }

  // Parse visible text
  const visibleText = normalizeStringArray(obj.visible_text);

  // Parse uncertainty reason
  let uncertaintyReason = normalizeString(obj.uncertainty_reason);
  if (!uncertaintyReason || uncertaintyReason === 'null') {
    uncertaintyReason = null;
  }

  // Parse name
  let name = normalizeString(obj.name) || '';
  if (confidence === 'low') {
    // Do not auto-fill a confident name when we are not confident.
    name = '';
  }

  // Build alt texts map
  const altTexts: Record<string, string> = {};
  const rawAltTexts = obj.image_alt_texts;
  if (rawAltTexts && typeof rawAltTexts === 'object') {
    imageUrls.forEach((url, index) => {
      const key = `image_${index + 1}`;
      const altText = normalizeString(rawAltTexts[key]) || normalizeString(rawAltTexts[url]);
      if (altText) {
        altTexts[url] = altText.length > 150 ? altText.slice(0, 150) : altText;
      }
    });
  }

  const shortDescription = normalizeString(obj.short_description);
  const description = normalizeString(obj.description);
  const metaTitle = normalizeString(obj.meta_title);
  const metaDescription = normalizeString(obj.meta_description);

  const suggestedCategoryId = normalizeString(obj.suggested_category_id);
  const suggestedSubcategoryId = normalizeString(obj.suggested_subcategory_id);

  return {
    name,
    detected_product_type: detectedProductType,
    visible_text: visibleText,
    confidence,
    uncertainty_reason: uncertaintyReason,
    short_description: confidence === 'high' ? shortDescription : null,
    description: confidence === 'high' ? description : null,
    brand: normalizeString(obj.brand),
    sku: normalizeString(obj.sku),
    key_features: normalizeStringArray(obj.key_features).slice(0, 6),
    meta_title: confidence === 'high' && metaTitle ? clampString(metaTitle, 60) : null,
    meta_description: confidence === 'high' && metaDescription ? clampString(metaDescription, 155) : null,
    suggested_category_id: confidence === 'low' ? null : suggestedCategoryId,
    suggested_subcategory_id: confidence === 'low' ? null : suggestedSubcategoryId,
    has_variants: Boolean(obj.has_variants),
    variant_types: normalizeStringArray(obj.variant_types).slice(0, 5),
    image_alt_texts: altTexts,
  };
}

/**
 * Generate product data from images using the active AI provider
 */
export async function generateProductFromImages(
  provider: AiProvider,
  input: ProductFromImagesInput
): Promise<ProductFromImagesOutput> {
  if (!isApiKeyConfigured(provider)) {
    throw new AiProviderError(getMissingApiKeyMessage(provider), provider, 'MISSING_API_KEY');
  }

  const prompts = buildProductFromImagesPrompts(input.categories, input.subcategories);

  let rawText: string;
  try {
    if (provider === 'gemini') {
      rawText = await generateWithGeminiMultimodal(prompts.base, prompts.retry, input.images || []);
    } else {
      rawText = await generateWithOpenAIMultimodal(prompts.base, prompts.retry, input.images || []);
    }
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw error;
    }
    throw new AiProviderError(
      error instanceof Error ? error.message : 'Unknown error',
      provider,
      'API_ERROR'
    );
  }

  const parsed = extractJsonObject(rawText);
  const normalized = normalizeProductFromImagesResponse(parsed, input.imageUrls);

  // Validate category_id against provided list
  const categoryIds = new Set(input.categories.map((c) => c.id));
  if (normalized.suggested_category_id && !categoryIds.has(normalized.suggested_category_id)) {
    normalized.suggested_category_id = null;
  }

  // Validate subcategory_id against provided list and category match
  if (normalized.suggested_subcategory_id) {
    const validSub = input.subcategories.find(
      (s) => s.id === normalized.suggested_subcategory_id && s.category_id === normalized.suggested_category_id
    );
    if (!validSub) {
      normalized.suggested_subcategory_id = null;
    }
  }

  return normalized;
}
