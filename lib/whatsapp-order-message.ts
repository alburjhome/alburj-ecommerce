export interface WhatsAppOrderCustomer {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  governorate: string;
  city: string;
  address: string;
  landmark?: string | null;
  notes?: string | null;
}

export interface WhatsAppOrderItem {
  item_type?: 'product' | 'bundle' | null;
  product_name: string;
  product_slug?: string | null;
  variant_options?: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  bundle_items_snapshot?: Array<{
    product_name: string;
    variant_options?: Record<string, string> | null;
    quantity: number;
  }> | null;
}

interface BuildWhatsAppOrderMessageInput {
  orderNumber: string;
  customer: WhatsAppOrderCustomer;
  items: WhatsAppOrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  baseUrl?: string | null;
}

function formatCurrency(price: number) {
  return `${price.toFixed(2)} د.أ`;
}

function formatShipping(price: number) {
  return price > 0 ? formatCurrency(price) : 'يتم تأكيده عند التواصل';
}

function normalizeBaseUrl(baseUrl?: string | null) {
  return baseUrl ? baseUrl.replace(/\/$/, '') : null;
}

function getProductUrl(baseUrl: string | null, slug?: string | null) {
  if (!baseUrl || !slug) return null;
  return `${baseUrl}/product/${slug}`;
}

function formatCustomerLines(customer: WhatsAppOrderCustomer) {
  return [
    'معلومات العميل:',
    `الاسم: ${customer.customer_name}`,
    `الهاتف: ${customer.customer_phone}`,
    customer.customer_email ? `البريد: ${customer.customer_email}` : '',
    `العنوان: ${customer.governorate} - ${customer.city} - ${customer.address}`,
    customer.landmark ? `علامة مميزة: ${customer.landmark}` : '',
    customer.notes ? `ملاحظات العميل: ${customer.notes}` : '',
  ].filter(Boolean);
}

function formatOrderItem(item: WhatsAppOrderItem, index: number, baseUrl: string | null) {
  const isBundle = item.item_type === 'bundle';
  const optionLines =
    item.variant_options && Object.keys(item.variant_options).length > 0
      ? [
          'الخيارات:',
          ...Object.entries(item.variant_options).map(([name, value]) => `- ${name}: ${value}`),
        ]
      : [];
  const productUrl = getProductUrl(baseUrl, item.product_slug);
  const bundleLines =
    isBundle && item.bundle_items_snapshot && item.bundle_items_snapshot.length > 0
      ? [
          '',
          'محتويات الباكج:',
          ...item.bundle_items_snapshot.map((bundleItem) => {
            const options =
              bundleItem.variant_options && Object.keys(bundleItem.variant_options).length > 0
                ? ` (${Object.entries(bundleItem.variant_options)
                    .map(([name, value]) => `${name}: ${value}`)
                    .join('، ')})`
                : '';
            return `- ${bundleItem.product_name}${options} × ${bundleItem.quantity}`;
          }),
        ]
      : [];

  return [
    `${index + 1}. ${item.product_name}`,
    isBundle ? 'النوع: باكج' : '',
    ...optionLines,
    `الكمية: ${item.quantity}`,
    `السعر: ${formatCurrency(item.unit_price)}`,
    `الإجمالي: ${formatCurrency(item.total_price)}`,
    ...bundleLines,
    productUrl ? `رابط المنتج: ${productUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWhatsAppOrderMessage({
  orderNumber,
  customer,
  items,
  subtotal,
  shipping,
  total,
  baseUrl,
}: BuildWhatsAppOrderMessageInput) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const itemLines = items
    .map((item, index) => formatOrderItem(item, index, normalizedBaseUrl))
    .join('\n\n');

  return [
    'طلب جديد من مؤسسة البرج',
    '',
    `رقم الطلب: ${orderNumber}`,
    '',
    ...formatCustomerLines(customer),
    '',
    'المنتجات:',
    '',
    itemLines,
    '',
    'ملخص الطلب:',
    `المجموع الفرعي: ${formatCurrency(subtotal)}`,
    `الشحن: ${formatShipping(shipping)}`,
    `الإجمالي: ${formatCurrency(total)}`,
  ].join('\n').trim();
}
