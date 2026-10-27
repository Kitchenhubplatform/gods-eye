// Refreshes the bundled static datasets in public/data (run: node scripts/fetch-static-data.mjs).
// Sources (all public): Caltrans CWWP2 CCTV, City of Austin Traffic Cameras (data.austintexas.gov),
// TeleGeography Submarine Cable Map (CC BY-NC-SA 3.0), PeeringDB facilities.
import { writeFileSync } from 'node:fs';
const out = (f, d) => { writeFileSync(new URL(`../public/data/${f}`, import.meta.url), JSON.stringify(d)); console.log(f, Array.isArray(d) ? d.length : d.features?.length); };
const j = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'gods-eye-static-data/1.0' } }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };
const r5 = (x) => Math.round(+x * 1e5) / 1e5;

// --- public traffic cameras: [lat, lon, name, snapshotUrl, source, streamUrl?]
const cams = [];
for (let d = 1; d <= 12; d++) {
  const dd = String(d).padStart(2, '0');
  try {
    const data = (await j(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${dd}.json`)).data;
    for (const { cctv: c } of data) {
      if (c.inService !== 'true') continue;
      const img = c.imageData?.static?.currentImageURL; if (!img) continue;
      const lat = +c.location.latitude, lon = +c.location.longitude; if (!lat || !lon) continue;
      cams.push([r5(lat), r5(lon), c.location.locationName.trim(), img, 'Caltrans', c.imageData.streamingVideoURL || '']);
    }
  } catch (e) { console.warn('caltrans', d, e.message); }
}
try {
  const a = await j('https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=2000&camera_status=TURNED_ON');
  for (const c of a) if (c.location?.coordinates && c.screenshot_address)
    cams.push([r5(c.location.coordinates[1]), r5(c.location.coordinates[0]), (c.location_name || '').trim(), c.screenshot_address, 'City of Austin', '']);
} catch (e) { console.warn('austin', e.message); }
out('cctv.json', cams);

// --- submarine cables (TeleGeography) — simplify coordinates to 3 decimals
const cg = await j('https://www.submarinecablemap.com/api/v3/cable/cable-geo.json');
for (const f of cg.features) {
  f.properties = { name: f.properties.name, color: f.properties.color, id: f.properties.id };
  const g = f.geometry; const s = (l) => l.map((p) => [Math.round(p[0] * 1e3) / 1e3, Math.round(p[1] * 1e3) / 1e3]);
  g.coordinates = g.type === 'LineString' ? s(g.coordinates) : g.coordinates.map(s);
}
out('cables.geojson', cg);
try {
  const lp = await j('https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json');
  out('landing-points.json', lp.features.map((f) => [r5(f.geometry.coordinates[1]), r5(f.geometry.coordinates[0]), f.properties.name]));
} catch (e) { console.warn('landing', e.message); }

// --- datacenters / colocation facilities (PeeringDB): [lat, lon, name, city, country, org]
const fac = await j('https://www.peeringdb.com/api/fac?status=ok&fields=name,city,country,latitude,longitude,org_name');
out('datacenters.json', fac.data.filter((f) => f.latitude && f.longitude).map((f) => [r5(f.latitude), r5(f.longitude), f.name, f.city, f.country, f.org_name]));
