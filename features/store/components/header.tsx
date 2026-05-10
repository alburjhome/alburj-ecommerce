'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, Search, ShoppingCart, User, X, Phone, Home, Package, LayoutGrid, Tag, MessageCircle, Store, Box, Sofa, ChefHat, Sparkles, Boxes, Truck, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import useCartStore from '@/stores/cart';
import { CartDrawer } from './cart-drawer';
import { cn } from '@/lib/utils';
import { trackWhatsAppClick } from '@/lib/analytics';

interface HeaderProps {
  whatsappUrl?: string | null;
}

export function Header({ whatsappUrl }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { openCart, getTotalItems, hasHydrated, rehydrate } = useCartStore();
  const cartCount = hasHydrated ? getTotalItems() : 0;

  useEffect(() => {
    if (!hasHydrated) {
      rehydrate();
    }
  }, [hasHydrated, rehydrate]);

  const quickSearchSuggestions = [
    'شامبو سجاد',
    'علب تغليف',
    'كراسي بلاستيك',
    'مناديل',
    'أدوات مطبخ',
    'منظفات',
    'بلاستيكيات',
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const goToSearch = (keyword: string) => {
    const term = keyword.trim();
    if (!term) return;
    setIsSearchOpen(false);
    setSearchQuery(term);
    window.location.href = `/products?search=${encodeURIComponent(term)}`;
  };

  const navLinks = [
    { href: '/', label: 'الرئيسية', icon: Home },
    { href: '/products', label: 'المنتجات', icon: Package },
    { href: '/categories', label: 'الأقسام', icon: LayoutGrid },
    { href: '/offers', label: 'العروض', icon: Tag },
    { href: '/restaurants', label: 'للمطاعم والكافيهات', icon: Store },
    { href: '/packaging', label: 'التغليف', icon: Box },
    { href: '/plastic-products', label: 'البلاستيكيات', icon: Sofa },
    { href: '/home-kitchen', label: 'البيت والمطبخ', icon: ChefHat },
    { href: '/cleaning', label: 'المنظفات والورقيات', icon: Sparkles },
    { href: '/bulk', label: 'الكميات والجملة', icon: Boxes },
    { href: '/quick-order', label: 'جهّز طلبك خلال دقيقة', icon: MessageCircle },
    { href: '/#contact', label: 'تواصل معنا', icon: MessageCircle },
  ];

  const categoryLinks = [
    { href: '/category/cleaning-paper-personal-care', label: 'المنظفات والورقيات' },
    { href: '/category/plastic-packaging', label: 'البلاستيك والتغليف' },
    { href: '/category/restaurants-shops', label: 'مستلزمات المطاعم والمحلات' },
    { href: '/category/home-kitchen', label: 'الأدوات المنزلية والمطبخ' },
    { href: '/category/furnishings-linens', label: 'المفروشات والبياضات' },
    { href: '/category/electrical-appliances', label: 'الأجهزة الكهربائية' },
    { href: '/category/offers-bulk', label: 'العروض والكميات' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-sm">
        <p className="flex items-center justify-center gap-2">
          <Phone className="h-4 w-4" />
          <span>للطلب والاستفسار: تواصل معنا عبر الواتساب</span>
        </p>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex h-[4.5rem] items-center justify-between gap-4">
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>القائمة الرئيسية</SheetTitle>
                <SheetDescription>روابط أقسام المتجر والسلة.</SheetDescription>
              </SheetHeader>

              <div className="flex h-full flex-col overflow-y-auto">
                {/* Logo + slogan */}
                <div className="flex flex-col items-center border-b px-5 py-6 text-center">
                  <img
                    src="/brand/logo.svg"
                    alt="مؤسسة البرج"
                    className="h-12 w-auto object-contain"
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    مستلزمات البيت والمحل في مكان واحد
                  </p>
                </div>

                {/* Main nav links */}
                <nav className="flex flex-col gap-1 px-3 py-4">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <SheetClose asChild key={`${link.href}-${link.label}`}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                        >
                          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          {link.label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </nav>

                {/* Shop by category */}
                <div className="px-3 py-2">
                  <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    تسوق حسب القسم
                  </div>
                  <nav className="flex flex-col gap-0.5">
                    {categoryLinks.map((link) => (
                      <SheetClose asChild key={link.href}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                          {link.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                </div>

                <div className="mt-auto border-t px-5 py-5 space-y-4">
                  {/* WhatsApp button */}
                  {whatsappUrl && (
                    <SheetClose asChild>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          trackWhatsAppClick('mobile_menu_whatsapp');
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <MessageCircle className="h-5 w-5" />
                        تواصل عبر واتساب
                      </a>
                    </SheetClose>
                  )}

                  {/* Trust points */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
                    <div className="flex flex-col items-center gap-1">
                      <Truck className="h-4 w-4 text-primary" />
                      <span>توصيل لجميع المحافظات</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span>الدفع عند الاستلام</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>منتجات مختارة بعناية</span>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link
            href="/"
            className="flex items-center justify-center min-w-[110px] shrink-0 md:min-w-[140px]"
          >
            <img
              src="/brand/logo.svg"
              alt="مؤسسة البرج"
              className="h-11 w-auto shrink-0 object-contain md:h-14"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="text-sm font-medium hover:text-primary transition-colors category-nav-item"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden md:flex items-center">
              <form onSubmit={handleSearch} className="relative">
                <Input
                  type="search"
                  placeholder="ابحث عن منتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 lg:w-64"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-0"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            <Button variant="ghost" size="icon" className="relative" onClick={openCart}>
              <ShoppingCart className="h-5 w-5" />
              {hasHydrated && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Button>

            <Link href="/admin/login">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {isSearchOpen && (
          <div className="md:hidden pb-4" dir="rtl">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="ابحث عن منتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-base"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {quickSearchSuggestions.map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => goToSearch(keyword)}
                    className="rounded-full border bg-card px-3 py-1 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </form>
          </div>
        )}
      </div>
      <CartDrawer />
    </header>
  );
}
