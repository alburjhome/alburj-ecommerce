import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

const ALLOWED_SOURCES = [
  'product_inquiry',
  'product_direct_order',
  'product_sticky_cta',
  'quick_order',
  'homepage_shop_cta',
  'homepage_bundle',
  'offers_hero_whatsapp',
  'offers_bundle',
  'restaurants_hero_whatsapp',
  'restaurants_bundle',
  'restaurants_empty_whatsapp',
  'packaging_hero_whatsapp',
  'packaging_bundle',
  'packaging_empty_whatsapp',
  'plastics_hero_whatsapp',
  'plastics_bundle',
  'plastics_empty_whatsapp',
  'home_kitchen_hero_whatsapp',
  'home_kitchen_bundle',
  'home_kitchen_empty_whatsapp',
  'mobile_menu_whatsapp',
  'footer_whatsapp',
] as const;

type AllowedSource = (typeof ALLOWED_SOURCES)[number];

type IncomingPayload = {
  source?: unknown;
  metadata?: unknown;
  path?: unknown;
};

type SafeMetadata = Record<string, string | number | boolean>;

function isAllowedSource(value: unknown): value is AllowedSource {
  return typeof value === 'string' && (ALLOWED_SOURCES as readonly string[]).includes(value);
}

function clampString(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function safeInt(value: unknown): number | null {
  const n = safeNumber(value);
  if (n === null) return null;
  const i = Math.trunc(n);
  if (!Number.isFinite(i)) return null;
  return i;
}

function safeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function safeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(v) ? v : null;
}

function pickSafeMetadata(metadata: unknown): SafeMetadata {
  const out: SafeMetadata = {};
  if (!metadata || typeof metadata !== 'object') return out;

  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }

  return out;
}

function buildInsertRow(source: AllowedSource, meta: SafeMetadata, path: string | null) {
  return {
    source,
    product_id: safeUuid(meta.product_id),
    product_name: typeof meta.product_name === 'string' ? clampString(meta.product_name, 160) : null,
    product_slug: typeof meta.product_slug === 'string' ? clampString(meta.product_slug, 160) : null,
    price: safeNumber(meta.price),
    use_case: typeof meta.use_case === 'string' ? clampString(meta.use_case, 80) : null,
    needs_count: safeInt(meta.needs_count),
    has_bundle: safeBoolean(meta.has_bundle),
    bundle_name: typeof meta.bundle_name === 'string' ? clampString(meta.bundle_name, 160) : null,
    cta_name: typeof meta.cta_name === 'string' ? clampString(meta.cta_name, 80) : null,
    path: path ? clampString(path, 300) : null,
  };
}

export async function POST(req: Request) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && Number(contentLength) > 10_000) {
      return new NextResponse(null, { status: 204 });
    }

    let body: IncomingPayload = {};

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = (await req.json()) as IncomingPayload;
    } else {
      // sendBeacon may send text/plain
      const text = await req.text();
      try {
        body = JSON.parse(text) as IncomingPayload;
      } catch {
        body = {};
      }
    }

    if (!isAllowedSource(body.source)) {
      return new NextResponse(null, { status: 204 });
    }

    const safeMeta = pickSafeMetadata(body.metadata);

    const safePath = typeof body.path === 'string' ? body.path : null;

    const row = buildInsertRow(body.source, safeMeta, safePath);

    const supabase = createServerClient();
    await supabase.from('whatsapp_click_events').insert(row as any);

    return new NextResponse(null, { status: 204 });
  } catch {
    // Never break UX
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
