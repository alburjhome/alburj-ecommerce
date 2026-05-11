import 'server-only';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getActiveAiProvider,
  isApiKeyConfigured,
  generateProductFromImages,
  AiProviderError,
  getUserFriendlyErrorMessage,
  type ProductFromImagesInput,
} from '@/lib/ai-provider';

interface ProductFromImagesRequestBody {
  productId?: unknown;
  imageUrls?: unknown;
  categories?: unknown;
  subcategories?: unknown;
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

interface CategoryOption {
  id: string;
  name: string;
}

interface SubcategoryOption {
  id: string;
  name: string;
  category_id: string;
}

function normalizeCategoryOptions(value: unknown): CategoryOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = item && typeof item === 'object' ? (item as any) : null;
      const id = normalizeString(obj?.id);
      const name = normalizeString(obj?.name);
      if (!id || !name) return null;
      return { id, name };
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
      const category_id = normalizeString(obj?.category_id);
      if (!id || !name || !category_id) return null;
      return { id, name, category_id };
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
      const message =
        provider === 'openai'
          ? 'OpenAI API key is not configured.'
          : 'Gemini API key is not configured.';
      return NextResponse.json(
        {
          error: provider === 'openai'
            ? 'مزود الذكاء الاصطناعي (OpenAI) غير مضبوط.'
            : 'مزود الذكاء الاصطناعي (Gemini) غير مضبوط.',
          details: message,
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ProductFromImagesRequestBody;
    const productId = normalizeString(body.productId);
    const imageUrls = normalizeStringArray(body.imageUrls);
    const categories = normalizeCategoryOptions(body.categories);
    const subcategories = normalizeSubcategoryOptions(body.subcategories);

    if (!productId) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'No image URLs provided' }, { status: 400 });
    }

    if (categories.length === 0) {
      return NextResponse.json({ error: 'Missing categories list' }, { status: 400 });
    }

    // Prepare input for AI provider
    const input: ProductFromImagesInput = {
      imageUrls,
      categories,
      subcategories,
    };

    // Generate using the active provider
    const result = await generateProductFromImages(provider, input);

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
        `[AI Product From Images] Provider: ${error.provider}, Code: ${error.code}, Message: ${error.message.slice(0, 100)}`
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
    console.error('[AI Product From Images] Unexpected error:', message.slice(0, 200));

    return NextResponse.json({ error: 'Failed to analyze images' }, { status: 500 });
  }
}
