// RSS passthrough for the news ticker (feeds send no CORS headers). Allow-listed sources only.
import { send, query, fetchWithTimeout } from './_util.js';
const SRC = { bbc: 'https://feeds.bbci.co.uk/turkce/rss.xml', trt: 'https://www.trthaber.com/manset_articles.rss' };
export default async function handler(req, res) {
  const url = SRC[query(req).get('src')];
  if (!url) return send(res, 400, { error: 'unknown src' });
  try {
    const r = await fetchWithTimeout(url, 10000);
    if (!r.ok) throw new Error('RSS HTTP ' + r.status);
    send(res, 200, await r.text(), { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=900' });
  } catch (e) { send(res, 502, { error: e.message }); }
}
