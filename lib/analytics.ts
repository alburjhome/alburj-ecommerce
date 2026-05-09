export type AnalyticsMetadata = Record<string, string | number | boolean | null | undefined>;

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
