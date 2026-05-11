import Link from 'next/link';
import { ProductForm } from '@/features/admin/components/product-form';
import { requireAdminServer } from '@/lib/admin-auth-server';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';

export default async function NewProductPage() {
  await requireAdminServer();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إضافة منتج جديد</h1>
        <Link href="/admin/products/quick-create">
          <Button variant="outline" className="gap-2">
            <Camera className="h-4 w-4" />
            إضافة سريعة بالصور
          </Button>
        </Link>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
