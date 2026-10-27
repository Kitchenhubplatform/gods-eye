// USGS feed passthrough (USGS already allows CORS; proxied for uniform caching and a fallback path).
import { send, query, fetchWithTimeout } from './_util.js';
const FEEDS = new Set(['all_hour', 'all_day', '2.5_day', '4.5_week', 'all_week', 'significant_month']);
export default async function handler(req, res) {
  const feed = query(req).get('feed') || 'all_day';
  if (!FEEDS.has(feed)) return send(res, 400, { error: 'unknown feed' });
  try {
    const r = await fetchWithTimeout(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`, 10000);
    if (!r.ok) throw new Error('USGS HTTP ' + r.status);
    send(res, 200, await r.text(), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' });
  } catch (e) { send(res, 502, { error: e.message }); }
}
