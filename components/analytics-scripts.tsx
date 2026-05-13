import Script from 'next/script';
import { MetaPixelPageView } from '@/components/meta-pixel-page-view';

function normalizeMetaPixelId(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^[0-9]+$/.test(trimmed) ? trimmed : null;
}

function normalizeGa4MeasurementId(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('G-') ? trimmed : null;
}

export function AnalyticsScripts({
  metaPixelId,
  ga4MeasurementId,
}: {
  metaPixelId: string | null;
  ga4MeasurementId: string | null;
}) {
  const metaId = normalizeMetaPixelId(metaPixelId);
  const ga4Id = normalizeGa4MeasurementId(ga4MeasurementId);

  return (
    <>
      {metaId && (
        <>
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?\n  n.callMethod.apply(n,arguments):n.queue.push(arguments)};\n  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\n  n.queue=[];t=b.createElement(e);t.async=!0;\n  t.src=v;s=b.getElementsByTagName(e)[0];\n  s.parentNode.insertBefore(t,s)}(window, document,'script',\n  'https://connect.facebook.net/en_US/fbevents.js');\n  fbq('init', '${metaId}');\n  fbq('track', 'PageView');`,
            }}
          />
          <MetaPixelPageView enabled />
        </>
      )}

      {ga4Id && (
        <>
          <Script
            id="ga4-gtag-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`}
          />
          <Script
            id="ga4-gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${ga4Id}');`,
            }}
          />
        </>
      )}
    </>
  );
}
