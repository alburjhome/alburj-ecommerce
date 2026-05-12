'use client';

import { useToast } from '@/hooks/use-toast';

interface CartToastActionsProps {
  onViewCart: () => void;
}

export function CartToastActions({ onViewCart }: CartToastActionsProps) {
  const { dismiss } = useToast();

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => {
          dismiss();
          onViewCart();
        }}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        عرض السلة
      </button>
      <button
        type="button"
        onClick={() => dismiss()}
        className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
      >
        متابعة
      </button>
    </div>
  );
}
