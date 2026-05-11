import 'server-only';

import { NextResponse } from 'next/server';
import { createAdminActionClient } from '@/lib/admin-auth';
import {
  getActiveAiProvider,
  isApiKeyConfigured,
  generateProductFromImages,
  AiProviderError,
  getUserFriendlyErrorMessage,
  type ProductFromImagesInput,
  type ProductFromImagesOutput,
} from '@/lib/ai-provider';

// Helper to extract storage path from public URL
function getStoragePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/products\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}

// Fetch image from Supabase storage and convert to base64
async function fetchImageAsBase64(adminClient: any, url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const path = getStoragePathFromUrl(url);
    if (!path) {
      console.error(`[AI Analysis] Could not extract path from URL: ${url}`);
      return null;
    }

    const { data, error } = await adminClient.storage.from('products').download(path);
    if (error || !data) {
      console.error(`[AI Analysis] Failed to download image: ${error?.message || 'unknown'}`);
      return null;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType = data.type || 'image/jpeg';
    const base64 = buffer.toString('base64');

    return { base64, mimeType };
  } catch (error) {
    console.error(`[AI Analysis] Error fetching image: ${error}`);
    return null;
  }
}

function stripDataUrlPrefix(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

interface ProductFromImagesRequestBody {
  productId?: unknown;
  imageUrls?: unknown;
  categories?: unknown;
  subcategories?: unknown;
}

interface ImageData {
  url: string;
  base64: string;
  mimeType: string;
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

    const adminClient = await createAdminActionClient(token);

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

    // Fetch images as base64 from Supabase storage
    console.log(`[AI Analysis] Fetching ${imageUrls.length} images from storage...`);
    const imageDataList: ImageData[] = [];
    for (const url of imageUrls) {
      const data = await fetchImageAsBase64(adminClient, url);
      if (data) {
        imageDataList.push({ url, ...data });
      }
    }

    if (imageDataList.length === 0) {
      return NextResponse.json(
        { error: 'لم أتمكن من قراءة الصورة بوضوح. يرجى إدخال اسم المنتج يدويًا.' },
        { status: 500 }
      );
    }

    console.log(`[AI Analysis] Successfully fetched ${imageDataList.length} images`);

    // Prepare input for AI provider with base64 images
    const input: ProductFromImagesInput = {
      imageUrls,
      categories,
      subcategories,
      images: imageDataList.map((img) => ({
        base64: stripDataUrlPrefix(img.base64),
        mimeType: img.mimeType?.startsWith('image/') ? img.mimeType : 'image/jpeg',
      })),
    };

    // Generate using the active provider
    const result: ProductFromImagesOutput = await generateProductFromImages(provider, input);

    // Log analysis results for debugging
    console.log(`[AI Analysis] Product type detected: ${result.detected_product_type || 'unknown'}`);
    console.log(`[AI Analysis] Confidence: ${result.confidence}`);
    console.log(`[AI Analysis] Visible text: ${result.visible_text?.join(', ') || 'none'}`);

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

      if (error.provider === 'gemini' && message.toLowerCase().includes('required oneof')) {
        return NextResponse.json(
          {
            error: 'تعذر إرسال الصورة إلى Gemini بسبب تنسيق غير صحيح. تمت معالجة المشكلة في الكود.',
            provider: error.provider,
            code: error.code,
          },
          { status: 500 }
        );
      }

      const userMessage = getUserFriendlyErrorMessage(error);
      const statusCode = 500;

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

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for image analysis
