// Ported from Selçuk's OSIRIS project (src/gods-eye/mgrs.ts).
// Minimal WGS84 lat/lon -> UTM -> MGRS (1 m precision) for the HUD read-out.
const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
const SET_COL = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
const SET_ROW = ['ABCDEFGHJKLMNPQRSTUV', 'FGHJKLMNPQRSTUVABCDE'];

export function toMgrs(lat, lon) {
  if (lat < -80 || lat > 84) return 'KUTUP BÖLGESİ';
  let zone = Math.floor((lon + 180) / 6) + 1;
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2, C = ep2 * Math.cos(φ) ** 2, A = Math.cos(φ) * (λ - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * φ - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * φ)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * φ) - (35 * e2 ** 3 / 3072) * Math.sin(6 * φ));
  const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let Nn = k0 * (M + N * Math.tan(φ) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  if (lat < 0) Nn += 10000000;
  const band = BANDS[Math.min(19, Math.floor((lat + 80) / 8))];
  const set = (zone - 1) % 3;
  const col = SET_COL[set][Math.floor(E / 100000) - 1] ?? '?';
  const row = SET_ROW[(zone - 1) % 2][Math.floor(Nn / 100000) % 20];
  const e5 = String(Math.floor(E % 100000)).padStart(5, '0').slice(0, 4);
  const n5 = String(Math.floor(Nn % 100000)).padStart(5, '0').slice(0, 4);
  return `${zone}${band} ${col}${row} ${e5} ${n5}`;
}

export function toDms(v, pos, neg) {
  const s = v < 0 ? neg : pos; v = Math.abs(v);
  const d = Math.floor(v), m = Math.floor((v - d) * 60), sec = ((v - d) * 60 - m) * 60;
  return `${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}'${sec.toFixed(2).padStart(5, '0')}"${s}`;
}
