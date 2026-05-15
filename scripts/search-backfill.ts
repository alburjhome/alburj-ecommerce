#!/usr/bin/env ts-node
/**
 * CLI backfill for product search fields (service role).
 * Usage: npm run search:backfill
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  buildProductSearchFields,
  type ProductSearchFieldsInput,
} from '../lib/product-search-fields';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BATCH_SIZE = 50;

type Row = ProductSearchFieldsInput & { id: string };

async function main() {
  console.log('Search backfill starting...\n');

  let offset = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        id,
        product_type,
        name,
        short_description,
        description,
        marketing_tagline,
        sku,
        brand,
        tags,
        key_features,
        search_keywords,
        category:categories(name),
        subcategory:subcategories(name),
        variants:product_variants(name, sku, is_active)
      `
      )
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Fetch failed:', error.message);
      process.exit(1);
    }

    const rows = (data || []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const { id, ...product } = row;
      const fields = buildProductSearchFields(product);
      const { error: updateError } = await supabase
        .from('products')
        .update({
          search_keywords: fields.search_keywords,
          normalized_search_text: fields.normalized_search_text,
        })
        .eq('id', id);

      if (updateError) {
        failed += 1;
        console.error(`Failed ${id}:`, updateError.message);
      } else {
        updated += 1;
      }
    }

    console.log(`Processed batch at offset ${offset} (${rows.length} products)`);
    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
