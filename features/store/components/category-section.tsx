import Link from 'next/link';
import { Category } from '@/types';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';

interface CategorySectionProps {
  categories: Category[];
}

export function CategorySection({ categories }: CategorySectionProps) {
  if (!categories.length) return null;

  return (
    <section id="categories" className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">تسوق حسب القسم</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            اختر احتياجاتك من المنظفات، البلاستيك، التغليف، الأدوات المنزلية والمفروشات
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group relative aspect-square rounded-lg overflow-hidden image-zoom"
            >
              <SafeImage
                src={safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY)}
                fallbackSrc={PLACEHOLDER_CATEGORY}
                alt={category.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                priority={index < 4}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                <h3 className="text-white font-semibold text-base md:text-lg leading-tight line-clamp-2">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-white/80 text-xs md:text-sm line-clamp-1 mt-1">{category.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
