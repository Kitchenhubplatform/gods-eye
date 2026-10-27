// Live aircraft proxy. Primary: OpenSky Network /states/all (global, anonymous).
// Fallback: adsb.lol /v2/point (250 nm around the requested point) when OpenSky is unreachable.
// Output rows: [icao24, callsign, country, lon, lat, altMeters, onGround, velMs, trackDeg, vrateMs, squawk, type, reg]
import { send, query, fetchWithTimeout } from './_util.js';

let openskyDownUntil = 0; // per-instance backoff so an unreachable OpenSky doesn't add ~9s to every request
async function fromOpenSky() {
  if (Date.now() < openskyDownUntil) throw new Error('backoff');
  const r = await fetchWithTimeout('https://opensky-network.org/api/states/all', 9000);
  if (!r.ok) throw new Error('OpenSky HTTP ' + r.status);
  const j = await r.json();
  const rows = [];
  for (const s of j.states || []) {
    if (s[5] == null || s[6] == null) continue;
    rows.push([s[0], (s[1] || '').trim(), s[2], +s[5].toFixed(4), +s[6].toFixed(4), Math.round(s[13] ?? s[7] ?? 0), s[8] ? 1 : 0, +(s[9] ?? 0).toFixed(1), Math.round(s[10] ?? 0), +(s[11] ?? 0).toFixed(1), s[14] || '', '', '']);
  }
  return { source: 'opensky', time: j.time, rows };
}

async function fromAdsbLol(lat, lon) {
  const r = await fetchWithTimeout(`https://api.adsb.lol/v2/point/${lat.toFixed(2)}/${lon.toFixed(2)}/250`, 8000);
  if (!r.ok) throw new Error('adsb.lol HTTP ' + r.status);
  const j = await r.json();
  const rows = [];
  for (const a of j.ac || []) {
    if (a.lat == null || a.lon == null) continue;
    const ground = a.alt_baro === 'ground';
    const altFt = ground ? 0 : (a.alt_geom ?? a.alt_baro ?? 0);
    rows.push([a.hex, (a.flight || '').trim(), '', +a.lon.toFixed(4), +a.lat.toFixed(4), Math.round(altFt * 0.3048), ground ? 1 : 0, +((a.gs ?? 0) * 0.514444).toFixed(1), Math.round(a.track ?? a.true_heading ?? 0), +((a.baro_rate ?? 0) * 0.00508).toFixed(1), a.squawk || '', a.t || '', a.r || '']);
  }
  return { source: 'adsb.lol', time: Math.floor((j.now || Date.now()) / 1000), rows };
}

export default async function handler(req, res) {
  const q = query(req);
  const lat = Math.max(-85, Math.min(85, parseFloat(q.get('lat')) || 41));
  const lon = Math.max(-180, Math.min(180, parseFloat(q.get('lon')) || 29));
  const errors = [];
  if (q.get('source') !== 'adsb') {
    try {
      const d = await fromOpenSky();
      return send(res, 200, { ...d, errors }, { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' });
    } catch (e) { if (e.message !== 'backoff') openskyDownUntil = Date.now() + 60000; errors.push('opensky: ' + e.message); }
  }
  try {
    const d = await fromAdsbLol(lat, lon);
    return send(res, 200, { ...d, errors }, { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' });
  } catch (e) { errors.push('adsb.lol: ' + e.message); }
  send(res, 502, { source: null, rows: [], errors });
}
