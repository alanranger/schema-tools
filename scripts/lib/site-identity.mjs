/**
 * One client identity for every Node request our tools make to www.alanranger.com.
 * Squarespace rate-limits a non-browser client that claims to be Chrome far more strictly than an honest bot
 * (BAU batch 8: the fake-Chrome pre-flight got 429 after 3 min while this identity got 200 either side of it).
 */
export const SITE_UA = 'Mozilla/5.0 (compatible; AlanCsvBuilders/1.0)';

/** Retry-After (seconds or an HTTP date) in ms, or null. */
export function retryAfterMs(headers, now = Date.now()) {
  const v = headers?.get?.('retry-after');
  if (!v) return null;
  if (/^\d+$/.test(v.trim())) return Number(v) * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}
