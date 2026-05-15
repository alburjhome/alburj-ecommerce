'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { buildProductsSearchHref } from '@/lib/product-search';
import { formatPrice } from '@/lib/utils';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import { cn } from '@/lib/utils';

interface SearchSuggestion {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  isBundle: boolean;
}

interface HeaderSearchProps {
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

const DEBOUNCE_MS = 320;
const SUGGESTION_LIMIT = 8;

export function HeaderSearch({ className, inputClassName, autoFocus, onNavigate }: HeaderSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const goToResults = useCallback(
    (term: string) => {
      const value = term.trim();
      if (!value) return;
      setIsOpen(false);
      onNavigate?.();
      window.location.href = buildProductsSearchHref(value);
    },
    [onNavigate]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (term.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as { results?: SearchSuggestion[] };
        setSuggestions(data.results || []);
        setIsOpen(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div ref={containerRef} className={cn('relative', className)} dir="rtl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          goToResults(query);
        }}
        className="relative"
      >
        <Input
          type="search"
          placeholder="ابحث عن منتج..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
          className={cn('w-full text-base', inputClassName)}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="absolute left-0 top-0"
          aria-label="بحث"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {suggestions.length > 0 ? (
            <ul className="max-h-[min(70vh,24rem)] overflow-y-auto py-1">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/product/${item.slug}`}
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate?.();
                      void fetch('/api/search/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          query,
                          resultsCount: suggestions.length,
                          source: 'header_suggestion_click',
                          clickedProductId: item.id,
                        }),
                        keepalive: true,
                      });
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={item.image || PLACEHOLDER_PRODUCT}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                    </div>
                    {item.isBundle && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        باكج
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Package className="h-4 w-4 shrink-0" />
              لا توجد اقتراحات — اضغط Enter للبحث
            </div>
          ) : null}
          <div className="border-t px-3 py-2">
            <button
              type="button"
              onClick={() => goToResults(query)}
              className="w-full text-right text-xs font-medium text-primary hover:underline"
            >
              عرض كل النتائج لـ &quot;{query.trim()}&quot;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
