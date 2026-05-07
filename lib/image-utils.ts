const ALLOWED_IMAGE_HOSTS = new Set([
  'images.unsplash.com',
  'jfpfdmkggdhjaqogacik.supabase.co',
]);

const KNOWN_BROKEN_IMAGE_MARKERS = [
  'photo-1607082348824-92a7e5275b60',
];

export const PLACEHOLDER_PRODUCT = '/placeholder-product.svg';
export const PLACEHOLDER_CATEGORY = '/placeholder-category.svg';
export const PLACEHOLDER_BANNER = '/placeholder-banner.svg';

export function safeImageSrc(
  src: string | null | undefined,
  fallback = PLACEHOLDER_PRODUCT
) {
  if (!src || typeof src !== 'string') {
    return fallback;
  }

  const trimmed = src.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (KNOWN_BROKEN_IMAGE_MARKERS.some((marker) => trimmed.includes(marker))) {
    return fallback;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== 'https:') {
      return fallback;
    }

    if (ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
      return trimmed;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
