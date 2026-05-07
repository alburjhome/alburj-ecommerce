'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Boxes,
  Gauge,
  Image,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ServerAdminUser } from '@/lib/admin-auth-server';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/admin/products', label: 'المنتجات', icon: Package },
  { href: '/admin/categories', label: 'الأقسام', icon: LayoutGrid },
  { href: '/admin/subcategories', label: 'الفئات', icon: Tags },
  { href: '/admin/orders', label: 'الطلبات', icon: ShoppingCart },
  { href: '/admin/shipping', label: 'الشحن', icon: Truck },
  { href: '/admin/banners', label: 'البانرات', icon: Image },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings },
];

export function AdminShell({
  admin,
  children,
}: {
  admin: ServerAdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const title = useMemo(() => {
    return navItems
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname.startsWith(item.href))?.label;
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
    router.replace('/admin/login');
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-l bg-card">
      <div className="flex h-16 items-center justify-between border-b px-5">
        <Link href="/admin/dashboard" className="flex items-center gap-3 font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </span>
          <span>إدارة البرج</span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-muted/40" dir="rtl">
      <div className="hidden md:fixed md:inset-y-0 md:right-0 md:block">{sidebar}</div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 right-0">{sidebar}</div>
        </div>
      )}

      <div className="md:pr-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">مؤسسة البرج</p>
              <h1 className="text-base font-semibold">{title || 'لوحة التحكم'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium">{admin.full_name || 'مدير المتجر'}</p>
              <p className="text-xs text-muted-foreground">{admin.email}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل خروج
            </Button>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
