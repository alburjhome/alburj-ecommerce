'use client';

import { trackWhatsAppClick, type AnalyticsMetadata } from '@/lib/analytics';

export function TrackedWhatsAppLink({
  href,
  source,
  metadata,
  className,
  children,
}: {
  href: string;
  source: string;
  metadata?: AnalyticsMetadata;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        trackWhatsAppClick(source, metadata);
      }}
    >
      {children}
    </a>
  );
}
