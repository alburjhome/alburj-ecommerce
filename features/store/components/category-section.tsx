import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Category } from '@/types';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';

interface CategorySectionProps {
  categories: Category[];
}

export function CategorySection({ categories }: CategorySectionProps) {
  if (!categories.length) return null;

  return (
    <section id="categories" className="scroll-mt-20 bg-white py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-primary">
              الأقسام
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">تسوق حسب القسم</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground md:text-base">
              اختر احتياجاتك من المنظفات، البلاستيك، التغليف، الأدوات المنزلية والمفروشات.
            </p>
          </div>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-primary/80"
          >
            عرض كل الأقسام
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-slate-100 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <SafeImage
                src={safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY)}
                fallbackSrc={PLACEHOLDER_CATEGORY}
                alt={category.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                priority={index < 2}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                <h3 className="line-clamp-2 text-base font-bold leading-tight text-white md:text-lg">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="mt-1 line-clamp-1 text-xs text-white/80 md:text-sm">{category.description}</p>
                )}
                <span className="mt-3 hidden items-center gap-1 text-xs font-bold text-white/90 sm:inline-flex">
                  تصفح المنتجات
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
