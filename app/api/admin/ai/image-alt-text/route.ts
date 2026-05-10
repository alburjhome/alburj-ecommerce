import 'server-only';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getActiveAiProvider,
  isApiKeyConfigured,
  getMissingApiKeyMessage,
  generateImageAltText,
  AiProviderError,
  type ImageAltTextInput,
} from '@/lib/ai-provider';

interface ImageAltTextRequestBody {
  productName?: unknown;
  categoryName?: unknown;
  shortDescription?: unknown;
  marketingTagline?: unknown;
  keyFeatures?: unknown;
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

    const body = (await request.json()) as ImageAltTextRequestBody;
    const productName = normalizeString(body.productName);

    if (!productName) {
      return NextResponse.json({ error: 'Missing product name' }, { status: 400 });
    }

    const categoryName = normalizeString(body.categoryName);
    const shortDescription = normalizeString(body.shortDescription);
    const marketingTagline = normalizeString(body.marketingTagline);
    const keyFeatures = normalizeStringArray(body.keyFeatures).slice(0, 3);

    // Prepare input for AI provider
    const input: ImageAltTextInput = {
      productName: productName!,
      categoryName,
      shortDescription,
      marketingTagline,
      keyFeatures,
    };

    // Generate using the active provider
    const result = await generateImageAltText(provider, input);

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
      const displayMessage =
        error.provider === 'openai'
          ? 'مزود الذكاء الاصطناعي (OpenAI) غير مضبوط. تحقق من إعدادات البيئة.'
          : 'مزود الذكاء الاصطناعي (Gemini) غير مضبوط. تحقق من إعدادات البيئة.';

      if (error.code === 'MISSING_API_KEY') {
        return NextResponse.json(
          { error: displayMessage, details: error.message },
          { status: 500 }
        );
      }
      if (error.code === 'INVALID_RESPONSE') {
        return NextResponse.json(
          { error: 'لم يتمكن الذكاء الاصطناعي من إنشاء رد صالح. حاول مرة أخرى.' },
          { status: 502 }
        );
      }
      if (error.code === 'API_ERROR') {
        return NextResponse.json(
          { error: 'حدث خطأ في الاتصال بمزود الذكاء الاصطناعي. حاول مرة أخرى لاحقًا.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ error: 'Failed to generate alt text' }, { status: 500 });
  }
}
