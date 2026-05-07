# مؤسسة البرج - Al-Burj E-commerce

A production-ready ecommerce catalog website for "مؤسسة البرج" in Jordan. Built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

## Features

### Customer Storefront
- **Home Page**: Hero banners, categories, featured products, trust sections
- **Categories & Subcategories**: Hierarchical product organization
- **Product Listing**: Search, filters, sorting, pagination
- **Product Details**: Images, variants, pricing, stock status
- **Shopping Cart**: Add/remove items, update quantities
- **WhatsApp Checkout**: Customer info form with governorate-based shipping
- **Arabic RTL**: Full Arabic support with right-to-left layout
- **Mobile-First**: Responsive design optimized for mobile

### Admin Dashboard
- **Secure Login**: Supabase Auth with role-based access
- **Product Management**: Create, update, delete, activate/deactivate
- **Category Management**: Categories and subcategories
- **Order Management**: View and update order status
- **Shipping Rates**: Manage rates by Jordan governorate
- **Banner Management**: Home page banners
- **Analytics**: Product count, orders, latest orders

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **State**: Zustand (cart)
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## Project Structure

```
burj/
├── app/                    # Next.js app router
│   ├── (admin)/           # Admin routes group
│   ├── (store)/           # Store routes group
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── ui/                # shadcn/ui components
│   └── theme-provider.tsx # Theme provider
├── features/
│   ├── admin/             # Admin feature
│   │   ├── components/
│   │   └── ...
│   └── store/             # Store feature
│       ├── components/
│       └── ...
├── hooks/                   # Custom React hooks
├── lib/                     # Utilities
│   ├── supabase.ts        # Supabase client
│   └── utils.ts           # Helper functions
├── stores/                  # Zustand stores
│   └── cart.ts            # Cart store
├── types/                   # TypeScript types
│   ├── index.ts           # Main types
│   └── supabase.ts        # Supabase types
├── supabase/
│   └── migrations/        # Database migrations
├── public/                  # Static assets
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/alburj-ecommerce.git
cd alburj-ecommerce
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Configure Supabase:
- Create a new project at https://supabase.com
- Run the migrations in `supabase/migrations/`
- Create storage buckets: `products`, `banners`, `categories`
- Set up an admin user in the profiles table

5. Update `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not commit `.env.local` or any real secrets. The file is intentionally listed in `.gitignore`.

Configure the checkout WhatsApp number from `/admin/settings` after deployment.

6. Run the development server:
```bash
npm run dev
```

7. Open http://localhost:3000

## Database Schema

### Tables
- **profiles**: User profiles with role-based access
- **categories**: Product categories
- **subcategories**: Category subcategories
- **products**: Product information
- **product_images**: Product images
- **product_variants**: Product options/variants
- **shipping_rates**: Governorate shipping rates
- **orders**: Customer orders
- **order_items**: Order line items
- **banners**: Homepage banners
- **store_settings**: Store configuration

### Security
- Row Level Security (RLS) enabled on all tables
- Public read access to active products/categories
- Admin-only write access to management data
- Storage policies for public reads and admin writes

## Business Model

- **No online payment**: Checkout via WhatsApp
- **Cash on delivery**: Payment on delivery
- **WhatsApp integration**: Auto-generated order messages
- **Jordan-focused**: Governorate-based shipping

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import to Vercel
3. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (optional)
4. Deploy

Never add `.env.local` to GitHub. Add production secrets only in the Vercel project Environment Variables UI.

### Manual Deployment
```bash
npm run build
npm start
```

## Future Enhancements

- Online payment integration (Stripe, PayPal)
- Coupon/discount system
- Inventory tracking
- Meta Pixel integration
- Multi-language support
- Product reviews
- Wishlist functionality

## License

MIT License - see LICENSE file for details

## Contact

مؤسسة البرج - Al-Burj Foundation
- WhatsApp: +962 79 0663 777
- Email: info@alburj.jo
