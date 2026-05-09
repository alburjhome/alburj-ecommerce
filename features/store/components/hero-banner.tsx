'use client';

import Link from 'next/link';
import { Banner } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_BANNER, safeImageSrc } from '@/lib/image-utils';

interface HeroBannerProps {
  banners: Banner[];
}

function normalizeBannerLink(value: string | null | undefined) {
  const href = value?.trim();
  if (!href) return null;
  if (href.startsWith('/products/')) {
    return href.replace('/products/', '/product/');
  }
  if (href.startsWith('/categories/')) {
    return href.replace('/categories/', '/category/');
  }
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('https://')) {
    return href;
  }
  return null;
}

export function HeroBanner({ banners }: HeroBannerProps) {
  if (!banners.length) {
    return (
      <section className="relative h-[400px] md:h-[500px] bg-gradient-to-r from-primary/10 to-primary/5 flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              مؤسسة البرج
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-6">
              وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن
            </p>
            <Link href="/products">
              <Button size="lg">تسوق الآن</Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const banner = banners[0];
  const imageSrc = safeImageSrc(banner.image_url, PLACEHOLDER_BANNER);
  const bannerLink = normalizeBannerLink(banner.link_url);

  return (
    <section className="relative h-[400px] md:h-[500px] hero-banner">
      <SafeImage
        src={imageSrc}
        fallbackSrc={PLACEHOLDER_BANNER}
        alt={banner.title}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
      <div className="relative z-20 container mx-auto px-4 h-full flex items-end pb-16">
        <div className="max-w-2xl text-white">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{banner.title}</h1>
          {banner.subtitle && (
            <p className="text-lg md:text-xl text-white/90 mb-6">{banner.subtitle}</p>
          )}
          {bannerLink && (
            <Link href={bannerLink}>
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                تسوق الآن
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
