import Link from 'next/link';
import { ProductForm } from '@/features/admin/components/product-form';
import { requireAdminServer } from '@/lib/admin-auth-server';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';

export default async function NewProductPage() {
  await requireAdminServer();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
      <div className="space-y-6 max-w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0 max-w-full">
          <h1 className="text-2xl font-bold min-w-0 break-words whitespace-normal">إضافة منتج جديد</h1>
          <Link href="/admin/products/quick-create" className="max-w-full">
            <Button variant="outline" className="gap-2 w-full sm:w-auto max-w-full">
              <Camera className="h-4 w-4 flex-shrink-0" />
              <span className="min-w-0 break-words whitespace-normal">إضافة سريعة</span>
            </Button>
          </Link>
        </div>
        <ProductForm mode="create" />
      </div>
    </div>
  );
}
