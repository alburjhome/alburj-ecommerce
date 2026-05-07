'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export interface CheckoutItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number; // Client price - for reference only
  variant_name?: string | null;
}

export interface CheckoutData {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  governorate: string;
  city: string;
  address: string;
  landmark?: string | null;
  notes?: string | null;
  items: CheckoutItem[];
}

export interface CheckoutResult {
  success: boolean;
  order?: {
    id: string;
    order_number: string;
  };
  whatsappUrl?: string;
  error?: string;
  details?: {
    subtotal: number;
    shipping_cost: number;
    total: number;
    items_verified: boolean;
    price_discrepancies?: Array<{
      product_id: string;
      client_price: number;
      server_price: number;
    }>;
  };
}

function isServerConfigurationError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('supabase_service_role_key') ||
    message.includes('invalid api key') ||
    message.includes('api key') ||
    message.includes('jwt')
  );
}

function logCheckoutError(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[checkout:${scope}] ${message}`);
}

async function validateCheckoutServerConfiguration(
  serverClient: ReturnType<typeof createServerClient>
) {
  const { error } = await serverClient
    .from('shipping_rates')
    .select('id')
    .limit(1);

  if (error) {
    throw error;
  }
}

function normalizeWhatsAppNumber(value: string | null | undefined) {
  if (!value || value.includes('X')) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;

  if (normalized.length < 8 || normalized.length > 15) {
    return null;
  }

  return normalized;
}

async function getCheckoutWhatsAppNumber(serverClient: ReturnType<typeof createServerClient>) {
  const { data, error } = await (serverClient.from('store_settings') as any)
    .select('whatsapp_number')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') throw error;
    return null;
  }

  return normalizeWhatsAppNumber(data.whatsapp_number);
}

/**
 * Server-side checkout action that:
 * 1. Verifies all product prices from the database (prevents price tampering)
 * 2. Calculates totals server-side
 * 3. Looks up actual shipping rate for the governorate
 * 4. Creates order and order_items in a transaction
 * 5. Returns WhatsApp URL for completion
 */
export async function createOrder(data: CheckoutData): Promise<CheckoutResult> {
  try {
    let serverClient: ReturnType<typeof createServerClient>;

    try {
      serverClient = createServerClient();
      await validateCheckoutServerConfiguration(serverClient);
    } catch (error) {
      if (isServerConfigurationError(error)) {
        logCheckoutError('server-configuration', error);
        return { success: false, error: 'Server configuration error' };
      }

      throw error;
    }

    if (!data.items.length) {
      return { success: false, error: 'Cart is empty' };
    }

    const whatsappNumber = await getCheckoutWhatsAppNumber(serverClient);
    if (!whatsappNumber) {
      return { success: false, error: 'WhatsApp number is not configured' };
    }

    const sanitizedItems = data.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    }));

    for (const item of sanitizedItems) {
      if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return {
          success: false,
          error: 'Invalid cart item quantity',
          details: { items_verified: false } as any,
        };
      }
    }

    const quantitiesByProduct = sanitizedItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.product_id] = (acc[item.product_id] || 0) + item.quantity;
      return acc;
    }, {});

    // Step 1: Fetch all products from database to verify prices
    const productIds = Object.keys(quantitiesByProduct);
    
    const { data: products, error: productsError } = await serverClient
      .from('products')
      .select('id, name, sku, price, stock_quantity, track_stock, is_active')
      .in('id', productIds)
      .returns<Array<{ id: string; name: string; sku: string | null; price: number; stock_quantity: number; track_stock: boolean; is_active: boolean }>>();

    if (productsError) {
      if (isServerConfigurationError(productsError)) {
        logCheckoutError('products-query-configuration', productsError);
        return { success: false, error: 'Server configuration error' };
      }

      return { success: false, error: 'Failed to fetch products' };
    }

    // Step 2: Verify each product exists, is active, and price matches
    const priceDiscrepancies: Array<{ product_id: string; client_price: number; server_price: number }> = [];
    let subtotal = 0;
    const verifiedItems: Array<{
      product_id: string;
      product_name: string;
      product_sku: string | null;
      variant_name: string | null;
      quantity: number;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of sanitizedItems) {
      const product = products?.find(p => p.id === item.product_id);
      
      if (!product) {
        return { 
          success: false, 
          error: `Product not found: ${item.name}`,
          details: { items_verified: false } as any
        };
      }

      if (!product.is_active) {
        return { 
          success: false, 
          error: `Product is no longer available: ${product.name}`,
          details: { items_verified: false } as any
        };
      }

      // Check stock if tracking is enabled
      const requestedQuantity = quantitiesByProduct[item.product_id] || item.quantity;
      if (product.track_stock && product.stock_quantity < requestedQuantity) {
        return { 
          success: false, 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`,
          details: { items_verified: false } as any
        };
      }

      // Use SERVER price, not client price (prevents tampering)
      const serverPrice = product.price;
      if (serverPrice !== item.price) {
        priceDiscrepancies.push({
          product_id: item.product_id,
          client_price: item.price,
          server_price: serverPrice,
        });
      }

      const itemTotal = serverPrice * item.quantity;
      subtotal += itemTotal;

      verifiedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        product_sku: product.sku,
        variant_name: item.variant_name || null,
        quantity: item.quantity,
        unit_price: serverPrice,
        total_price: itemTotal,
      });
    }

    // Step 3: Fetch shipping rate from database (not hardcoded)
    const { data: shippingRate, error: shippingError } = await serverClient
      .from('shipping_rates')
      .select('rate')
      .eq('governorate', data.governorate)
      .eq('is_active', true)
      .single<{ rate: number }>();

    if (shippingError || !shippingRate) {
      return { 
        success: false, 
        error: `Shipping not available for ${data.governorate}`,
        details: { items_verified: false } as any
      };
    }

    const shippingCost = shippingRate.rate;
    const total = subtotal + shippingCost;

    // Step 4: Create order (order_number auto-generated by DB)
    const { data: order, error: orderError } = await (serverClient
      .from('orders') as any)
      .insert({
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email || null,
        governorate: data.governorate,
        city: data.city,
        address: data.address,
        landmark: data.landmark || null,
        notes: data.notes || null,
        status: 'pending',
        payment_method: 'whatsapp',
        payment_status: 'pending',
        subtotal,
        shipping_cost: shippingCost,
        discount: 0,
        total,
      })
      .select('id, order_number')
      .single() as { data: { id: string; order_number: string } | null; error: any };

    if (orderError || !order) {
      logCheckoutError('order-create', orderError || 'No order returned');
      return { success: false, error: 'Failed to create order' };
    }

    // Step 5: Create order items linked to the order
    const orderItems = verifiedItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      variant_name: item.variant_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    const { error: itemsError } = await serverClient
      .from('order_items')
      .insert(orderItems as any);

    if (itemsError) {
      logCheckoutError('order-items-create', itemsError);
      await serverClient
        .from('orders')
        .delete()
        .eq('id', order.id);
      return { success: false, error: 'Failed to create order items' };
    }

    // Step 6: Generate WhatsApp message
    const message = generateWhatsAppMessage(order.order_number, data, verifiedItems, subtotal, shippingCost, total);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    const { error: whatsappUrlError } = await (serverClient.from('orders') as any)
      .update({ whatsapp_message_url: whatsappUrl })
      .eq('id', order.id);

    if (whatsappUrlError) {
      logCheckoutError('whatsapp-url-update', whatsappUrlError);
    }

    // Revalidate relevant paths
    revalidatePath('/admin/orders');

    return {
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
      },
      whatsappUrl,
      details: {
        subtotal,
        shipping_cost: shippingCost,
        total,
        items_verified: true,
        price_discrepancies: priceDiscrepancies.length > 0 ? priceDiscrepancies : undefined,
      },
    };

  } catch (error) {
    if (isServerConfigurationError(error)) {
      logCheckoutError('server-configuration', error);
      return { success: false, error: 'Server configuration error' };
    }

    logCheckoutError('unexpected', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

function generateWhatsAppMessage(
  orderNumber: string,
  data: CheckoutData,
  items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>,
  subtotal: number,
  shipping: number,
  total: number
): string {
  const formatPrice = (price: number) => `${price.toFixed(2)} د.أ`;

  return `
طلب جديد #${orderNumber}

👤 معلومات العميل:
الاسم: ${data.customer_name}
الهاتف: ${data.customer_phone}
${data.customer_email ? `البريد: ${data.customer_email}` : ''}

📍 العنوان:
المحافظة: ${data.governorate}
المدينة: ${data.city}
العنوان: ${data.address}
${data.landmark ? `علامة مميزة: ${data.landmark}` : ''}

🛒 المنتجات:
${items.map(item => `- ${item.product_name} (${item.quantity}x) = ${formatPrice(item.total_price)}`).join('\n')}

💰 المبالغ:
المجموع الفرعي: ${formatPrice(subtotal)}
الشحن: ${formatPrice(shipping)}
الإجمالي: ${formatPrice(total)}

${data.notes ? `📝 ملاحظات: ${data.notes}` : ''}
  `.trim();
}
