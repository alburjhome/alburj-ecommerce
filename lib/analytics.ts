export type AnalyticsMetadata = Record<string, string | number | boolean | null | undefined>;

const MAX_ANALYTICS_PAYLOAD_BYTES = 8000;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    gtag?: (...args: any[]) => void;
  }
}

export function trackWhatsAppClick(source: string, metadata?: AnalyticsMetadata) {
  if (typeof window === 'undefined') return;

  const safeMetadata: Record<string, string | number | boolean> = {};
  if (metadata && typeof metadata === 'object') {
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safeMetadata[key] = value;
      }
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      console.info('WhatsApp Click:', { source, metadata: safeMetadata });
    } catch {
      // ignore
    }
  }

  try {
    const path = typeof window.location?.pathname === 'string' ? window.location.pathname : undefined;
    const payload = JSON.stringify({ source, metadata: safeMetadata, path });

    if (payload.length <= MAX_ANALYTICS_PAYLOAD_BYTES) {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/analytics/whatsapp-click', blob);
        } catch {
          // ignore
        }
      } else if (typeof fetch === 'function') {
        try {
          fetch('/api/analytics/whatsapp-click', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => undefined);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    window.fbq?.('trackCustom', 'WhatsAppClick', { source, ...safeMetadata });
  } catch {
    // ignore
  }

  try {
    window.gtag?.('event', 'whatsapp_click', { source, ...safeMetadata });
  } catch {
    // ignore
  }
}
