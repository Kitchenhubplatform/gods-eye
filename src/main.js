import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import { twoline2satrec, propagate, gstime, eciToEcf, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';

// STATIC build (GitHub Pages etc.): no serverless /api — browser talks to CORS-enabled sources directly.
const STATIC = import.meta.env.VITE_STATIC === '1';
const BASE = import.meta.env.BASE_URL || '/';
const CORS_PROXY = 'https://proxy.cors.dev/'; // free, no key; adsb.lol sends no CORS headers
function normAdsbLol(j) {
  const rows = [];
  for (const a of j.ac || []) {
    if (a.lat == null || a.lon == null) continue;
    const ground = a.alt_baro === 'ground';
    const altFt = ground ? 0 : (a.alt_geom ?? a.alt_baro ?? 0);
    rows.push([a.hex, (a.flight || '').trim(), '', a.lon, a.lat, Math.round(altFt * 0.3048), ground ? 1 : 0, (a.gs ?? 0) * 0.514444, a.track ?? a.true_heading ?? 0, (a.baro_rate ?? 0) * 0.00508, a.squawk || '', a.t || '', a.r || '']);
  }
  return { source: 'adsb.lol', time: Math.floor((j.now || Date.now()) / 1000), rows, errors: [] };
}

// ───────────────────────────── helpers ─────────────────────────────
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => Number(n).toLocaleString('tr-TR', { maximumFractionDigits: d, minimumFractionDigits: d });
const timeStr = (d) => d.toLocaleTimeString('tr-TR', { hour12: false });
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3500);
}
function feedStatus(id, state, text) { const el = $(id); el.className = 'feed ' + state; el.textContent = text; }
async function getJSON(url, ms = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function getText(url, ms = 30000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}

// ───────────────────────────── viewer ─────────────────────────────
// No Cesium ion: free tile providers only, plain WGS84 ellipsoid terrain.
const BASEMAPS = {
  dark: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', maximumLevel: 16, credit: 'Esri, HERE, Garmin, © OpenStreetMap contributors' }),
  sat: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel: 19, credit: 'Esri, Maxar, Earthstar Geographics' }),
  osm: () => new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }),
};

// Phones / low-power devices get a lighter default (fewer satellites, on-demand rendering, slower propagation).
const LOW_POWER = (() => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return /[?&]lite=1/.test(location.search) || (!/[?&]lite=0/.test(location.search) && (mobileUA || (coarse && narrow) || lowMem));
})();
document.documentElement.classList.toggle('low-power', LOW_POWER);

const fatal = (title, detail) => window.__gePageError?.(title, detail);
let viewer;
try {
  viewer = new Cesium.Viewer('globe', {
    baseLayer: new Cesium.ImageryLayer(BASEMAPS.dark()),
    baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    useBrowserRecommendedResolution: true, // render at CSS pixels, not device pixels (huge win on 3x phone screens)
    requestRenderMode: LOW_POWER, maximumRenderTimeChange: Infinity,
    msaaSamples: LOW_POWER ? 1 : 4,
    contextOptions: { webgl: { powerPreference: LOW_POWER ? 'low-power' : 'high-performance', failIfMajorPerformanceCaveat: false } },
  });
} catch (e) {
  fatal('3D grafik başlatılamadı', 'Tarayıcınız WebGL desteklemiyor ya da kapalı. Chrome/Safari güncel sürümünü deneyin. (' + (e?.message || e) + ')');
  throw e;
}
const scene = viewer.scene;
viewer.resolutionScale = 1;
scene.backgroundColor = Cesium.Color.BLACK;
scene.globe.baseColor = Cesium.Color.fromCssColorString('#04070b');
scene.globe.showGroundAtmosphere = !LOW_POWER;
scene.fog.enabled = true;
scene.postProcessStages.fxaa.enabled = !LOW_POWER;
if (LOW_POWER) { scene.globe.maximumScreenSpaceError = 3; scene.globe.tileCacheSize = 60; }
scene.renderError.addEventListener((_, err) => fatal('Grafik hatası', 'Çizim sırasında hata oluştu, sayfayı yenileyin. (' + (err?.message || err) + ')'));
scene.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fatal('Grafik bağlamı kayboldu', 'Cihazın grafik belleği yetersiz kaldı. Sayfayı yenileyin; mümkünse daha az uydu (ör. “En parlaklar”) seçin.'); });
// first frame rendered → hide loading screen
const offFirst = scene.postRender.addEventListener(() => { offFirst(); window.__geReady?.(); });
const requestRender = () => scene.requestRender();
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// Restore camera from URL hash (#lat,lon,altMeters) or start over Türkiye.
(function initCamera() {
  const m = location.hash.match(/^#(-?[\d.]+),(-?[\d.]+),([\d.]+)/);
  if (m) viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(+m[2], +m[1], +m[3]) });
  else viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(33, 36, 14e6) });
})();

