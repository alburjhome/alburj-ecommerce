import type { CartItem, ProductWithDetails } from '@/types';

type MetaPrimitive = string | number | boolean;
type MetaPayloadValue =
  | MetaPrimitive
  | null
  | undefined
  | MetaPayloadValue[]
  | { [key: string]: MetaPayloadValue };

type MetaPayload = Record<string, MetaPayloadValue>;

type TrackableCartItem = Pick<
  CartItem,
  'item_type' | 'product_id' | 'variant_id' | 'name' | 'price' | 'quantity'
>;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';
const CURRENCY = 'JOD';

function hasMetaPixel() {
  return typeof window !== 'undefined' && Boolean(META_PIXEL_ID) && typeof window.fbq === 'function';
}

function cleanPayload(value: MetaPayloadValue): MetaPayloadValue {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanPayload(item))
      .filter((item): item is Exclude<MetaPayloadValue, null | undefined> => item !== undefined);
  }
  if (typeof value === 'object') {
    const next: MetaPayload = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const cleaned = cleanPayload(nestedValue);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    }
    return next;
  }
  return undefined;
}

function cleanParams(params: MetaPayload) {
  return cleanPayload(params) as MetaPayload;
}

function createEventId(eventName: string, stableId?: string | number | null) {
  const stablePart = stableId ? String(stableId) : Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${eventName}-${stablePart}-${randomPart}`;
}

function track(eventName: string, params: MetaPayload = {}, stableId?: string | number | null) {
  if (!hasMetaPixel()) return null;

  const eventID = createEventId(eventName, stableId);

  try {
    window.fbq?.('track', eventName, cleanParams(params), { eventID });
    return eventID;
  } catch {
    return null;
  }
}

function cartContent(item: TrackableCartItem) {
  return {
    id: item.product_id,
    quantity: item.quantity,
    item_price: Number(item.price || 0),
  };
}

function safeProductType(value: string | null | undefined) {
  return value === 'bundle' ? 'bundle' : 'single';
}

function contentIds(items: TrackableCartItem[]) {
  return Array.from(new Set(items.map((item) => item.product_id).filter(Boolean)));
}

function productViewPrice(product: ProductWithDetails) {
  const activeVariantPrices = (product.variants || [])
    .filter((variant) => variant.is_active)
    .map((variant) => Number(variant.price || 0))
    .filter((price) => price > 0);

  return activeVariantPrices.length ? Math.min(...activeVariantPrices) : Number(product.price || 0);
}

function totalQuantity(items: TrackableCartItem[]) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function trackPageView() {
  return track('PageView');
}

export function trackViewContent(product: ProductWithDetails) {
  const productType = safeProductType(product.product_type);
  const value = productViewPrice(product);

  return track(
    'ViewContent',
    {
      content_ids: [product.id],
      content_type: 'product',
      content_name: product.name,
      value,
      currency: CURRENCY,
      contents: [{ id: product.id, quantity: 1, item_price: value }],
      product_type: productType,
    },
    product.id,
  );
}

export function trackAddToCart(item: {
  productId: string;
  productName: string;
  value: number;
  quantity: number;
  variantId?: string | null;
  productType?: 'single' | 'bundle' | string | null;
}) {
  const productType = safeProductType(item.productType);

  return track(
    'AddToCart',
    {
      content_ids: [item.productId],
      content_type: 'product',
      content_name: item.productName,
      value: Number(item.value || 0),
      currency: CURRENCY,
      contents: [
        {
          id: item.productId,
          quantity: item.quantity,
          item_price: Number(item.value || 0) / Math.max(1, item.quantity),
        },
      ],
      quantity: item.quantity,
      variant_id: item.variantId || undefined,
      product_type: productType,
    },
    item.variantId || item.productId,
  );
}

export function trackInitiateCheckout(input: { items: TrackableCartItem[]; value: number }) {
  const items = input.items || [];

  return track('InitiateCheckout', {
    value: Number(input.value || 0),
    currency: CURRENCY,
    num_items: totalQuantity(items),
    content_ids: contentIds(items),
    contents: items.map(cartContent),
    product_types: Array.from(new Set(items.map((item) => safeProductType(item.item_type)))),
  });
}

export function trackLead(input: { orderId?: string | null; items: TrackableCartItem[]; value: number }) {
  const items = input.items || [];

  return track(
    'Lead',
    {
      value: Number(input.value || 0),
      currency: CURRENCY,
      num_items: totalQuantity(items),
      content_ids: contentIds(items),
      contents: items.map(cartContent),
      order_id: input.orderId || undefined,
    },
    input.orderId,
  );
}

export function trackContact(source: string, metadata?: Record<string, MetaPayloadValue>) {
  const safeMetadata: MetaPayload = {};
  const allowedKeys = new Set([
    'product_id',
    'product_slug',
    'variant_id',
    'product_type',
    'price',
    'order_id',
    'value',
  ]);

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (allowedKeys.has(key)) {
        safeMetadata[key] = value;
      }
    }
  }

  return track('Contact', { source, ...safeMetadata }, source);
}

export function trackPurchase(input: { orderId: string; items: TrackableCartItem[]; value: number }) {
  const items = input.items || [];

  return track(
    'Purchase',
    {
      value: Number(input.value || 0),
      currency: CURRENCY,
      num_items: totalQuantity(items),
      content_ids: contentIds(items),
      contents: items.map(cartContent),
      order_id: input.orderId,
    },
    input.orderId,
  );
}
