import Link from 'next/link';
import { Metadata } from 'next';
import { Tag, Store, Box, Sofa, ChefHat, Sparkles, Boxes, Package, MessageCircle, ArrowLeft, Search, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Header } from '@/features/store/components/header';
import { Footer } from '@/features/store/components/footer';
import { SafeImage } from '@/components/ui/safe-image';
import { TrackedWhatsAppLink } from '@/components/tracked-whatsapp-link';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';
import { getWhatsAppLink } from '@/lib/store-settings';
import type { Category, StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/?$/, '');

export const metadata: Metadata = {
  title: 'الأقسام | مؤسسة البرج',
  description:
    'تصفح أقسام مؤسسة البرج حسب احتياجك: منظفات، ورقيات، تغليف، بلاستيكيات، أدوات منزلية ومطبخ، مستلزمات مطاعم ومحلات، عروض وكميات.',
  alternates: {
    canonical: `${baseUrl}/categories`,
  },
  openGraph: {
    title: 'الأقسام | مؤسسة البرج',
    description:
      'تصفح أقسام مؤسسة البرج حسب احتياجك: منظفات، ورقيات، تغليف، بلاستيكيات، أدوات منزلية ومطبخ، مستلزمات مطاعم ومحلات، عروض وكميات.',
    url: `${baseUrl}/categories`,
    type: 'website',
    images: [
      {
        url: `${baseUrl}${PLACEHOLDER_CATEGORY}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الأقسام | مؤسسة البرج',
    description:
      'تصفح أقسام مؤسسة البرج حسب احتياجك: منظفات، ورقيات، تغليف، بلاستيكيات، أدوات منزلية ومطبخ، مستلزمات مطاعم ومحلات، عروض وكميات.',
    images: [`${baseUrl}${PLACEHOLDER_CATEGORY}`],
  },
};

async function getSettings() {
  const { data } = await supabase
    .from('store_settings')
    .select(
      'store_name, store_description, whatsapp_number, contact_email, contact_phone, address, facebook_url, instagram_url, tiktok_url, snapchat_url, youtube_url'
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as Pick<
    StoreSettings,
    | 'store_name'
    | 'store_description'
    | 'whatsapp_number'
    | 'contact_email'
    | 'contact_phone'
    | 'address'
    | 'facebook_url'
    | 'instagram_url'
    | 'tiktok_url'
    | 'snapchat_url'
    | 'youtube_url'
  > | null;
}

async function getCategories() {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (data || []) as Category[];
}

const shopByNeedItems = [
  {
    href: '/offers',
    title: 'العروض',
    description: 'منتجات مختارة بعروض وأسعار مناسبة.',
    icon: Tag,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    href: '/restaurants',
    title: 'للمطاعم والكافيهات',
    description: 'تغليف، ورقيات، منظفات ومستلزمات تشغيل.',
    icon: Store,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/packaging',
    title: 'التغليف',
    description: 'علب، أكياس، رولات وأدوات تغليف.',
    icon: Box,
    color: 'bg-green-50 text-green-600',
  },
  {
    href: '/plastic-products',
    title: 'البلاستيكيات',
    description: 'كراسي، طاولات، سلات وأدوات بلاستيكية.',
    icon: Sofa,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    href: '/home-kitchen',
    title: 'البيت والمطبخ',
    description: 'أدوات منزلية، مستلزمات مطبخ وتنظيم.',
    icon: ChefHat,
    color: 'bg-red-50 text-red-600',
  },
  {
    href: '/cleaning',
    title: 'المنظفات والورقيات',
    description: 'منظفات، مناديل، فوط ومعقمات.',
    icon: Sparkles,
    color: 'bg-cyan-50 text-cyan-600',
  },
  {
    href: '/bulk',
    title: 'الكميات والجملة',
    description: 'عروض كميات للمطاعم والمحلات والبيت.',
    icon: Boxes,
    color: 'bg-amber-50 text-amber-600',
  },
];

function HeroSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const heroMessage = 'مرحبا، أريد الاستفسار عن المنتجات المتوفرة.';
  const heroWhatsAppHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(heroMessage)}` : null;

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-10 md:py-14" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            تسوق حسب احتياجك
          </h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            اختر القسم أو نوع الطلب المناسب لك، وجهّز طلبك بسهولة عبر مؤسسة البرج.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Package className="h-5 w-5" />
              تصفح كل المنتجات
            </Link>

            {heroWhatsAppHref ? (
              <TrackedWhatsAppLink
                href={heroWhatsAppHref}
                source="categories_hero_whatsapp"
                metadata={{ cta_name: 'categories_hero' }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-5 w-5" />
                جهّز طلبك عبر واتساب
              </TrackedWhatsAppLink>
            ) : (
              <span className="inline-flex items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                رقم واتساب غير مُعدّل حاليًا
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ShopByNeedSection() {
  return (
    <section className="py-8 md:py-12" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">تسوق حسب احتياجك</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            اختر التصنيف المناسب لاحتياجاتك وتصفح المنتجات المخصصة.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shopByNeedItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col rounded-xl border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold leading-6">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-auto pt-4">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                    تسوق الآن
                    <ArrowLeft className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MainCategoriesSection({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="border-t bg-muted/30 py-8 md:py-12" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">الأقسام الرئيسية</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            تصفح الأقسام الأساسية واختر ما يناسبك من منتجات متنوعة.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group overflow-hidden rounded-lg border bg-card"
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                <SafeImage
                  src={safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY)}
                  fallbackSrc={PLACEHOLDER_CATEGORY}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 25vw"
                  priority={index < 4}
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{category.name}</h3>
                {category.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesEmptyState({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section className="border-t bg-muted/30 py-8 md:py-12" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="rounded-lg border border-dashed bg-background px-4 py-16 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-lg font-semibold">لا توجد أقسام مضافة حاليًا</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            يمكنك تصفح جميع المنتجات أو التواصل معنا مباشرة للمساعدة.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Package className="h-4 w-4" />
              تصفح كل المنتجات
            </Link>
            {whatsappUrl && (
              <TrackedWhatsAppLink
                href={whatsappUrl}
                source="categories_empty_whatsapp"
                metadata={{ cta_name: 'categories_empty' }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                تواصل عبر واتساب
              </TrackedWhatsAppLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HelpSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const helpMessage = 'مرحبا، أحتاج مساعدة في اختيار المنتجات المناسبة من مؤسسة البرج.';
  const helpHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(helpMessage)}` : null;

  return (
    <section className="py-8 md:py-12" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-6 md:p-10">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-right">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HelpCircle className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold md:text-2xl">لست متأكدًا ماذا تحتاج؟</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  أرسل لنا احتياجك وسنساعدك بتجهيز الطلب المناسب
                </p>
              </div>
            </div>

            {helpHref ? (
              <TrackedWhatsAppLink
                href={helpHref}
                source="categories_help_whatsapp"
                metadata={{ cta_name: 'categories_help' }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-5 w-5" />
                تواصل معنا عبر واتساب
              </TrackedWhatsAppLink>
            ) : (
              <span className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm text-muted-foreground">
                رقم واتساب غير مُعدّل حاليًا
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function CategoriesPage() {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const whatsappUrl = getWhatsAppLink(settings?.whatsapp_number);

  return (
    <div className="min-h-screen bg-background">
      <Header whatsappUrl={whatsappUrl} />

      <main>
        <HeroSection whatsappUrl={whatsappUrl} />
        <ShopByNeedSection />
        {categories.length > 0 ? (
          <MainCategoriesSection categories={categories} />
        ) : (
          <CategoriesEmptyState whatsappUrl={whatsappUrl} />
        )}
        <HelpSection whatsappUrl={whatsappUrl} />
      </main>

      <Footer settings={settings} />
    </div>
  );
}