function cameraCenter() {
  const c = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
  const p = viewer.camera.pickEllipsoid(c);
  const carto = p ? Cesium.Cartographic.fromCartesian(p) : viewer.camera.positionCartographic;
  return { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude), alt: viewer.camera.positionCartographic.height };
}
viewer.camera.moveEnd.addEventListener(() => {
  const c = cameraCenter();
  history.replaceState(null, '', `#${c.lat.toFixed(4)},${c.lon.toFixed(4)},${Math.round(c.alt)}`);
});

// ───────────────────────────── selection / info panel ─────────────────────────────
let selected = null; // { kind, key }
let tracking = false;
const orbitLines = scene.primitives.add(new Cesium.PolylineCollection());

function select(kind, key, fly = false) {
  unhighlight();
  selected = { kind, key };
  tracking = false; $('info-track').classList.remove('on'); viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  highlight();
  drawOrbit();
  renderInfo();
  $('info').hidden = false;
  if (fly) flyToSelected();
  requestRender();
}
function deselect() {
  unhighlight(); selected = null; tracking = false; orbitLines.removeAll();
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); $('info').hidden = true;
}
$('info-close').onclick = deselect;
$('info-fly').onclick = () => flyToSelected();
$('info-track').onclick = () => {
  tracking = !tracking; $('info-track').classList.toggle('on', tracking);
  if (!tracking) viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); else flyToSelected();
};
function selectedPosition() {
  if (!selected) return null;
  if (selected.kind === 'flight') return flights.get(selected.key)?.bb.position;
  if (selected.kind === 'sat') return sats.find((s) => s.id === selected.key)?.pt.position;
  if (selected.kind === 'quake') return quakes.get(selected.key)?.pt.position;
}
function flyToSelected() {
  const p = selectedPosition(); if (!p) return;
  const range = selected.kind === 'sat' ? 2.5e6 : selected.kind === 'flight' ? 9e4 : 6e5;
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(p, 1), { offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range), duration: 1.6 });
}
let lastTrackPos = null;
function followSelected() {
  if (!tracking) return;
  const p = selectedPosition(); if (!p) return;
  const cam = viewer.camera;
  const range = lastTrackPos ? Cesium.Cartesian3.distance(cam.positionWC, lastTrackPos) : (selected.kind === 'sat' ? 2.5e6 : 9e4);
  cam.lookAt(p, new Cesium.HeadingPitchRange(cam.heading, cam.pitch, range));
  lastTrackPos = Cesium.Cartesian3.clone(p);
}

