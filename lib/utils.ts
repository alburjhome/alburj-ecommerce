import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format price with Jordanian Dinar
export function formatPrice(price: number, currency: string = 'د.أ'): string {
  return `${price.toFixed(2)} ${currency}`;
}

// Format phone number for Jordan
export function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If starts with 00, remove it
  if (cleaned.startsWith('00')) {
    return cleaned.slice(2);
  }
  
  // If starts with +, remove it
  if (cleaned.startsWith('+')) {
    return cleaned.slice(1);
  }
  
  return cleaned;
}

// Generate WhatsApp link
export function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatPhoneNumber(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

// Generate order number
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ALB-${timestamp}-${random}`;
}

// Slugify text
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Calculate discount percentage
export function calculateDiscountPercentage(price: number, comparePrice: number): number {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

// Format date for Arabic locale
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('ar-JO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Generate SEO metadata
export function generateMetadata({
  title,
  description,
  image,
  url,
}: {
  title: string;
  description: string;
  image?: string;
  url?: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alburj.jo';
  
  return {
    title: `${title} | مؤسسة البرج`,
    description,
    openGraph: {
      title: `${title} | مؤسسة البرج`,
      description,
      type: 'website',
      url: url || siteUrl,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | مؤسسة البرج`,
      description,
      images: image ? [image] : undefined,
    },
  };
}
