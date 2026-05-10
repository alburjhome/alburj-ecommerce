import 'server-only';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

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

interface AltTextResponse {
  alt_text: string;
}

function normalizeAltTextResponse(raw: unknown): AltTextResponse | null {
  const obj = raw && typeof raw === 'object' ? (raw as any) : null;
  if (!obj) return null;

  const alt_text = normalizeString(obj.alt_text);
  if (!alt_text) return null;

  return { alt_text };
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

    const body = (await request.json()) as ImageAltTextRequestBody;
    const productName = normalizeString(body.productName);

    if (!productName) {
      return NextResponse.json({ error: 'Missing product name' }, { status: 400 });
    }

    const categoryName = normalizeString(body.categoryName);
    const shortDescription = normalizeString(body.shortDescription);
    const marketingTagline = normalizeString(body.marketingTagline);
    const keyFeatures = normalizeStringArray(body.keyFeatures).slice(0, 3);

    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({ apiKey });

    const basePrompt = `أنت كاتب محتوى عربي متخصص في SEO ومحركات البحث لمتجر "مؤسسة البرج" في الأردن.

المطلوب: كتابة وصف قصير للصورة (alt text) يظهر عند عدم تحميل الصورة ويساعد في تحسين SEO.

معلومات المنتج:
- اسم المنتج: ${productName}
- القسم: ${categoryName ?? 'غير محدد'}
- الوصف المختصر: ${shortDescription ?? ''}
- العبارة التسويقية: ${marketingTagline ?? ''}
- المميزات: ${keyFeatures.join(' | ')}

شروط alt text:
- باللغة العربية الفصحى
- قصير: 6 إلى 14 كلمة تقريبًا
- يصف المنتج والصورة بوضوح
- بدون مبالغة أو ادعاءات غير مثبتة
- بدون أسعار أو كلمات مثل "أفضل" إذا غير مثبتة
- مناسب لمحركات البحث

مثال جيد: "شامبو تنظيف السجاد بفرشاة مدمجة من مؤسسة البرج"
مثال جيد: "كيس قمامة أسود 120 لتر للمطاعم والمحلات"

Return ONLY valid JSON. No markdown. No explanation. No code fences.
أرجع JSON صالح فقط بالشكل التالي:
{
  "alt_text": "وصف الصورة هنا"
}`;

    const retryPrompt = `Return ONLY valid JSON. No markdown. No explanation. No code fences.
اكتب JSON مختصر فقط لوصف صورة المنتج:
اسم المنتج: ${productName}
أرجع JSON بالشكل: {"alt_text": "وصف قصير 6-14 كلمة"}`;

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
      console.error('Gemini alt text raw response:', rawText.slice(0, 500));
    }

    let normalized = null as AltTextResponse | null;

    try {
      const parsed = extractJsonObject(rawText);
      normalized = normalizeAltTextResponse(parsed);
    } catch {
      normalized = null;
    }

    if (!normalized) {
      const retryResult = await generate(retryPrompt);
      const retryRawText = await readGeminiText(retryResult);

      if (retryRawText && process.env.NODE_ENV !== 'production') {
        console.error('Gemini alt text raw response (retry):', retryRawText.slice(0, 500));
      }

      try {
        const parsed = extractJsonObject(retryRawText || '');
        normalized = normalizeAltTextResponse(parsed);
      } catch {
        normalized = null;
      }
    }

    if (!normalized) {
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
    }

    // Clamp alt text to reasonable length (max 150 chars)
    const clampedAltText = normalized.alt_text.length > 150
      ? normalized.alt_text.slice(0, 150)
      : normalized.alt_text;

    return NextResponse.json({ alt_text: clampedAltText });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to generate alt text' }, { status: 500 });
  }
}