function renderInfo() {
  if (!selected) return;
  const rows = []; let kind = '', title = '';
  if (selected.kind === 'flight') {
    const f = flights.get(selected.key); if (!f) return;
    kind = 'UÇUŞ · AIRCRAFT'; title = f.callsign || f.icao.toUpperCase();
    rows.push(['ICAO24', f.icao.toUpperCase()], ['Ülke', f.country || '—'], ['Tip / Tescil', [f.type, f.reg].filter(Boolean).join(' · ') || '—'],
      ['İrtifa', f.ground ? 'YERDE' : `${fmt(f.alt * 3.28084)} ft · ${fmt(f.alt)} m`], ['Hız', `${fmt(f.vel * 1.94384)} kt · ${fmt(f.vel * 3.6)} km/s`],
      ['Rota', `${fmt(f.track)}°`], ['Dikey hız', `${fmt(f.vrate * 196.85)} ft/dk`], ['Squawk', f.squawk || '—'],
      ['Konum', `${f.lat.toFixed(3)}, ${f.lon.toFixed(3)}`], ['Kaynak', f.source], ['Bağlantı', `<a target="_blank" rel="noopener" href="https://globe.adsb.lol/?icao=${f.icao}">adsb.lol ↗</a>`]);
  } else if (selected.kind === 'sat') {
    const s = sats.find((x) => x.id === selected.key); if (!s) return;
    kind = 'UYDU · SATELLITE'; title = s.name;
    const period = (2 * Math.PI) / s.rec.no;
    rows.push(['NORAD', s.id], ['İrtifa', `${fmt(s.alt || 0)} km`], ['Hız', `${fmt(s.speed || 0, 2)} km/sn`], ['Konum', s.lat != null ? `${s.lat.toFixed(2)}, ${s.lon.toFixed(2)}` : '—'],
      ['Eğim', `${fmt(Cesium.Math.toDegrees(s.rec.inclo), 2)}°`], ['Periyot', `${fmt(period, 1)} dk`], ['Yörünge', orbitClass(s.alt)],
      ['Bağlantı', `<a target="_blank" rel="noopener" href="https://www.n2yo.com/satellite/?s=${s.id}">n2yo ↗</a> · <a target="_blank" rel="noopener" href="https://celestrak.org/satcat/table-satcat.php?CATNR=${s.id}">CelesTrak ↗</a>`]);
  } else if (selected.kind === 'quake') {
    const q = quakes.get(selected.key); if (!q) return;
    const p = q.f.properties; const [lon, lat, depth] = q.f.geometry.coordinates;
    kind = 'DEPREM · EARTHQUAKE'; title = `M${p.mag?.toFixed(1)} · ${p.place || ''}`;
    rows.push(['Büyüklük', `${p.mag?.toFixed(1)} ${p.magType || ''}`], ['Derinlik', `${fmt(depth, 1)} km`], ['Zaman', new Date(p.time).toLocaleString('tr-TR')],
      ['Konum', `${lat.toFixed(3)}, ${lon.toFixed(3)}`], ['Tsunami', p.tsunami ? 'UYARI' : 'yok'], ['Durum', p.status], ['Bağlantı', `<a target="_blank" rel="noopener" href="${p.url}">USGS ↗</a>`]);
  }
  $('info-kind').textContent = kind; $('info-title').textContent = title;
  $('info-body').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

const pickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
pickHandler.setInputAction((e) => {
  const picked = scene.pick(e.position);
  const id = picked?.id ?? picked?.primitive?.id;
  if (window.innerWidth < 760) $('panel').classList.add('closed');
  if (id && id.kind) select(id.kind, id.key); else deselect();
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
pickHandler.setInputAction((e) => {
  const picked = scene.pick(e.endPosition);
  scene.canvas.style.cursor = picked?.id?.kind || picked?.primitive?.id?.kind ? 'pointer' : '';
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// ───────────────────────────── flights ─────────────────────────────
const planeImage = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
  g.fill(new Path2D('M32 3 C35 3 36 8 36 12 L36 24 L60 37 L60 42 L36 35 L35 50 L44 56 L44 60 L32 57 L20 60 L20 56 L29 50 L28 35 L4 42 L4 37 L28 24 L28 12 C28 8 29 3 32 3 Z'));
  return c.toDataURL();
})();
const flightBillboards = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
const flights = new Map(); // icao -> record
let flightSource = '—';
const COL_LOW = Cesium.Color.fromCssColorString('#5dff9b'), COL_HIGH = Cesium.Color.fromCssColorString('#ffb340');
function flightColor(f) { return Cesium.Color.lerp(COL_LOW, COL_HIGH, Math.min(1, f.alt / 9000), new Cesium.Color()); }
function flightVisible(f) { return $('l-flights').checked && !(f.ground && $('hide-ground').checked); }

// Shared public CORS proxy → upstream rate limits (429) and occasional 502s; retry a few times with spacing.
async function staticFlights(c) {
  let last;
  for (let i = 0; i < 4; i++) {
    try { return await getJSON(`${CORS_PROXY}https://api.adsb.lol/v2/point/${c.lat.toFixed(2)}/${c.lon.toFixed(2)}/250?_=${Date.now()}`, 20000); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500 + i * 2000)); }
  }
  throw last;
}
let flightsBusy = false;
async function loadFlights() {
  if (!$('l-flights').checked || flightsBusy) return;
  flightsBusy = true;
  try { await loadFlightsInner(); } finally { flightsBusy = false; }
}
async function loadFlightsInner() {
  const c = cameraCenter();
  const src = $('flight-source').value;
  try {
    const d = STATIC
      ? normAdsbLol(await staticFlights(c))
      : await getJSON(`/api/flights?source=${src}&lat=${c.lat.toFixed(2)}&lon=${c.lon.toFixed(2)}`, 25000);
    flightSource = d.source;
    const seen = new Set(); const now = Date.now();
    for (const r of d.rows) {
      const [icao, callsign, country, lon, lat, alt, ground, vel, track, vrate, squawk, type, reg] = r;
      seen.add(icao);
      let f = flights.get(icao);
      if (!f) {
        f = { icao };
        f.bb = flightBillboards.add({ image: planeImage, alignedAxis: Cesium.Cartesian3.UNIT_Z, scale: 0.42, id: { kind: 'flight', key: icao },
          scaleByDistance: new Cesium.NearFarScalar(2e5, 1.0, 1.5e7, 0.45), position: Cesium.Cartesian3.fromDegrees(lon, lat, alt) });
        flights.set(icao, f);
      }
      Object.assign(f, { callsign, country, lon, lat, alt: Math.max(0, alt || 0), ground: !!ground, vel, track, vrate, squawk, type, reg, t0: now, source: d.source });
      f.bb.rotation = -Cesium.Math.toRadians(track || 0);
      f.bb.show = flightVisible(f);
      if (!(selected?.kind === 'flight' && selected.key === icao)) f.bb.color = flightColor(f);
    }
    for (const [icao, f] of flights) if (!seen.has(icao)) { flightBillboards.remove(f.bb); flights.delete(icao); }
    const warn = d.errors?.length ? 'warn' : 'ok';
    feedStatus('feed-flights', warn, `UÇUŞ · ${d.source} · ${fmt(d.rows.length)} · ${timeStr(new Date())}${STATIC ? ' (görüş alanı, 250 nm)' : d.errors?.length ? ' (OpenSky erişilemedi, yedek kaynak)' : ''}`);
  } catch (e) {
    if (flights.size) feedStatus('feed-flights', 'warn', `UÇUŞ · son veri gösteriliyor (${e.message}), yeniden denenecek`);
    else { feedStatus('feed-flights', 'err', `UÇUŞ · hata: ${e.message}, yeniden deneniyor…`); setTimeout(loadFlights, 5000); }
  }
  counts();
}
// Dead-reckon aircraft between refreshes so they glide instead of jumping.
function stepFlights() {
  const now = Date.now();
  for (const f of flights.values()) {
    if (!f.bb.show) continue;
    const dt = Math.min(60, (now - f.t0) / 1000);
    let { lat, lon } = f;
    if (!f.ground && f.vel > 0) {
      const d = (f.vel * dt) / 6371000, h = Cesium.Math.toRadians(f.track || 0), la = Cesium.Math.toRadians(lat);
      lat += Cesium.Math.toDegrees(d * Math.cos(h));
      lon += Cesium.Math.toDegrees((d * Math.sin(h)) / Math.max(0.01, Math.cos(la)));
    }
    f.cur = { lat, lon };
    f.bb.position = Cesium.Cartesian3.fromDegrees(lon, lat, f.alt);
  }
}

// ───────────────────────────── satellites ─────────────────────────────
const satPoints = scene.primitives.add(new Cesium.PointPrimitiveCollection());
let sats = [];
const SAT_COL = { LEO: Cesium.Color.fromCssColorString('#00e5ff'), MEO: Cesium.Color.fromCssColorString('#7cff8a'), GEO: Cesium.Color.fromCssColorString('#c38bff'), HEO: Cesium.Color.fromCssColorString('#ff7ad9') };
function orbitClass(alt) { if (alt == null) return '—'; if (alt < 2000) return 'LEO'; if (alt < 30000) return 'MEO'; if (alt < 40000) return 'GEO'; return 'HEO'; }
function parseTLE(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean); const out = [];
  for (let i = 0; i + 2 < lines.length + 0 && i + 2 <= lines.length - 1; i += 3) {
    const name = lines[i].trim(), l1 = lines[i + 1], l2 = lines[i + 2];
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) { i -= 2; continue; }
    try { const rec = twoline2satrec(l1, l2); out.push({ id: l1.slice(2, 7).trim(), name, rec }); } catch { /* skip bad element set */ }
  }
  return out;
}
async function loadSats() {
  const group = $('sat-group').value;
  feedStatus('feed-sats', 'warn', `UYDU · ${group} yükleniyor…`);
  let text, via = 'proxy';
  // proxy (CDN-cached) → CelesTrak direct → bundled snapshot (CelesTrak returns 403 on repeat downloads within 2h)
  const valid = (t) => t && /\n1 \d/.test(t);
  const attempts = [
    ...(STATIC ? [] : [['proxy', `/api/tle?group=${group}`]]),
    ['direct', `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`],
    ['snapshot', `${BASE}tle/${group}.txt`],
  ];
  let lastErr = '';
  for (const [name, url] of attempts) {
    try { const t = await getText(url, 40000); if (valid(t)) { text = t; via = name; break; } lastErr = 'geçersiz veri'; }
    catch (e) { lastErr = e.message; }
  }
  if (!text) return feedStatus('feed-sats', 'err', `UYDU · hata: ${lastErr}`);
  satPoints.removeAll(); orbitLines.removeAll();
  if (selected?.kind === 'sat') deselect();
  sats = parseTLE(text);
  for (const s of sats) {
    const big = /ISS \(ZARYA\)|CSS \(TIANHE\)|HST$/.test(s.name);
    s.big = big;
    s.pt = satPoints.add({ pixelSize: big ? 8 : 3, color: SAT_COL.LEO, outlineColor: Cesium.Color.WHITE, outlineWidth: big ? 1.5 : 0, id: { kind: 'sat', key: s.id },
      scaleByDistance: new Cesium.NearFarScalar(1e6, 1.6, 4e7, 0.8), show: $('l-sats').checked });
  }
  stepSats();
  feedStatus('feed-sats', 'ok', `UYDU · CelesTrak ${group} · ${fmt(sats.length)} · ${timeStr(new Date())}${via === 'direct' ? ' (doğrudan)' : via === 'snapshot' ? ' (yerel anlık görüntü)' : ''}`);
  counts();
}
const scratchEcf = new Cesium.Cartesian3();
function stepSats() {
  if (!$('l-sats').checked || !sats.length) return;
  const now = new Date(); const gmst = gstime(now);
  for (const s of sats) {
    const pv = propagate(s.rec, now);
    if (!pv || !pv.position || typeof pv.position === 'boolean') { s.pt.show = false; s.dead = true; continue; }
    const ecf = eciToEcf(pv.position, gmst);
    s.pt.position = Cesium.Cartesian3.fromElements(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000, scratchEcf);
    s.pt.show = true; s.dead = false;
    const sel = selected?.kind === 'sat' && selected.key === s.id;
    if (sel || s.big || !s.cls) {
      const geo = eciToGeodetic(pv.position, gmst);
      s.alt = geo.height; s.lat = degreesLat(geo.latitude); s.lon = degreesLong(geo.longitude);
      const v = pv.velocity; s.speed = Math.hypot(v.x, v.y, v.z);
      if (!s.cls) { s.cls = orbitClass(s.alt); if (!sel) s.pt.color = SAT_COL[s.cls]; }
    }
  }
}
function drawOrbit() {
  orbitLines.removeAll();
  if (selected?.kind !== 'sat' || !$('sat-orbit').checked) return;
  const s = sats.find((x) => x.id === selected.key); if (!s) return;
  const periodMin = (2 * Math.PI) / s.rec.no; const now = new Date(); const gmst = gstime(now); const pts = [];
  for (let i = 0; i <= 240; i++) {
    const t = new Date(now.getTime() + (i / 240) * periodMin * 60000);
    const pv = propagate(s.rec, t); if (!pv?.position) continue;
    const e = eciToEcf(pv.position, gmst); // freeze Earth rotation → closed inertial orbit drawn in today's frame
    pts.push(new Cesium.Cartesian3(e.x * 1000, e.y * 1000, e.z * 1000));
  }
  orbitLines.add({ positions: pts, width: 1.5, material: Cesium.Material.fromType('Color', { color: SAT_COL[s.cls || 'LEO'].withAlpha(0.8) }) });
}

