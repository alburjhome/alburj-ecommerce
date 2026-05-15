import { NextResponse } from 'next/server';
import { logSearchQuery, type SearchAnalyticsSource } from '@/lib/search-analytics';

const ALLOWED_SOURCES: SearchAnalyticsSource[] = ['products_page', 'header', 'header_suggestion_click'];

type IncomingPayload = {
  query?: unknown;
  resultsCount?: unknown;
  source?: unknown;
  clickedProductId?: unknown;
  sessionId?: unknown;
};

function safeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null;
}

function safeSource(value: unknown): SearchAnalyticsSource | null {
  return typeof value === 'string' && ALLOWED_SOURCES.includes(value as SearchAnalyticsSource)
    ? (value as SearchAnalyticsSource)
    : null;
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > 8_000) {
      return new NextResponse(null, { status: 204 });
    }

    let body: IncomingPayload = {};
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = (await request.json()) as IncomingPayload;
    }

    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 200) : '';
    const source = safeSource(body.source);
    if (!query || !source) {
      return new NextResponse(null, { status: 204 });
    }

    const resultsCount =
      typeof body.resultsCount === 'number' && Number.isFinite(body.resultsCount)
        ? Math.max(0, Math.trunc(body.resultsCount))
        : 0;

    await logSearchQuery({
      query,
      resultsCount,
      source,
      clickedProductId: safeUuid(body.clickedProductId),
      sessionId: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 120) : null,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
