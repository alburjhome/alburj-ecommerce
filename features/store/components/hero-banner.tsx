'use client';

import Link from 'next/link';
import { MessageCircle, ShoppingBag } from 'lucide-react';
import { Banner } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_BANNER, safeImageSrc } from '@/lib/image-utils';
import { trackWhatsAppClick } from '@/lib/analytics';

interface HeroBannerProps {
  banners: Banner[];
  whatsappUrl?: string | null;
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

export function HeroBanner({ banners, whatsappUrl }: HeroBannerProps) {
  if (!banners.length) {
    return (
      <section className="relative flex h-[340px] items-center bg-gradient-to-r from-primary/10 to-primary/5 sm:h-[400px] md:h-[620px]">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <ShoppingBag className="h-3.5 w-3.5" />
              جملة ومفرق للمنازل والمحلات
            </div>
            <h1 className="mb-3 text-3xl font-bold leading-tight text-foreground md:mb-4 md:text-5xl">
              <span className="md:hidden">مستلزمات البيت والمحل والمطعم</span>
              <span className="hidden md:inline">مؤسسة البرج</span>
            </h1>
            <p className="mb-5 max-w-lg text-base leading-7 text-muted-foreground md:mb-6 md:text-xl">
              <span className="md:hidden">منظفات، تغليف، بلاستيك وأدوات منزلية — جملة ومفرق</span>
              <span className="hidden md:inline">
                وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن
              </span>
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/products">تسوق الآن</Link>
              </Button>
              {whatsappUrl && (
                <Button asChild size="lg" variant="outline" className="w-full bg-white/80 sm:w-auto">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackWhatsAppClick('hero_whatsapp')}
                  >
                    <MessageCircle className="ml-2 h-4 w-4" />
                    اطلب عبر واتساب
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const banner = banners[0];
  const imageSrc = safeImageSrc(banner.image_url, PLACEHOLDER_BANNER);
  const mobileImageSrc = safeImageSrc(banner.mobile_image_url || banner.image_url, PLACEHOLDER_BANNER);
  const bannerLink = normalizeBannerLink(banner.link_url);

  return (
    <section className="hero-banner relative h-[340px] sm:h-[400px] md:h-[620px]">
      {/* Mobile image */}
      <div className="absolute inset-0 md:hidden">
        <SafeImage
          src={mobileImageSrc}
          fallbackSrc={PLACEHOLDER_BANNER}
          alt={banner.title}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      </div>

      {/* Desktop image */}
      <div className="absolute inset-0 hidden md:block">
        <SafeImage
          src={imageSrc}
          fallbackSrc={PLACEHOLDER_BANNER}
          alt={banner.title}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent z-10" />

      <div className="container relative z-20 mx-auto flex h-full items-end px-4 pb-8 sm:pb-10 md:pb-20">
        <div className="max-w-2xl text-white">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">
            <ShoppingBag className="h-3.5 w-3.5" />
            جملة ومفرق للمنازل والمحلات
          </div>
          <h1 className="mb-3 text-3xl font-bold leading-tight md:mb-4 md:text-5xl">
            <span className="md:hidden">مستلزمات البيت والمحل والمطعم</span>
            <span className="hidden md:inline">{banner.title}</span>
          </h1>
          <p className="mb-5 max-w-lg text-base leading-7 text-white/90 md:mb-6 md:text-xl">
            <span className="md:hidden">منظفات، تغليف، بلاستيك وأدوات منزلية — جملة ومفرق</span>
            {banner.subtitle && <span className="hidden md:inline">{banner.subtitle}</span>}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {bannerLink && (
              <Button asChild size="lg" className="w-full bg-white text-primary hover:bg-white/90 sm:w-auto">
                <Link href={bannerLink}>تسوق الآن</Link>
              </Button>
            )}
            {whatsappUrl && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-white/80 bg-white/10 text-white hover:bg-white hover:text-primary sm:w-auto"
              >
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackWhatsAppClick('hero_whatsapp')}
                >
                  <MessageCircle className="ml-2 h-4 w-4" />
                  اطلب عبر واتساب
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