// ───────────────────────────── earthquakes ─────────────────────────────
const quakePoints = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const quakes = new Map();
async function loadQuakes() {
  const feed = $('quake-feed').value;
  let d, via = 'proxy';
  try { if (STATIC) throw 0; d = await getJSON(`/api/quakes?feed=${feed}`); }
  catch { via = 'direct'; try { d = await getJSON(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`); } catch (e) { feedStatus('feed-quakes', 'err', `DEPREM · hata: ${e.message}`); return; } }
  if (selected?.kind === 'quake') deselect();
  quakePoints.removeAll(); quakes.clear();
  const now = Date.now();
  for (const f of d.features) {
    const [lon, lat] = f.geometry.coordinates; const m = Math.max(0, f.properties.mag || 0);
    const ageH = (now - f.properties.time) / 3.6e6;
    const col = Cesium.Color.fromCssColorString(m >= 5 ? '#ff2a45' : m >= 3 ? '#ff6a3d' : '#ffa040').withAlpha(Math.max(0.35, 0.95 - ageH / 48));
    const pt = quakePoints.add({ position: Cesium.Cartesian3.fromDegrees(lon, lat, 0), pixelSize: 4 + m * m * 1.3, color: col, outlineColor: Cesium.Color.fromCssColorString('#ff2a45').withAlpha(0.9), outlineWidth: m >= 4.5 ? 2 : 0,
      id: { kind: 'quake', key: f.id }, show: $('l-quakes').checked, disableDepthTestDistance: 0 });
    quakes.set(f.id, { f, pt });
  }
  feedStatus('feed-quakes', 'ok', `DEPREM · USGS ${feed} · ${fmt(d.features.length)} · ${timeStr(new Date())}${via === 'direct' ? ' (doğrudan)' : ''}`);
  counts();
}

// ───────────────────────────── highlight ─────────────────────────────
function highlight() {
  if (!selected) return;
  if (selected.kind === 'flight') { const f = flights.get(selected.key); if (f) { f.bb.color = Cesium.Color.WHITE; f.bb.scale = 0.75; } }
  if (selected.kind === 'sat') { const s = sats.find((x) => x.id === selected.key); if (s) { s.pt.color = Cesium.Color.WHITE; s.pt.pixelSize = 10; s.pt.outlineWidth = 2; s.pt.outlineColor = Cesium.Color.fromCssColorString('#00e5ff'); } }
  if (selected.kind === 'quake') { const q = quakes.get(selected.key); if (q) { q.prevOutline = q.pt.outlineWidth; q.pt.outlineWidth = 3; q.pt.outlineColor = Cesium.Color.WHITE; } }
}
function unhighlight() {
  if (!selected) return;
  if (selected.kind === 'flight') { const f = flights.get(selected.key); if (f) { f.bb.color = flightColor(f); f.bb.scale = 0.42; } }
  if (selected.kind === 'sat') { const s = sats.find((x) => x.id === selected.key); if (s) { s.pt.color = SAT_COL[s.cls || 'LEO']; s.pt.pixelSize = s.big ? 8 : 3; s.pt.outlineWidth = s.big ? 1.5 : 0; s.pt.outlineColor = Cesium.Color.WHITE; } }
  if (selected.kind === 'quake') { const q = quakes.get(selected.key); if (q) { q.pt.outlineWidth = q.prevOutline || 0; q.pt.outlineColor = Cesium.Color.fromCssColorString('#ff2a45'); } }
}

// ───────────────────────────── HUD / counts ─────────────────────────────
function counts() {
  requestRender();
  let nf = 0; for (const f of flights.values()) if (f.bb.show) nf++;
  const ns = $('l-sats').checked ? sats.filter((s) => !s.dead).length : 0;
  const nq = $('l-quakes').checked ? quakes.size : 0;
  $('n-flights').textContent = $('h-flights').textContent = fmt(nf);
  $('n-sats').textContent = $('h-sats').textContent = fmt(ns);
  $('n-quakes').textContent = $('h-quakes').textContent = fmt(nq);
}
function hud() {
  const n = new Date(); $('utc').textContent = n.toISOString().slice(11, 19);
  const c = cameraCenter();
  $('h-cam').textContent = `${Math.abs(c.lat).toFixed(2)}°${c.lat >= 0 ? 'K' : 'G'} ${Math.abs(c.lon).toFixed(2)}°${c.lon >= 0 ? 'D' : 'B'} · İRT ${fmt(c.alt / 1000)} km`;
}

// ───────────────────────────── search ─────────────────────────────
const results = $('search-results');
function localMatches(q) {
  q = q.toLowerCase(); const out = [];
  for (const f of flights.values()) {
    if ((f.callsign && f.callsign.toLowerCase().includes(q)) || f.icao.includes(q) || (f.reg && f.reg.toLowerCase().includes(q))) out.push({ label: f.callsign || f.icao.toUpperCase(), hint: `✈ uçuş · ${fmt(f.alt * 3.28084)} ft`, go: () => select('flight', f.icao, true) });
    if (out.length >= 6) break;
  }
  let n = 0;
  for (const s of sats) { if (s.name.toLowerCase().includes(q) || s.id === q) { out.push({ label: s.name, hint: `◉ uydu · ${s.id}`, go: () => select('sat', s.id, true) }); if (++n >= 6) break; } }
  n = 0;
  for (const [id, x] of quakes) { const p = x.f.properties; if ((p.place || '').toLowerCase().includes(q)) { out.push({ label: `M${p.mag?.toFixed(1)} ${p.place}`, hint: '◎ deprem', go: () => select('quake', id, true) }); if (++n >= 4) break; } }
  return out;
}
function showResults(items) {
  results.innerHTML = ''; results.hidden = !items.length;
  items.forEach((it) => { const li = document.createElement('li'); li.innerHTML = `${escapeHtml(it.label)}<small>${escapeHtml(it.hint)}</small>`; li.onclick = () => { results.hidden = true; it.go(); }; results.appendChild(li); });
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function flyTo(lat, lon, alt = 1.2e6, rect) {
  deselect();
  if (rect) viewer.camera.flyTo({ destination: rect, duration: 2 });
  else viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt), duration: 2 });
}
async function geocode(q) {
  try {
    const r = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=tr,en&q=${encodeURIComponent(q)}`, 8000);
    return r.map((p) => ({ label: p.display_name.split(',').slice(0, 3).join(','), hint: `⌖ ${p.type}`, go: () => { const b = p.boundingbox.map(Number); flyTo(+p.lat, +p.lon, 0, Cesium.Rectangle.fromDegrees(b[2], b[0], b[3], b[1])); } }));
  } catch {
    const r = await getJSON(`https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(q)}`, 8000).catch(() => ({ features: [] }));
    return r.features.map((f) => ({ label: [f.properties.name, f.properties.country].filter(Boolean).join(', '), hint: `⌖ ${f.properties.type || 'yer'}`, go: () => flyTo(f.geometry.coordinates[1], f.geometry.coordinates[0], 4e5) }));
  }
}
let typeTimer;
$('search-input').addEventListener('input', (e) => {
  clearTimeout(typeTimer); const q = e.target.value.trim();
  if (q.length < 2) return (results.hidden = true);
  typeTimer = setTimeout(() => showResults(localMatches(q).slice(0, 10)), 150);
});
$('search').addEventListener('submit', async (e) => {
  e.preventDefault(); const q = $('search-input').value.trim(); if (!q) return;
  const m = q.replace(/^geo:/i, '').match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) { results.hidden = true; return flyTo(+m[1], +m[2], 3e5); }
  const local = localMatches(q);
  showResults([...local.slice(0, 6), { label: 'Yer aranıyor…', hint: '', go: () => {} }]);
  const geo = await geocode(q);
  const all = [...local.slice(0, 6), ...geo];
  if (!all.length) { results.hidden = true; return toast('Sonuç bulunamadı / No results'); }
  if (all.length === 1) { results.hidden = true; return all[0].go(); }
  showResults(all);
});
document.addEventListener('click', (e) => { if (!$('search').contains(e.target)) results.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { results.hidden = true; deselect(); } if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('search-input').focus(); } });

