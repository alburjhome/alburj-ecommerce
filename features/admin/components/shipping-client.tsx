'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  getAdminShippingRates,
  updateAdminShippingRate,
} from '@/app/actions/admin-shipping';
import type { ShippingRateInput, ShippingRateRecord } from '@/app/actions/admin-shipping';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';

interface ShippingDraft {
  rate: string;
  free_shipping_threshold: string;
  estimated_days: string;
  is_active: boolean;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function buildDraft(rate: ShippingRateRecord): ShippingDraft {
  return {
    rate: String(rate.rate),
    free_shipping_threshold:
      rate.free_shipping_threshold === null ? '' : String(rate.free_shipping_threshold),
    estimated_days: String(rate.estimated_days),
    is_active: rate.is_active,
  };
}

function buildDrafts(rates: ShippingRateRecord[]) {
  return rates.reduce<Record<string, ShippingDraft>>((acc, rate) => {
    acc[rate.id] = buildDraft(rate);
    return acc;
  }, {});
}

export function ShippingClient() {
  const { toast } = useToast();
  const [rates, setRates] = useState<ShippingRateRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ShippingDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminShippingRates(token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل أسعار الشحن');
      }

      setRates(result.data);
      setDrafts(buildDrafts(result.data));
    } catch (error) {
      toast({
        title: 'تعذر تحميل أسعار الشحن',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  function updateDraft(id: string, patch: Partial<ShippingDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function saveRate(rate: ShippingRateRecord, nextActive?: boolean) {
    const draft = drafts[rate.id] || buildDraft(rate);
    const payload: ShippingRateInput = {
      rate: Number(draft.rate),
      free_shipping_threshold:
        draft.free_shipping_threshold.trim() === ''
          ? null
          : Number(draft.free_shipping_threshold),
      estimated_days: Number(draft.estimated_days),
      is_active: typeof nextActive === 'boolean' ? nextActive : draft.is_active,
    };

    setMutatingId(rate.id);
    try {
      const token = await getAccessToken();
      const result = await updateAdminShippingRate(token, rate.id, payload);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ المحافظة');
      }

      toast({
        title: 'تم حفظ إعدادات الشحن',
        description: `${rate.governorate} - ${formatPrice(payload.rate)}`,
      });
      await loadRates();
    } catch (error) {
      toast({
        title: 'تعذر حفظ إعدادات الشحن',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الشحن</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة أسعار التوصيل حسب المحافظة وحالة توفر الشحن.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadRates} disabled={isLoading}>
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المحافظة</th>
                <th className="px-4 py-3 text-right font-medium">السعر</th>
                <th className="px-4 py-3 text-right font-medium">حد الشحن المجاني</th>
                <th className="px-4 py-3 text-right font-medium">الأيام المتوقعة</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b">
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                rates.map((rate) => {
                  const draft = drafts[rate.id] || buildDraft(rate);
                  const isBusy = mutatingId === rate.id;

                  return (
                    <tr key={rate.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{rate.governorate}</div>
                        <div className="text-xs text-muted-foreground">{rate.governorate_en}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.rate}
                          onChange={(event) => updateDraft(rate.id, { rate: event.target.value })}
                          className="w-28"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.free_shipping_threshold}
                          onChange={(event) =>
                            updateDraft(rate.id, { free_shipping_threshold: event.target.value })
                          }
                          placeholder="بدون حد"
                          className="w-36"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={draft.estimated_days}
                          onChange={(event) =>
                            updateDraft(rate.id, { estimated_days: event.target.value })
                          }
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            draft.is_active
                              ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                              : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'
                          }
                        >
                          {draft.is_active ? 'متاح' : 'معطل'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => saveRate(rate)}
                          >
                            <Save className="ml-1 h-4 w-4" />
                            حفظ
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => {
                              const nextActive = !draft.is_active;
                              updateDraft(rate.id, { is_active: nextActive });
                              saveRate(rate, nextActive);
                            }}
                          >
                            {draft.is_active ? 'تعطيل' : 'تفعيل'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && rates.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Truck className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">لا توجد محافظات شحن</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              لم يتم العثور على سجلات في جدول shipping_rates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
