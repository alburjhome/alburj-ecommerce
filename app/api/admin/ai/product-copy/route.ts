import 'server-only';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getActiveAiProvider,
  isApiKeyConfigured,
  getMissingApiKeyMessage,
  generateProductCopy,
  AiProviderError,
  getUserFriendlyErrorMessage,
  type ProductCopyInput,
} from '@/lib/ai-provider';

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
  notes?: unknown;
  template?: unknown;
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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('bearer '.length).trim()
      : null;

    await requireAdmin(token);

    // Get the active AI provider from settings
    const provider = await getActiveAiProvider();

    // Check if API key is configured for the selected provider
    if (!isApiKeyConfigured(provider)) {
      const message = getMissingApiKeyMessage(provider);
      const displayMessage =
        provider === 'openai'
          ? 'مزود الذكاء الاصطناعي (OpenAI) غير مضبوط. تحقق من إعدادات البيئة.'
          : 'مزود الذكاء الاصطناعي (Gemini) غير مضبوط. تحقق من إعدادات البيئة.';
      return NextResponse.json({ error: displayMessage, details: message }, { status: 500 });
    }

    const body = (await request.json()) as ProductCopyRequestBody;
    const name = normalizeString(body.name);
    const notes = normalizeString(body.notes);
    const template = normalizeString(body.template);

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

    // Prepare input for AI provider
    const input: ProductCopyInput = {
      name: name!,
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
    };

    // Generate using the active provider
    const result = await generateProductCopy(provider, input);

    return NextResponse.json(result);
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Unknown error';

    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Handle AI provider specific errors
    if (error instanceof AiProviderError) {
      // Log error for debugging (without sensitive info)
      console.error(
        `[AI Product Copy] Provider: ${error.provider}, Code: ${error.code}, Message: ${error.message.slice(0, 100)}`
      );

      const userMessage = getUserFriendlyErrorMessage(error);
      const statusCode = error.code === 'MISSING_API_KEY' || error.code === 'CONFIG_ERROR' ? 500 : 502;

      return NextResponse.json(
        {
          error: userMessage,
          provider: error.provider,
          code: error.code,
        },
        { status: statusCode }
      );
    }

    // Log unexpected errors
    console.error('[AI Product Copy] Unexpected error:', message.slice(0, 200));

    return NextResponse.json({ error: 'Failed to generate product copy' }, { status: 500 });
  }
}
