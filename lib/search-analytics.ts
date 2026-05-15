import 'server-only';

import { createServerClient } from '@/lib/supabase-server';
import { normalizeSearchQuery } from '@/lib/search-normalization';

export type SearchAnalyticsSource = 'products_page' | 'header' | 'header_suggestion_click';

export interface LogSearchQueryInput {
  query: string;
  resultsCount: number;
  source: SearchAnalyticsSource;
  clickedProductId?: string | null;
  sessionId?: string | null;
}

export async function logSearchQuery(input: LogSearchQueryInput): Promise<void> {
  const query = input.query.trim().slice(0, 200);
  if (!query) return;

  try {
    const supabase = createServerClient();
    await supabase.from('search_queries').insert({
      query,
      normalized_query: normalizeSearchQuery(query),
      results_count: Math.max(0, Math.trunc(input.resultsCount)),
      source: input.source,
      clicked_product_id: input.clickedProductId || null,
      session_id: input.sessionId?.trim().slice(0, 120) || null,
    } as never);
  } catch {
    // Analytics must never break UX
  }
}
