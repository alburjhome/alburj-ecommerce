// ============================================
// BASE TYPES
// ============================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'customer';
  phone: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// CATEGORY TYPES
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_adjustment: number;
  stock_quantity: number;
  options: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock_quantity: number;
  track_stock: boolean;
  allow_backorders: boolean;
  category_id: string | null;
  subcategory_id: string | null;
  brand: string | null;
  tags: string[] | null;
  intent_tags: string[] | null;
  weight: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  is_active: boolean;
  is_featured: boolean;
  view_count: number;
  sales_count: number;
  marketing_tagline: string | null;
  key_features: string[] | null;
  product_badges: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithDetails extends Product {
  images: ProductImage[];
  variants: ProductVariant[];
  category: Category | null;
  subcategory: Subcategory | null;
}

// ============================================
// CART TYPES
// ============================================

export interface CartItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant_name?: string | null;
  stock_quantity: number;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  hasHydrated: boolean;
}

// ============================================
// ORDER TYPES
// ============================================

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  governorate: string;
  city: string;
  address: string;
  landmark: string | null;
  notes: string | null;
  status: OrderStatus;
  payment_method: 'cod' | 'whatsapp';
  payment_status: PaymentStatus;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  total: number;
  whatsapp_message_sent: boolean;
  whatsapp_message_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  governorate: string;
  city: string;
  address: string;
  landmark?: string;
  notes?: string;
}

// ============================================
// SHIPPING TYPES
// ============================================

export interface ShippingRate {
  id: string;
  governorate: string;
  governorate_en: string;
  rate: number;
  free_shipping_threshold: number | null;
  is_active: boolean;
  estimated_days: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// BANNER TYPES
// ============================================

export type BannerPosition = 'home_hero' | 'home_middle' | 'home_bottom' | 'category_page';

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  position: BannerPosition;
  is_active: boolean;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// STORE SETTINGS TYPES
// ============================================

export interface StoreSettings {
  id: string;
  store_name: string;
  store_description: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  snapchat_url: string | null;
  youtube_url: string | null;
  meta_pixel_id: string | null;
  ga4_measurement_id: string | null;
  currency: string;
  currency_symbol: string;
  tax_rate: number;
  free_shipping_threshold: number | null;
  min_order_amount: number | null;
  maintenance_mode: boolean;
  ai_provider: 'gemini' | 'openai' | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// FILTER AND SORT TYPES
// ============================================

export interface ProductFilters {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  inStock?: boolean;
  search?: string;
}

export type ProductSortOption = 
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc'
  | 'popular';

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// JORDAN GOVERNORATES
// ============================================

export const JORDAN_GOVERNORATES = [
  { name: 'عمان', nameEn: 'Amman' },
  { name: 'إربد', nameEn: 'Irbid' },
  { name: 'الزرقاء', nameEn: 'Zarqa' },
  { name: 'مأدبا', nameEn: 'Madaba' },
  { name: 'البلقاء', nameEn: 'Balqa' },
  { name: 'جرش', nameEn: 'Jerash' },
  { name: 'عجلون', nameEn: 'Ajloun' },
  { name: 'الكرك', nameEn: 'Karak' },
  { name: 'معان', nameEn: "Ma'an" },
  { name: 'الطفيلة', nameEn: 'Tafilah' },
  { name: 'العقبة', nameEn: 'Aqaba' },
] as const;