// ───────────────────────────── controls ─────────────────────────────
$('panel-toggle').onclick = () => $('panel').classList.toggle('closed');
$('l-flights').onchange = () => { for (const f of flights.values()) f.bb.show = flightVisible(f); if ($('l-flights').checked) loadFlights(); counts(); };
$('hide-ground').onchange = () => { for (const f of flights.values()) f.bb.show = flightVisible(f); counts(); };
$('flight-source').onchange = () => loadFlights();
$('l-sats').onchange = () => { satPoints.show = orbitLines.show = $('l-sats').checked; counts(); };
$('sat-group').onchange = () => loadSats();
$('sat-orbit').onchange = () => drawOrbit();
$('l-quakes').onchange = () => { quakePoints.show = $('l-quakes').checked; for (const q of quakes.values()) q.pt.show = true; counts(); };
$('quake-feed').onchange = () => loadQuakes();
document.querySelectorAll('#basemap button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('#basemap button').forEach((x) => x.classList.toggle('on', x === b));
  viewer.imageryLayers.removeAll(); viewer.imageryLayers.addImageryProvider(BASEMAPS[b.dataset.b]()); requestRender();
}));
document.querySelectorAll('#look button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('#look button').forEach((x) => x.classList.toggle('on', x === b));
  $('globe').className = b.dataset.l === 'none' ? '' : b.dataset.l;
}));

// ───────────────────────────── loops ─────────────────────────────
let tick = 0;
setInterval(() => {
  tick++;
  stepFlights();
  if (!LOW_POWER || tick % 3 === 0) stepSats(); // phones: propagate every 3 s
  followSelected(); renderInfo(); hud(); requestRender();
}, 1000);
setInterval(loadFlights, STATIC ? 20000 : 15000);
setInterval(loadQuakes, 5 * 60000);
viewer.camera.moveEnd.addEventListener(() => { if (STATIC || $('flight-source').value === 'adsb' || flightSource === 'adsb.lol') { clearTimeout(window.__mf); window.__mf = setTimeout(loadFlights, 800); } });
if (LOW_POWER) {
  $('sat-group').value = 'visual';
  $('panel').classList.add('closed');
  const opt = [...$('sat-group').options].find((o) => o.value === 'active'); if (opt) opt.textContent += ' (ağır, ~16 bin)';
}
if (STATIC) {
  const fs = $('flight-source'); fs.innerHTML = '<option value="adsb">adsb.lol (görüş alanı)</option>';
}
hud(); loadFlights(); loadSats(); loadQuakes();
window.godsEye = { viewer, flights, get sats() { return sats; }, quakes }; // handy for console debugging
