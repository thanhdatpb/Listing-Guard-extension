/**
 * Etsy codes for the `who_made` and `when_made` listing fields.
 *
 * Source: Etsy Open API v3, createDraftListing (https://www.etsy.com/openapi/generated/oas/3.0.0.json),
 * copied on 2026-11-11. The Listing Guard input schema only gives examples (`i_did`, `made_to_order`), so this file is the
 * single place the full lists live.
 *
 * Etsy changes the range codes over time: `2020_2026` is the current range and its end year moves with the calendar, so
 * this list can go stale. The manual form therefore also accepts any other code, and the extension never rejects an unknown
 * one: the API reports it.
 */
export const WHO_MADE_CODES = ['i_did', 'someone_else', 'collective'] as const;

export const WHEN_MADE_CODES = [
  'made_to_order', '2020_2026', '2010_2019', '2007_2009', 'before_2007', '2000_2006',
  '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', '1930s', '1920s', '1910s', '1900s',
  '1800s', '1700s', 'before_1700',
] as const;

export const DEFAULT_WHO_MADE = 'i_did';
export const DEFAULT_WHEN_MADE = 'made_to_order';
