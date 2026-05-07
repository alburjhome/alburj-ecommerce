export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'admin' | 'customer';
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'admin' | 'customer';
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'admin' | 'customer';
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      subcategories: {
        Row: {
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
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
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
          weight: number | null;
          dimensions: Json | null;
          is_active: boolean;
          is_featured: boolean;
          view_count: number;
          sales_count: number;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          short_description?: string | null;
          price: number;
          compare_price?: number | null;
          cost_price?: number | null;
          sku?: string | null;
          barcode?: string | null;
          stock_quantity?: number;
          track_stock?: boolean;
          allow_backorders?: boolean;
          category_id?: string | null;
          subcategory_id?: string | null;
          brand?: string | null;
          tags?: string[] | null;
          weight?: number | null;
          dimensions?: Json | null;
          is_active?: boolean;
          is_featured?: boolean;
          view_count?: number;
          sales_count?: number;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          short_description?: string | null;
          price?: number;
          compare_price?: number | null;
          cost_price?: number | null;
          sku?: string | null;
          barcode?: string | null;
          stock_quantity?: number;
          track_stock?: boolean;
          allow_backorders?: boolean;
          category_id?: string | null;
          subcategory_id?: string | null;
          brand?: string | null;
          tags?: string[] | null;
          weight?: number | null;
          dimensions?: Json | null;
          is_active?: boolean;
          is_featured?: boolean;
          view_count?: number;
          sales_count?: number;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          sku: string | null;
          price_adjustment: number;
          stock_quantity: number;
          options: Json | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          sku?: string | null;
          price_adjustment?: number;
          stock_quantity?: number;
          options?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          sku?: string | null;
          price_adjustment?: number;
          stock_quantity?: number;
          options?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      shipping_rates: {
        Row: {
          id: string;
          governorate: string;
          governorate_en: string;
          rate: number;
          free_shipping_threshold: number | null;
          is_active: boolean;
          estimated_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          governorate: string;
          governorate_en: string;
          rate: number;
          free_shipping_threshold?: number | null;
          is_active?: boolean;
          estimated_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          governorate?: string;
          governorate_en?: string;
          rate?: number;
          free_shipping_threshold?: number | null;
          is_active?: boolean;
          estimated_days?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
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
          status: string;
          payment_method: string;
          payment_status: string;
          subtotal: number;
          shipping_cost: number;
          discount: number;
          total: number;
          whatsapp_message_sent: boolean;
          whatsapp_message_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;  // Auto-generated by generate_order_number()
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          governorate: string;
          city: string;
          address: string;
          landmark?: string | null;
          notes?: string | null;
          status?: string;
          payment_method?: string;
          payment_status?: string;
          subtotal: number;
          shipping_cost: number;
          discount?: number;
          total: number;
          whatsapp_message_sent?: boolean;
          whatsapp_message_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_name?: string;
          customer_phone?: string;
          customer_email?: string | null;
          governorate?: string;
          city?: string;
          address?: string;
          landmark?: string | null;
          notes?: string | null;
          status?: string;
          payment_method?: string;
          payment_status?: string;
          subtotal?: number;
          shipping_cost?: number;
          discount?: number;
          total?: number;
          whatsapp_message_sent?: boolean;
          whatsapp_message_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
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
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          product_sku?: string | null;
          variant_name?: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_sku?: string | null;
          variant_name?: string | null;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          created_at?: string;
        };
      };
      banners: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          image_url: string;
          link_url: string | null;
          position: string;
          is_active: boolean;
          sort_order: number;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string | null;
          image_url: string;
          link_url?: string | null;
          position?: string;
          is_active?: boolean;
          sort_order?: number;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string | null;
          image_url?: string;
          link_url?: string | null;
          position?: string;
          is_active?: boolean;
          sort_order?: number;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      store_settings: {
        Row: {
          id: string;
          store_name: string;
          store_description: string | null;
          whatsapp_number: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          currency: string;
          currency_symbol: string;
          tax_rate: number;
          free_shipping_threshold: number | null;
          min_order_amount: number | null;
          maintenance_mode: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_name?: string;
          store_description?: string | null;
          whatsapp_number?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          currency?: string;
          currency_symbol?: string;
          tax_rate?: number;
          free_shipping_threshold?: number | null;
          min_order_amount?: number | null;
          maintenance_mode?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_name?: string;
          store_description?: string | null;
          whatsapp_number?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          currency?: string;
          currency_symbol?: string;
          tax_rate?: number;
          free_shipping_threshold?: number | null;
          min_order_amount?: number | null;
          maintenance_mode?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
