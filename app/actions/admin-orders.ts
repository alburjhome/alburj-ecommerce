'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminActionClient } from '@/lib/admin-auth';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderListFilters {
  page?: number;
  search?: string;
  status?: 'all' | OrderStatus;
  governorate?: string;
}

export interface OrderListRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  governorate: string;
  city: string;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  item_type: 'product' | 'bundle';
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  variant_id: string | null;
  variant_name: string | null;
  variant_options: Record<string, string> | null;
  variant_sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  bundle_items_snapshot: Array<{
    product_name: string;
    variant_options?: Record<string, string> | null;
    quantity: number;
  }> | null;
  created_at: string;
}

export interface OrderDetailsRecord extends OrderListRow {
  customer_email: string | null;
  address: string;
  landmark: string | null;
  notes: string | null;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  whatsapp_message_url: string | null;
  updated_at: string;
  items: OrderItemRecord[];
}

export interface OrdersListResult {
  orders: OrderListRow[];
  governorates: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 12;

const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

const paymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'refunded']);

const orderStateSchema = z.object({
  status: orderStatusSchema.optional(),
  payment_status: paymentStatusSchema.optional(),
});

export type OrderStateInput = z.infer<typeof orderStateSchema>;

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logOrdersError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-orders:${action}] ${message}`);
}

function sanitizeSearch(search: string) {
  return search.trim().replace(/[,()]/g, ' ');
}

export async function getAdminOrders(
  accessToken: string | null,
  filters: OrderListFilters = {}
): Promise<ActionResult<OrdersListResult>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const page = Math.max(1, filters.page || 1);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = (adminClient.from('orders') as any)
      .select(
        'id, order_number, customer_name, customer_phone, governorate, city, total, status, payment_status, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    const search = filters.search ? sanitizeSearch(filters.search) : '';
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.governorate && filters.governorate !== 'all') {
      query = query.eq('governorate', filters.governorate);
    }

    const [ordersResult, governoratesResult] = await Promise.all([
      query,
      (adminClient.from('shipping_rates') as any)
        .select('governorate')
        .order('governorate_en', { ascending: true }),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (governoratesResult.error) throw governoratesResult.error;

    return {
      success: true,
      data: {
        orders: (ordersResult.data || []) as OrderListRow[],
        governorates: ((governoratesResult.data || []) as Array<{ governorate: string }>).map(
          (item) => item.governorate
        ),
        page,
        pageSize: PAGE_SIZE,
        total: ordersResult.count || 0,
        totalPages: Math.max(1, Math.ceil((ordersResult.count || 0) / PAGE_SIZE)),
      },
    };
  } catch (error) {
    logOrdersError('getAdminOrders', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function getAdminOrderDetails(
  accessToken: string | null,
  orderId: string
): Promise<ActionResult<OrderDetailsRecord>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const [orderResult, itemsResult] = await Promise.all([
      (adminClient.from('orders') as any).select('*').eq('id', orderId).single(),
      (adminClient.from('order_items') as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    ]);

    if (orderResult.error || !orderResult.data) throw orderResult.error || new Error('الطلب غير موجود');
    if (itemsResult.error) throw itemsResult.error;

    return {
      success: true,
      data: {
        ...(orderResult.data as OrderDetailsRecord),
        items: (itemsResult.data || []) as OrderItemRecord[],
      },
    };
  } catch (error) {
    logOrdersError('getAdminOrderDetails', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminOrderState(
  accessToken: string | null,
  orderId: string,
  input: OrderStateInput
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = orderStateSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'حالة الطلب أو الدفع غير صالحة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    if (!parsed.data.status && !parsed.data.payment_status) {
      throw new Error('لا توجد تغييرات للحفظ');
    }

    const { error } = await (adminClient.from('orders') as any)
      .update(parsed.data)
      .eq('id', orderId);

    if (error) throw error;

    revalidatePath('/admin/orders');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (error) {
    logOrdersError('updateAdminOrderState', error);
    return { success: false, error: friendlyError(error) };
  }
}
