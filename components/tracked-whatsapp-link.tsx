'use client';

import { trackWhatsAppClick, type AnalyticsMetadata } from '@/lib/analytics';

export function TrackedWhatsAppLink({
  href,
  source,
  metadata,
  className,
  children,
  target = '_blank',
  rel = 'noopener noreferrer',
}: {
  href: string;
  source: string;
  metadata?: AnalyticsMetadata;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={className}
      onClick={() => {
        trackWhatsAppClick(source, metadata);
      }}
    >
      {children}
    </a>
  );
}
