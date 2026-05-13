'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { buildWhatsAppOrderMessage } from '@/lib/whatsapp-order-message';

export interface CheckoutItem {
  item_type?: 'product' | 'bundle';
  product_id: string;
  variant_id?: string | null;
  name: string;
  quantity: number;
  price: number;
  variant_name?: string | null;
  selected_options?: Record<string, string> | null;
  sku?: string | null;
  bundle_items?: BundleSnapshotItem[] | null;
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

type ServerClient = ReturnType<typeof createServerClient>;

interface ProductRow {
  id: string;
  product_type: 'single' | 'bundle';
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  track_stock: boolean;
  allow_backorders: boolean;
  is_active: boolean;
}

interface BundleSnapshotItem {
  product_id: string;
  product_name: string;
  product_slug: string | null;
  variant_id: string | null;
  variant_name: string | null;
  variant_options: Record<string, string> | null;
  quantity: number;
  unit_price: number | null;
  image_url: string | null;
}

interface BundleItemRow {
  id: string;
  bundle_product_id: string;
  item_product_id: string;
  item_variant_id: string | null;
  quantity: number;
  sort_order: number;
  item_product?: ProductRow & {
    images?: Array<{ url: string; is_primary: boolean; sort_order: number }>;
  };
  item_variant?: VariantRow | null;
}

interface VariantValueRow {
  option?: { name: string | null } | null;
  option_value?: { value: string | null } | null;
}

interface VariantRow {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  options: Record<string, string> | null;
  values?: VariantValueRow[] | null;
}

interface VerifiedOrderItem {
  item_type: 'product' | 'bundle';
  product_id: string;
  product_name: string;
  product_slug: string | null;
  product_sku: string | null;
  variant_id: string | null;
  variant_name: string | null;
  variant_options: Record<string, string> | null;
  variant_sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  bundle_items_snapshot: BundleSnapshotItem[] | null;
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

async function validateCheckoutServerConfiguration(serverClient: ServerClient) {
  const { error } = await serverClient.from('shipping_rates').select('id').limit(1);

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

async function getCheckoutWhatsAppNumber(serverClient: ServerClient) {
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

function getVariantOptions(variant: VariantRow) {
  const values = Array.isArray(variant.values) ? variant.values : [];
  const structuredOptions = values.reduce<Record<string, string>>((acc, value) => {
    const name = value.option?.name;
    const optionValue = value.option_value?.value;
    if (name && optionValue) {
      acc[name] = optionValue;
    }
    return acc;
  }, {});

  if (Object.keys(structuredOptions).length > 0) {
    return structuredOptions;
  }

  return variant.options || null;
}

function getVariantName(variant: VariantRow) {
  const options = getVariantOptions(variant);
  if (!options || Object.keys(options).length === 0) return variant.name;
  return Object.entries(options)
    .map(([name, value]) => `${name}: ${value}`)
    .join('، ');
}

function quantityKey(item: CheckoutItem) {
  return `${item.item_type || 'product'}:${item.product_id}:${item.variant_id || 'default'}`;
}

function getAppBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://alburj-ecommerce.vercel.app';

  return configuredUrl.replace(/\/$/, '');
}

export async function createOrder(data: CheckoutData): Promise<CheckoutResult> {
  try {
    let serverClient: ServerClient;

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

    const sanitizedItems: CheckoutItem[] = data.items.map((item) => ({
      ...item,
      item_type: item.item_type === 'bundle' ? 'bundle' : 'product',
      variant_id: item.variant_id || null,
      quantity: Number(item.quantity),
      price: Number(item.price),
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

    const productIds = Array.from(new Set(sanitizedItems.map((item) => item.product_id)));
    const quantitiesByKey = sanitizedItems.reduce<Record<string, number>>((acc, item) => {
      const key = quantityKey(item);
      acc[key] = (acc[key] || 0) + item.quantity;
      return acc;
    }, {});

    let { data: products, error: productsError } = await serverClient
      .from('products')
      .select('id, product_type, name, slug, sku, price, stock_quantity, track_stock, allow_backorders, is_active')
      .in('id', productIds)
      .returns<ProductRow[]>();

    if (productsError) {
      const productErrorMessage = String(productsError.message || productsError);
      if (
        productErrorMessage.includes('product_type') ||
        productErrorMessage.includes('schema cache') ||
        productErrorMessage.includes('column')
      ) {
        logCheckoutError('products-query-fallback', productsError);
        const fallbackResult = await serverClient
          .from('products')
          .select('id, name, slug, sku, price, stock_quantity, track_stock, allow_backorders, is_active')
          .in('id', productIds);

        if (fallbackResult.error) {
          return { success: false, error: 'Failed to fetch products' };
        }

        products = ((fallbackResult.data || []) as Omit<ProductRow, 'product_type'>[]).map((product) => ({
          ...product,
          product_type: 'single' as const,
        }));
        productsError = null;
      }
    }

    if (productsError) {
      if (isServerConfigurationError(productsError)) {
        logCheckoutError('products-query-configuration', productsError);
        return { success: false, error: 'Server configuration error' };
      }

      return { success: false, error: 'Failed to fetch products' };
    }

    const { data: variantsData, error: variantsError } = await (serverClient.from('product_variants') as any)
      .select(`
        id,
        product_id,
        name,
        sku,
        price,
        stock_quantity,
        track_stock,
        is_active,
        options,
        values:product_variant_values(
          option:product_options(name),
          option_value:product_option_values(value)
        )
      `)
      .in('product_id', productIds);

    let variants = (variantsData || []) as VariantRow[];
    if (variantsError) {
      const variantErrorMessage = String(variantsError.message || variantsError);
      if (
        variantErrorMessage.includes('price') ||
        variantErrorMessage.includes('schema cache') ||
        variantErrorMessage.includes('column')
      ) {
        logCheckoutError('variants-query-fallback', variantsError);
        variants = [];
      } else {
        logCheckoutError('variants-query', variantsError);
        return { success: false, error: 'Failed to verify product variants' };
      }
    }

    const activeVariantsByProduct = variants.reduce<Record<string, VariantRow[]>>((acc, variant) => {
      if (!variant.is_active) return acc;
      acc[variant.product_id] = acc[variant.product_id] || [];
      acc[variant.product_id].push(variant);
      return acc;
    }, {});

    const bundleProductIds = products
      ?.filter((product) => (product.product_type || 'single') === 'bundle')
      .map((product) => product.id) || [];

    let bundleItems: BundleItemRow[] = [];
    if (bundleProductIds.length > 0) {
      const { data: bundleItemsData, error: bundleItemsError } = await (serverClient.from('bundle_items') as any)
        .select(`
          id,
          bundle_product_id,
          item_product_id,
          item_variant_id,
          quantity,
          sort_order,
          item_product:products!bundle_items_item_product_id_fkey(
            id,
            product_type,
            name,
            slug,
            sku,
            price,
            stock_quantity,
            track_stock,
            allow_backorders,
            is_active,
            images:product_images(url, is_primary, sort_order)
          ),
          item_variant:product_variants!bundle_items_item_variant_id_fkey(
            id,
            product_id,
            name,
            sku,
            price,
            stock_quantity,
            track_stock,
            is_active,
            options,
            values:product_variant_values(
              option:product_options(name),
              option_value:product_option_values(value)
            )
          )
        `)
        .in('bundle_product_id', bundleProductIds)
        .order('sort_order', { ascending: true });

      if (bundleItemsError) {
        logCheckoutError('bundle-items-query', bundleItemsError);
        return { success: false, error: 'Failed to verify bundle items' };
      }

      bundleItems = (bundleItemsData || []) as BundleItemRow[];
    }

    const bundleItemsByProduct = bundleItems.reduce<Record<string, BundleItemRow[]>>((acc, item) => {
      acc[item.bundle_product_id] = acc[item.bundle_product_id] || [];
      acc[item.bundle_product_id].push(item);
      return acc;
    }, {});

    const priceDiscrepancies: Array<{ product_id: string; client_price: number; server_price: number }> = [];
    let subtotal = 0;
    const verifiedItems: VerifiedOrderItem[] = [];

    for (const item of sanitizedItems) {
      const product = products?.find((candidate) => candidate.id === item.product_id);

      if (!product) {
        return {
          success: false,
          error: `Product not found: ${item.name}`,
          details: { items_verified: false } as any,
        };
      }

      if (!product.is_active) {
        return {
          success: false,
          error: `Product is no longer available: ${product.name}`,
          details: { items_verified: false } as any,
        };
      }

      const isBundle = (product.product_type || 'single') === 'bundle';

      if (isBundle) {
        const currentBundleItems = bundleItemsByProduct[item.product_id] || [];
        if (currentBundleItems.length === 0) {
          return {
            success: false,
            error: `Bundle is not configured: ${product.name}`,
            details: { items_verified: false } as any,
          };
        }

        const requestedBundleQuantity = quantitiesByKey[quantityKey(item)] || item.quantity;
        const snapshot: BundleSnapshotItem[] = [];

        for (const bundleItem of currentBundleItems) {
          const component = bundleItem.item_product;
          if (!component || !component.is_active) {
            return {
              success: false,
              error: `Bundle item is no longer available: ${product.name}`,
              details: { items_verified: false } as any,
            };
          }

          const componentQuantity = bundleItem.quantity * requestedBundleQuantity;
          const componentVariant = bundleItem.item_variant || null;

          if (componentVariant) {
            if (!componentVariant.is_active || componentVariant.product_id !== component.id) {
              return {
                success: false,
                error: `Bundle variant is no longer available: ${component.name}`,
                details: { items_verified: false } as any,
              };
            }

            if (componentVariant.track_stock && componentVariant.stock_quantity < componentQuantity) {
              return {
                success: false,
                error: `Insufficient stock for bundle item ${component.name}. Available: ${componentVariant.stock_quantity}`,
                details: { items_verified: false } as any,
              };
            }
          } else if (component.track_stock && !component.allow_backorders && component.stock_quantity < componentQuantity) {
            return {
              success: false,
              error: `Insufficient stock for bundle item ${component.name}. Available: ${component.stock_quantity}`,
              details: { items_verified: false } as any,
            };
          }

          const sortedImages = [...(component.images || [])].sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.sort_order - b.sort_order;
          });

          snapshot.push({
            product_id: component.id,
            product_name: component.name,
            product_slug: component.slug,
            variant_id: componentVariant?.id || null,
            variant_name: componentVariant ? getVariantName(componentVariant) : null,
            variant_options: componentVariant ? getVariantOptions(componentVariant) : null,
            quantity: bundleItem.quantity,
            unit_price: componentVariant ? Number(componentVariant.price) : Number(component.price),
            image_url: sortedImages[0]?.url || null,
          });
        }
        // TODO: deduct stock for regular products and bundles in one unified inventory pass if stock deduction is introduced.

        const serverPrice = Number(product.price);
        if (Math.abs(serverPrice - item.price) > 0.001) {
          priceDiscrepancies.push({
            product_id: item.product_id,
            client_price: item.price,
            server_price: serverPrice,
          });
        }

        const itemTotal = serverPrice * item.quantity;
        subtotal += itemTotal;

        verifiedItems.push({
          item_type: 'bundle',
          product_id: item.product_id,
          product_name: product.name,
          product_slug: product.slug,
          product_sku: product.sku,
          variant_id: null,
          variant_name: null,
          variant_options: null,
          variant_sku: null,
          quantity: item.quantity,
          unit_price: serverPrice,
          total_price: itemTotal,
          bundle_items_snapshot: snapshot,
        });

        continue;
      }

      const productVariants = activeVariantsByProduct[item.product_id] || [];
      const productRequiresVariant = productVariants.length > 0;

      if (productRequiresVariant && !item.variant_id) {
        return {
          success: false,
          error: `Please choose product options for ${product.name}`,
          details: { items_verified: false } as any,
        };
      }

      const selectedVariant = item.variant_id
        ? productVariants.find((variant) => variant.id === item.variant_id)
        : null;

      if (item.variant_id && !selectedVariant) {
        return {
          success: false,
          error: `Selected variant is no longer available: ${product.name}`,
          details: { items_verified: false } as any,
        };
      }

      const requestedQuantity = quantitiesByKey[quantityKey(item)] || item.quantity;
      if (selectedVariant) {
        if (selectedVariant.track_stock && selectedVariant.stock_quantity < requestedQuantity) {
          return {
            success: false,
            error: `Insufficient stock for ${product.name}. Available: ${selectedVariant.stock_quantity}`,
            details: { items_verified: false } as any,
          };
        }
      } else if (product.track_stock && !product.allow_backorders && product.stock_quantity < requestedQuantity) {
        return {
          success: false,
          error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`,
          details: { items_verified: false } as any,
        };
      }

      const serverPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
      if (Math.abs(serverPrice - item.price) > 0.001) {
        priceDiscrepancies.push({
          product_id: item.product_id,
          client_price: item.price,
          server_price: serverPrice,
        });
      }

      const itemTotal = serverPrice * item.quantity;
      subtotal += itemTotal;

      verifiedItems.push({
        item_type: 'product',
        product_id: item.product_id,
        product_name: product.name,
        product_slug: product.slug,
        product_sku: product.sku,
        variant_id: selectedVariant?.id || null,
        variant_name: selectedVariant ? getVariantName(selectedVariant) : null,
        variant_options: selectedVariant ? getVariantOptions(selectedVariant) : null,
        variant_sku: selectedVariant?.sku || null,
        quantity: item.quantity,
        unit_price: serverPrice,
        total_price: itemTotal,
        bundle_items_snapshot: null,
      });
    }

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
        details: { items_verified: false } as any,
      };
    }

    const shippingCost = shippingRate.rate;
    const total = subtotal + shippingCost;

    const { data: order, error: orderError } = await (serverClient.from('orders') as any)
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

    const orderItems = verifiedItems.map((item) => {
      return {
        order_id: order.id,
        item_type: item.item_type,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        variant_options: item.variant_options,
        variant_sku: item.variant_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        bundle_items_snapshot: item.bundle_items_snapshot,
      };
    });

    let { error: itemsError } = await serverClient.from('order_items').insert(orderItems as any);

    if (itemsError) {
      const itemErrorMessage = String(itemsError.message || itemsError);
      const hasBundleItems = verifiedItems.some((item) => item.item_type === 'bundle');
      const missingBundleColumns =
        itemErrorMessage.includes('item_type') ||
        itemErrorMessage.includes('bundle_items_snapshot') ||
        itemErrorMessage.includes('schema cache') ||
        itemErrorMessage.includes('column');

      if (!hasBundleItems && missingBundleColumns) {
        logCheckoutError('order-items-create-fallback', itemsError);
        const legacyOrderItems = verifiedItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          variant_id: item.variant_id,
          variant_name: item.variant_name,
          variant_options: item.variant_options,
          variant_sku: item.variant_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

        const fallbackResult = await serverClient.from('order_items').insert(legacyOrderItems as any);
        itemsError = fallbackResult.error;
      }
    }

    if (itemsError) {
      logCheckoutError('order-items-create', itemsError);
      await serverClient.from('orders').delete().eq('id', order.id);
      return { success: false, error: 'Failed to create order items' };
    }

    const message = buildWhatsAppOrderMessage({
      orderNumber: order.order_number,
      customer: data,
      items: verifiedItems,
      subtotal,
      shipping: shippingCost,
      total,
      baseUrl: getAppBaseUrl(),
    });
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    const { error: whatsappUrlError } = await (serverClient.from('orders') as any)
      .update({ whatsapp_message_url: whatsappUrl })
      .eq('id', order.id);

    if (whatsappUrlError) {
      logCheckoutError('whatsapp-url-update', whatsappUrlError);
    }

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
