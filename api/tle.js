// CelesTrak TLE proxy with CDN caching (CelesTrak asks clients not to re-download more than every ~2h).
import { send, query, fetchWithTimeout } from './_util.js';
const GROUPS = new Set(['stations', 'visual', 'active', 'starlink', 'gps-ops', 'weather', 'science', 'geo', 'oneweb', 'military', 'last-30-days']);

export default async function handler(req, res) {
  const group = query(req).get('group') || 'visual';
  if (!GROUPS.has(group)) return send(res, 400, { error: 'unknown group' });
  try {
    const r = await fetchWithTimeout(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, 25000);
    const text = await r.text();
    if (!r.ok || !text.includes('\n1 ')) throw new Error('CelesTrak HTTP ' + r.status + ': ' + text.slice(0, 120));
    send(res, 200, text, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, s-maxage=7200, stale-while-revalidate=86400' });
  } catch (e) {
    send(res, 502, { error: e.message });
  }
}
