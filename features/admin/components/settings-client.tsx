'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getAdminStoreSettings,
  updateAdminStoreSettings,
} from '@/app/actions/admin-settings';
import type { StoreSettingsInput, StoreSettingsRecord } from '@/app/actions/admin-settings';
import { supabase } from '@/lib/supabase';

interface SettingsFormState {
  store_name: string;
  store_description: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  currency: string;
  currency_symbol: string;
  free_shipping_threshold: string;
  min_order_amount: string;
  maintenance_mode: boolean;
}

const emptyForm: SettingsFormState = {
  store_name: '',
  store_description: null,
  whatsapp_number: null,
  contact_email: null,
  contact_phone: null,
  address: null,
  currency: 'JOD',
  currency_symbol: 'د.أ',
  free_shipping_threshold: '',
  min_order_amount: '',
  maintenance_mode: false,
};

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function formFromSettings(settings: StoreSettingsRecord): SettingsFormState {
  return {
    store_name: settings.store_name,
    store_description: settings.store_description,
    whatsapp_number: settings.whatsapp_number,
    contact_email: settings.contact_email,
    contact_phone: settings.contact_phone,
    address: settings.address,
    currency: settings.currency,
    currency_symbol: settings.currency_symbol,
    free_shipping_threshold:
      settings.free_shipping_threshold === null ? '' : String(settings.free_shipping_threshold),
    min_order_amount: settings.min_order_amount === null ? '' : String(settings.min_order_amount),
    maintenance_mode: settings.maintenance_mode,
  };
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function SettingsClient() {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminStoreSettings(token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل إعدادات المتجر');
      }

      setSettingsId(result.data.id);
      setForm(formFromSettings(result.data));
    } catch (error) {
      toast({
        title: 'تعذر تحميل إعدادات المتجر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsId) return;

    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const payload: StoreSettingsInput = {
        store_name: form.store_name,
        store_description: textOrNull(form.store_description),
        whatsapp_number: textOrNull(form.whatsapp_number),
        contact_email: textOrNull(form.contact_email),
        contact_phone: textOrNull(form.contact_phone),
        address: textOrNull(form.address),
        currency: form.currency,
        currency_symbol: form.currency_symbol,
        free_shipping_threshold: numberOrNull(form.free_shipping_threshold),
        min_order_amount: numberOrNull(form.min_order_amount),
        maintenance_mode: form.maintenance_mode,
      };

      const result = await updateAdminStoreSettings(token, settingsId, payload);
      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ إعدادات المتجر');
      }

      toast({ title: 'تم حفظ إعدادات المتجر', description: payload.store_name });
      await loadSettings();
    } catch (error) {
      toast({
        title: 'تعذر حفظ إعدادات المتجر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الإعدادات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة معلومات المتجر الأساسية المستخدمة في الواجهة وcheckout.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadSettings} disabled={isLoading}>
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-10 rounded bg-muted" />
            ))}
          </div>
        </div>
      ) : settingsId ? (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">إعدادات المتجر العامة</h2>
              <p className="text-sm text-muted-foreground">رقم واتساب هنا هو المصدر الذي يستخدمه checkout.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="store-name">اسم المتجر *</Label>
              <Input
                id="store-name"
                value={form.store_name}
                onChange={(event) => setForm((current) => ({ ...current, store_name: event.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="whatsapp-number">رقم واتساب checkout</Label>
              <Input
                id="whatsapp-number"
                dir="ltr"
                value={form.whatsapp_number || ''}
                onChange={(event) => setForm((current) => ({ ...current, whatsapp_number: event.target.value }))}
                placeholder="962790000000"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="store-description">وصف المتجر</Label>
              <textarea
                id="store-description"
                value={form.store_description || ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, store_description: event.target.value }))
                }
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <div>
              <Label htmlFor="contact-email">بريد التواصل</Label>
              <Input
                id="contact-email"
                type="email"
                dir="ltr"
                value={form.contact_email || ''}
                onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="contact-phone">هاتف التواصل</Label>
              <Input
                id="contact-phone"
                dir="ltr"
                value={form.contact_phone || ''}
                onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="store-address">العنوان</Label>
              <Input
                id="store-address"
                value={form.address || ''}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="currency">العملة</Label>
              <Input
                id="currency"
                dir="ltr"
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="currency-symbol">رمز العملة</Label>
              <Input
                id="currency-symbol"
                value={form.currency_symbol}
                onChange={(event) => setForm((current) => ({ ...current, currency_symbol: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="free-shipping-threshold">حد الشحن المجاني</Label>
              <Input
                id="free-shipping-threshold"
                type="number"
                min="0"
                step="0.01"
                value={form.free_shipping_threshold ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, free_shipping_threshold: event.target.value }))
                }
                placeholder="بدون حد"
              />
            </div>
            <div>
              <Label htmlFor="min-order-amount">الحد الأدنى للطلب</Label>
              <Input
                id="min-order-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.min_order_amount ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, min_order_amount: event.target.value }))
                }
                placeholder="بدون حد"
              />
            </div>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.maintenance_mode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maintenance_mode: event.target.checked }))
                }
              />
              تفعيل وضع الصيانة
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="ml-2 h-4 w-4" />
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-dashed bg-card px-4 py-16 text-center">
          <h2 className="text-lg font-semibold">إعدادات المتجر غير موجودة</h2>
          <p className="mt-1 text-sm text-muted-foreground">تحقق من seed أو جدول store_settings في Supabase.</p>
        </div>
      )}
    </div>
  );
}
