/**
 * fitscroll – Pinterest bridge client
 *
 * Talks to the hosted Python backend (pinterest_scraper_intitial.py serve).
 *
 * ⚠️  The bridge MUST run on a server, not on the phone.
 *     The phone just makes HTTP requests to it.
 */

import { BRIDGE_URL, PINTEREST_FETCH_LIMIT } from './config';

export interface PinterestOutfit {
  imageUrl: string;
  sourceUrl: string;
  captionHint: string;
  products: { id: string; name: string; brand: string; priceLabel: string }[];
}

/**
 * Search Pinterest via the hosted bridge and return raw outfit entries.
 * Set `fresh` to true to wipe old cached results and scrape from scratch.
 */
export async function searchPinterest(
  keywords: string[],
  limit = PINTEREST_FETCH_LIMIT,
  fresh = false,
): Promise<PinterestOutfit[]> {
  const url = `${BRIDGE_URL}/search`;
  console.log(`[pinterest] POST ${url}`, { keywords, limit, fresh });

  try {
    // Fresh scrapes can take 60s+ (pinscrape + image downloads), so use a
    // generous timeout.  Non-fresh requests use the cached manifest and are
    // near-instant.
    const timeoutMs = fresh ? 120_000 : 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, limit, fresh }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[pinterest] Bridge returned ${res.status}:`, body);
      return [];
    }

    const json = await res.json();
    console.log(`[pinterest] Bridge returned ${(json.outfits ?? []).length} outfits`);
    return (json.outfits ?? []) as PinterestOutfit[];
  } catch (e) {
    console.warn('[pinterest] Bridge unreachable:', e);
    return [];
  }
}

/**
 * Health-check the bridge.
 */
export async function pingBridge(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
