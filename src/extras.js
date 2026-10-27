// Intel layers merged from Selçuk's OSIRIS "Tanrı Gözü" module, the Grok ALLEYSONME Cesium build and the
// God's Eye View reference: NASA EONET, RainViewer radar + Open-Meteo weather, İBB rail, public traffic
// cameras, submarine cables, datacenters, TRT live TV/radio and a news ticker. All keyless and client-side.
import * as Cesium from 'cesium';

const EONET_COL = {
  wildfires: '#ff6a00', severeStorms: '#b48cff', volcanoes: '#ff2d2d', seaLakeIce: '#9fe8ff', floods: '#3fa9ff',
  earthquakes: '#ff4d5e', drought: '#d9a441', dustHaze: '#c9b37e', landslides: '#a0703c', snow: '#ffffff',
  tempExtremes: '#ff9ad5', waterColor: '#38e0c0', manmade: '#ffd000',
};
const EONET_TR = {
  wildfires: 'Orman yangını', severeStorms: 'Şiddetli fırtına', volcanoes: 'Volkan', seaLakeIce: 'Deniz/göl buzu', floods: 'Sel',
  earthquakes: 'Deprem', drought: 'Kuraklık', dustHaze: 'Toz/pus', landslides: 'Heyelan', snow: 'Kar', tempExtremes: 'Aşırı sıcaklık',
  waterColor: 'Su rengi', manmade: 'İnsan kaynaklı',
};
const RAIL_COL = { Metro: '#e8333a', 'Hafif Metro': '#ff8a3d', Tramvay: '#2f8cff', 'Nostaljik Tramvay': '#c0392b', Füniküler: '#9b59ff', Teleferik: '#f1c40f', Banliyö: '#00b3a4' };
const WMO = { 0: ['Açık', '☀'], 1: ['Az bulutlu', '🌤'], 2: ['Parçalı bulutlu', '⛅'], 3: ['Kapalı', '☁'], 45: ['Sis', '🌫'], 48: ['Kırağılı sis', '🌫'],
  51: ['Çisenti', '🌦'], 53: ['Çisenti', '🌦'], 55: ['Yoğun çisenti', '🌦'], 61: ['Hafif yağmur', '🌧'], 63: ['Yağmur', '🌧'], 65: ['Kuvvetli yağmur', '🌧'],
  66: ['Donan yağmur', '🌧'], 67: ['Donan yağmur', '🌧'], 71: ['Hafif kar', '🌨'], 73: ['Kar', '🌨'], 75: ['Yoğun kar', '❄'], 77: ['Kar taneleri', '🌨'],
  80: ['Sağanak', '🌦'], 81: ['Sağanak', '🌧'], 82: ['Şiddetli sağanak', '⛈'], 85: ['Kar sağanağı', '🌨'], 86: ['Kar sağanağı', '❄'], 95: ['Gök gürültülü fırtına', '⛈'],
  96: ['Dolu ile fırtına', '⛈'], 99: ['Dolu ile fırtına', '⛈'] };
const WX_CITIES = [['İstanbul', 41.01, 28.97], ['Ankara', 39.93, 32.86], ['İzmir', 38.42, 27.14], ['Antalya', 36.9, 30.7], ['Bursa', 40.19, 29.06],
  ['Adana', 37.0, 35.32], ['Konya', 37.87, 32.48], ['Trabzon', 41.0, 39.72], ['Erzurum', 39.9, 41.27], ['Diyarbakır', 37.91, 40.24], ['Van', 38.5, 43.38],
  ['Samsun', 41.29, 36.33], ['Gaziantep', 37.07, 37.38], ['Kayseri', 38.73, 35.48], ['Eskişehir', 39.78, 30.52], ['Çanakkale', 40.15, 26.41],
  ['Atina', 37.98, 23.73], ['Sofya', 42.7, 23.32], ['Tiflis', 41.72, 44.79], ['Lefkoşa', 35.19, 33.38], ['Beyrut', 33.89, 35.5], ['Bakü', 40.41, 49.87],
  ['Londra', 51.51, -0.13], ['Paris', 48.86, 2.35], ['Berlin', 52.52, 13.4], ['Moskova', 55.76, 37.62], ['Kahire', 30.04, 31.24], ['Dubai', 25.2, 55.27],
  ['New York', 40.71, -74.0], ['Tokyo', 35.68, 139.69]];
export const TRT_STREAMS = [
  { id: 'trthaber', name: 'TRT Haber', url: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8', kind: 'tv' },
  { id: 'trt1', name: 'TRT 1', url: 'https://tv-trt1.medya.trt.com.tr/master.m3u8', kind: 'tv' },
  { id: 'trtworld', name: 'TRT World', url: 'https://tv-trtworld.medya.trt.com.tr/master.m3u8', kind: 'tv' },
  { id: 'radyohaber', name: 'TRT Radyo Haber', url: 'https://radio-trtradyohaber.live.trt.com.tr/master.m3u8', kind: 'radio' },
  { id: 'trtfm', name: 'TRT FM', url: 'https://radio-trtfm.live.trt.com.tr/master.m3u8', kind: 'radio' },
  { id: 'radyo3', name: 'TRT Radyo 3', url: 'https://radio-trtradyo3.live.trt.com.tr/master.m3u8', kind: 'radio' },
  { id: 'nagme', name: 'TRT Nağme', url: 'https://radio-trtnagme.live.trt.com.tr/master.m3u8', kind: 'radio' },
  { id: 'turku', name: 'TRT Türkü', url: 'https://radio-trtturku.live.trt.com.tr/master.m3u8', kind: 'radio' },
];
const NEWS = [
  { id: 'bbc', name: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml' },
  { id: 'trt', name: 'TRT Haber', url: 'https://www.trthaber.com/manset_articles.rss' },
];

export function createExtras(ctx) {
  const { viewer, LOW_POWER, STATIC, BASE, CORS_PROXY, $, fmt, escapeHtml, toast, feedStatus, requestRender } = ctx;
  const scene = viewer.scene;
  const NEAR = 2.5e5; // disable depth test within 250 km so markers sit above terrain / 3D tiles
  const recs = { event: new Map(), cam: new Map(), dc: new Map(), cable: new Map(), station: new Map(), rail: new Map(), wx: new Map(), landing: new Map() };
  const data = (f) => `${BASE}data/${f}`;
  const getJSON = async (u, ms = 25000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); } };
  const getText = async (u, ms = 20000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(t); } };
  const pos = (lat, lon, h = 30) => Cesium.Cartesian3.fromDegrees(lon, lat, h);
  const link = (href, txt) => `<a target="_blank" rel="noopener" href="${escapeHtml(href)}">${txt} ↗</a>`;
  const layer = (id, defOn, defMobile = false) => { const el = $(id); if (el) el.checked = LOW_POWER ? defMobile : defOn; return el; };

  // ───────── NASA EONET natural events ─────────
  const evPts = scene.primitives.add(new Cesium.PointPrimitiveCollection());
  const evTracks = scene.primitives.add(new Cesium.PolylineCollection());
  const lEvents = layer('l-events', true, true);
  async function loadEvents() {
    try {
      const d = await getJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=45&limit=400');
      evPts.removeAll(); evTracks.removeAll(); recs.event.clear();
      for (const e of d.events) {
        const g = e.geometry?.[e.geometry.length - 1]; if (!g) continue;
        let lon, lat;
        if (g.type === 'Point') [lon, lat] = g.coordinates;
        else if (g.type === 'Polygon') { const r = g.coordinates[0]; lon = r.reduce((a, p) => a + p[0], 0) / r.length; lat = r.reduce((a, p) => a + p[1], 0) / r.length; }
        else continue;
        const cat = e.categories?.[0]?.id || 'manmade';
        const col = Cesium.Color.fromCssColorString(EONET_COL[cat] || '#ffd000');
        const pt = evPts.add({ position: pos(lat, lon, 200), pixelSize: cat === 'wildfires' ? 7 : 10, color: col, outlineColor: Cesium.Color.BLACK.withAlpha(0.7), outlineWidth: 1.5,
          id: { kind: 'event', key: e.id }, disableDepthTestDistance: NEAR, show: lEvents.checked });
        if (cat === 'severeStorms' && e.geometry.length > 1) {
          const ps = e.geometry.filter((x) => x.type === 'Point').map((x) => pos(x.coordinates[1], x.coordinates[0], 500));
          if (ps.length > 1) evTracks.add({ positions: ps, width: 2, material: Cesium.Material.fromType('Color', { color: col.withAlpha(0.8) }), show: lEvents.checked });
        }
        recs.event.set(e.id, { e, g, lat, lon, cat, pt });
      }
      $('n-events').textContent = fmt(recs.event.size);
      feedStatus('feed-events', 'ok', `OLAY · NASA EONET · ${fmt(recs.event.size)} · ${new Date().toLocaleTimeString('tr-TR', { hour12: false })}`);
      requestRender();
    } catch (err) { feedStatus('feed-events', 'err', `OLAY · NASA EONET alınamadı (${err.message})`); }
  }
  lEvents.onchange = () => { for (const r of recs.event.values()) r.pt.show = lEvents.checked; for (let i = 0; i < evTracks.length; i++) evTracks.get(i).show = lEvents.checked; requestRender(); };

  // ───────── weather: RainViewer radar overlay + Open-Meteo city labels / click-point ─────────
  const lRadar = layer('l-radar', false), lWx = layer('l-wx', false);
  let radarLayer = null, radarTimer = null;
  async function setRadar(on) {
    if (radarLayer) { viewer.imageryLayers.remove(radarLayer, true); radarLayer = null; }
    clearInterval(radarTimer);
    if (!on) return requestRender();
    try {
      const m = await getJSON('https://api.rainviewer.com/public/weather-maps.json');
      const fr = m.radar.past[m.radar.past.length - 1];
      radarLayer = viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: `${m.host}${fr.path}/256/{z}/{x}/{y}/2/1_1.png`, maximumLevel: 7, credit: 'Radar: RainViewer.com' }));
      radarLayer.alpha = 0.75;
      feedStatus('feed-wx', 'ok', `HAVA · RainViewer radar ${new Date(fr.time * 1000).toLocaleTimeString('tr-TR', { hour12: false })}`);
      radarTimer = setInterval(() => lRadar.checked && setRadar(true), 10 * 60e3);
      requestRender();
    } catch (err) { feedStatus('feed-wx', 'err', `HAVA · radar alınamadı (${err.message})`); }
  }
  lRadar.onchange = () => setRadar(lRadar.checked);
  const wxLabels = scene.primitives.add(new Cesium.LabelCollection({ scene }));
  async function loadCityWx() {
    wxLabels.removeAll(); recs.wx.clear();
    if (!lWx.checked) return requestRender();
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${WX_CITIES.map((c) => c[1]).join(',')}&longitude=${WX_CITIES.map((c) => c[2]).join(',')}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto`;
      const d = await getJSON(u); const arr = Array.isArray(d) ? d : [d];
      arr.forEach((w, i) => {
        const [name, lat, lon] = WX_CITIES[i]; const c = w.current; const [, ic] = WMO[c.weather_code] || ['', ''];
        const key = 'city:' + name;
        wxLabels.add({ position: pos(lat, lon, 500), text: `${ic} ${name} ${Math.round(c.temperature_2m)}°`, font: '600 13px "JetBrains Mono",monospace',
          fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -8), disableDepthTestDistance: NEAR, id: { kind: 'wx', key },
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.2e7), scaleByDistance: new Cesium.NearFarScalar(1e5, 1.1, 8e6, 0.75) });
        recs.wx.set(key, { name, lat, lon, w });
      });
      feedStatus('feed-wx', 'ok', `HAVA · Open-Meteo · ${arr.length} şehir`);
      requestRender();
    } catch (err) { feedStatus('feed-wx', 'err', `HAVA · Open-Meteo alınamadı (${err.message})`); }
  }
  lWx.onchange = loadCityWx;
  setInterval(() => lWx.checked && loadCityWx(), 15 * 60e3);
  async function pointWx(lat, lon) {
    const key = `pt:${lat.toFixed(3)},${lon.toFixed(3)}`;
    const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,precipitation,cloud_cover&timezone=auto`);
    recs.wx.set(key, { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon, w: d });
    return key;
  }

  // ───────── İBB rail network (İstanbul open data) ─────────
  const lRail = layer('l-rail', false);
  let railPrim = null, stationPts = null;
  async function loadRail() {
    if (railPrim) { railPrim.show = stationPts.show = lRail.checked; return requestRender(); }
    if (!lRail.checked) return;
    try {
      const [lines, st] = await Promise.all([getJSON(data('ibb-rayli-hatlar.geojson')), getJSON(data('ibb-rayli-istasyonlar.geojson'))]);
      const inst = [];
      lines.features.forEach((f, i) => {
        const p = f.properties; const built = p.PROJE_ASAMA !== 'İnşaat Aşamasında';
        const col = Cesium.Color.fromCssColorString(RAIL_COL[p.PROJE_TURU] || '#ffffff').withAlpha(built ? 0.95 : 0.45);
        const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
        recs.rail.set('r' + i, { p });
        for (const part of parts) if (part.length > 1) inst.push(new Cesium.GeometryInstance({
          geometry: new Cesium.GroundPolylineGeometry({ positions: Cesium.Cartesian3.fromDegreesArray(part.flat()), width: built ? 4 : 3 }),
          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(col) }, id: { kind: 'rail', key: 'r' + i } }));
      });
      railPrim = scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({ geometryInstances: inst, appearance: new Cesium.PolylineColorAppearance(), classificationType: Cesium.ClassificationType.BOTH }));
      stationPts = scene.primitives.add(new Cesium.PointPrimitiveCollection());
      st.features.forEach((f, i) => {
        const [lon, lat] = f.geometry.coordinates; const p = f.properties; const built = p.PROJE_ASAMA !== 'İnşaat Aşamasında';
        stationPts.add({ position: pos(lat, lon, 60), pixelSize: 6, color: Cesium.Color.WHITE.withAlpha(built ? 1 : 0.5), outlineColor: Cesium.Color.fromCssColorString(RAIL_COL[p.HAT_TURU] || '#00e5ff'), outlineWidth: 2,
          id: { kind: 'station', key: 's' + i }, disableDepthTestDistance: NEAR, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.5e5) });
        recs.station.set('s' + i, { p, lat, lon });
      });
      toast(`İBB raylı sistem: ${lines.features.length} hat, ${st.features.length} istasyon`);
      requestRender();
    } catch (err) { toast('İBB raylı sistem verisi yüklenemedi: ' + err.message); }
  }
  lRail.onchange = loadRail;

  // ───────── public traffic cameras (Caltrans CWWP2, City of Austin open data) ─────────
  const lCctv = layer('l-cctv', false);
  let camPts = null, camRefresh = null;
  async function loadCams() {
    if (camPts) { camPts.show = lCctv.checked; return requestRender(); }
    if (!lCctv.checked) return;
    try {
      const cams = await getJSON(data('cctv.json'));
      camPts = scene.primitives.add(new Cesium.PointPrimitiveCollection());
      cams.forEach((c, i) => {
        const [lat, lon] = c;
        camPts.add({ position: pos(lat, lon, 40), pixelSize: 6, color: Cesium.Color.fromCssColorString('#ff3df2'), outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
          id: { kind: 'cam', key: i }, disableDepthTestDistance: NEAR });
        recs.cam.set(i, c);
      });
      $('n-cctv').textContent = fmt(cams.length);
      toast(`${fmt(cams.length)} kamu trafik kamerası (ABD: Kaliforniya, Austin) — tıklayın`);
      requestRender();
    } catch (err) { toast('Kamera listesi yüklenemedi: ' + err.message); }
  }
  lCctv.onchange = loadCams;

  // ───────── submarine cables (TeleGeography) + landing points ─────────
  const lCables = layer('l-cables', true, false);
  let cableLines = null, landingPts = null;
  async function loadCables() {
    if (cableLines) { cableLines.show = landingPts.show = lCables.checked; return requestRender(); }
    if (!lCables.checked) return;
    try {
      const [g, lp] = await Promise.all([getJSON(data('cables.geojson')), getJSON(data('landing-points.json')).catch(() => [])]);
      cableLines = scene.primitives.add(new Cesium.PolylineCollection());
      g.features.forEach((f, i) => {
        const col = Cesium.Color.fromCssColorString(f.properties.color || '#00e5ff').withAlpha(0.75);
        const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const part of parts) if (part.length > 1) cableLines.add({ positions: Cesium.Cartesian3.fromDegreesArray(part.flat()), width: 1.6, arcType: Cesium.ArcType.GEODESIC,
          material: Cesium.Material.fromType('Color', { color: col }), id: { kind: 'cable', key: i } });
        recs.cable.set(i, f.properties);
      });
      landingPts = scene.primitives.add(new Cesium.PointPrimitiveCollection());
      lp.forEach((l, i) => { landingPts.add({ position: pos(l[0], l[1], 20), pixelSize: 4, color: Cesium.Color.WHITE.withAlpha(0.85), id: { kind: 'landing', key: i },
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9e6), disableDepthTestDistance: NEAR }); recs.landing.set(i, l); });
      $('n-cables').textContent = fmt(g.features.length);
      requestRender();
    } catch (err) { toast('Kablo verisi yüklenemedi: ' + err.message); }
  }
  lCables.onchange = loadCables;

  // ───────── datacenters / colocation (PeeringDB) ─────────
  const lDc = layer('l-dc', false);
  let dcPts = null;
  async function loadDc() {
    if (dcPts) { dcPts.show = lDc.checked; return requestRender(); }
    if (!lDc.checked) return;
    try {
      const dcs = await getJSON(data('datacenters.json'));
      dcPts = scene.primitives.add(new Cesium.PointPrimitiveCollection());
      dcs.forEach((d, i) => { dcPts.add({ position: pos(d[0], d[1], 40), pixelSize: 5, color: Cesium.Color.fromCssColorString('#ffe14d'), outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
        id: { kind: 'dc', key: i }, disableDepthTestDistance: NEAR }); recs.dc.set(i, d); });
      $('n-dc').textContent = fmt(dcs.length);
      requestRender();
    } catch (err) { toast('Veri merkezi listesi yüklenemedi: ' + err.message); }
  }
  lDc.onchange = loadDc;

  // ───────── live media panel (TRT HLS, Caltrans camera streams) ─────────
  let hls = null;
  const media = $('media'), video = $('media-video'), sel = $('media-select');
  sel.innerHTML = `<optgroup label="TV">${TRT_STREAMS.filter((s) => s.kind === 'tv').map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</optgroup>`
    + `<optgroup label="Radyo">${TRT_STREAMS.filter((s) => s.kind === 'radio').map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</optgroup>`;
  async function play(url, title) {
    media.hidden = false; $('media-title').textContent = title;
    if (hls) { hls.destroy(); hls = null; }
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; }
    else {
      const { default: Hls } = await import('hls.js');
      if (!Hls.isSupported()) return toast('Bu tarayıcı HLS oynatamıyor');
      hls = new Hls({ lowLatencyMode: true, maxBufferLength: 20 });
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { toast(`Yayın açılamadı: ${title}`); hls?.destroy(); hls = null; } });
      hls.loadSource(url); hls.attachMedia(video);
    }
    video.play().catch(() => {});
  }
  function stop() { if (hls) { hls.destroy(); hls = null; } video.pause(); video.removeAttribute('src'); video.load(); media.hidden = true; }
  $('media-open').onclick = () => { if (!media.hidden) return stop(); const s = TRT_STREAMS.find((x) => x.id === sel.value) || TRT_STREAMS[0]; play(s.url, s.name); };
  sel.onchange = () => { const s = TRT_STREAMS.find((x) => x.id === sel.value); if (s) play(s.url, s.name); };
  $('media-close').onclick = stop;

  // ───────── news ticker (BBC Türkçe + TRT Haber RSS) ─────────
  const lNews = layer('l-news', true, true);
  let newsTimer = null;
  async function loadNews() {
    clearTimeout(newsTimer);
    $('ticker').hidden = !lNews.checked; document.documentElement.classList.toggle('has-ticker', lNews.checked);
    if (!lNews.checked) return;
    const items = [];
    await Promise.all(NEWS.map(async (n) => {
      try {
        const xml = await getText(STATIC ? CORS_PROXY + n.url : `/api/news?src=${n.id}`);
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        doc.querySelectorAll('item').forEach((it, i) => {
          if (i >= 15) return;
          const t = it.querySelector('title')?.textContent?.trim(); const l = it.querySelector('link')?.textContent?.trim();
          const d = Date.parse(it.querySelector('pubDate')?.textContent || '') || 0;
          if (t) items.push({ t, l, d, s: n.name });
        });
      } catch (err) { console.warn('news', n.id, err.message); }
    }));
    items.sort((a, b) => b.d - a.d);
    if (!items.length) { feedStatus('feed-news', 'err', 'HABER · RSS alınamadı'); }
    else {
      const html = items.slice(0, 30).map((x) => `<a target="_blank" rel="noopener" href="${escapeHtml(x.l || '#')}"><b>${escapeHtml(x.s)}</b> ${escapeHtml(x.t)}</a>`).join('<i>◆</i>');
      const track = $('ticker-track'); track.innerHTML = html + '<i>◆</i>' + html;
      track.style.animationDuration = `${Math.max(60, items.length * 9)}s`;
      feedStatus('feed-news', 'ok', `HABER · BBC Türkçe + TRT Haber · ${items.length}`);
    }
    newsTimer = setTimeout(loadNews, 10 * 60e3);
  }
  lNews.onchange = loadNews;

  // ───────── info panel content for the new kinds ─────────
  const W = (w) => WMO[w] || ['—', ''];
  function info(sel) {
    const { kind, key } = sel;
    if (kind === 'event') {
      const r = recs.event.get(key); if (!r) return null; const { e, g } = r;
      const mag = g.magnitudeValue != null ? `${fmt(g.magnitudeValue, 1)} ${g.magnitudeUnit || ''}` : '—';
      return { kind: 'DOĞAL OLAY · NASA EONET', title: e.title, position: pos(r.lat, r.lon), range: 8e5,
        rows: [['Tür', EONET_TR[r.cat] || e.categories?.[0]?.title], ['Tarih', new Date(g.date).toLocaleString('tr-TR')], ['Büyüklük', mag], ['Konum', `${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}`],
          ['Kaynak', (e.sources || []).map((s) => link(s.url, s.id)).join(' · ') || '—'], ['Bağlantı', link(e.link.replace('/api/v3/events/', '/api/v3/events/'), 'EONET')]] };
    }
    if (kind === 'wx') {
      const r = recs.wx.get(key); if (!r) return null; const c = r.w.current; const [txt, ic] = W(c.weather_code);
      const rows = [['Durum', `${ic} ${txt}`], ['Sıcaklık', `${fmt(c.temperature_2m, 1)} °C`]];
      if (c.apparent_temperature != null) rows.push(['Hissedilen', `${fmt(c.apparent_temperature, 1)} °C`]);
      rows.push(['Nem', `%${fmt(c.relative_humidity_2m)}`], ['Rüzgâr', `${fmt(c.wind_speed_10m)} km/s${c.wind_direction_10m != null ? ` · ${fmt(c.wind_direction_10m)}°` : ''}`]);
      if (c.pressure_msl != null) rows.push(['Basınç', `${fmt(c.pressure_msl)} hPa`], ['Bulut', `%${fmt(c.cloud_cover)}`], ['Yağış', `${fmt(c.precipitation, 1)} mm`]);
      rows.push(['Ölçüm', `${c.time} (${r.w.timezone_abbreviation || r.w.timezone || ''})`], ['Kaynak', link('https://open-meteo.com/', 'Open-Meteo')]);
      return { kind: 'HAVA DURUMU · WEATHER', title: r.name, position: pos(r.lat, r.lon), range: 2e5, rows };
    }
    if (kind === 'rail') {
      const r = recs.rail.get(key); if (!r) return null; const p = r.p;
      return { kind: 'RAYLI SİSTEM · İBB', title: p.PROJE_AD_KISA || p.PROJE_ADI || 'Hat', rows: [['Tür', p.PROJE_TURU], ['Aşama', p.PROJE_ASAMA], ['Uzunluk', p.UZUNLUK ? `${fmt(p.UZUNLUK, 1)} km` : '—'], ['Kaynak', link('https://data.ibb.gov.tr/', 'İBB Açık Veri')]] };
    }
    if (kind === 'station') {
      const r = recs.station.get(key); if (!r) return null; const p = r.p;
      return { kind: 'İSTASYON · İBB', title: p.ISTASYON, position: pos(r.lat, r.lon), range: 3000, rows: [['Hat', p.PROJE_ADI], ['Tür', p.HAT_TURU], ['Aşama', p.PROJE_ASAMA], ['Kaynak', link('https://data.ibb.gov.tr/', 'İBB Açık Veri')]] };
    }
    if (kind === 'cam') {
      const c = recs.cam.get(key); if (!c) return null; const [lat, lon, name, img, src, stream] = c;
      const bust = (u) => u + (u.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 15000);
      const html = `<img id="cam-img" class="cam-img" alt="Kamera görüntüsü" referrerpolicy="no-referrer" src="${escapeHtml(bust(img))}" />`
        + (stream ? `<button id="cam-live" class="cam-live">▶ CANLI AKIŞ</button>` : '');
      return { kind: 'TRAFİK KAMERASI · CCTV', title: name || 'Kamera', position: pos(lat, lon), range: 2500, html,
        rows: [['Kaynak', src === 'Caltrans' ? link('https://cwwp2.dot.ca.gov/', 'Caltrans CWWP2') : link('https://data.austintexas.gov/Transportation-and-Mobility/Traffic-Cameras/b4k4-adkb', 'City of Austin')], ['Konum', `${lat.toFixed(4)}, ${lon.toFixed(4)}`], ['Yenileme', '15 sn']],
        after() {
          clearInterval(camRefresh);
          camRefresh = setInterval(() => { const el = $('cam-img'); if (el) el.src = bust(img); else clearInterval(camRefresh); }, 15000);
          const b = $('cam-live'); if (b) b.onclick = () => play(stream, name);
          const el = $('cam-img'); if (el) el.onerror = () => { el.replaceWith(Object.assign(document.createElement('p'), { className: 'cam-off', textContent: 'Görüntü şu an alınamıyor (kamera kapalı olabilir).' })); };
        } };
    }
    if (kind === 'cable') {
      const p = recs.cable.get(key); if (!p) return null;
      return { kind: 'DENİZALTI KABLOSU', title: p.name, rows: [['Kaynak', link(`https://www.submarinecablemap.com/submarine-cable/${p.id}`, 'TeleGeography')]] };
    }
    if (kind === 'landing') {
      const l = recs.landing.get(key); if (!l) return null;
      return { kind: 'KABLO İNİŞ NOKTASI', title: l[2], position: pos(l[0], l[1]), range: 6e4, rows: [['Konum', `${l[0].toFixed(3)}, ${l[1].toFixed(3)}`], ['Kaynak', link('https://www.submarinecablemap.com/', 'TeleGeography')]] };
    }
    if (kind === 'dc') {
      const d = recs.dc.get(key); if (!d) return null;
      return { kind: 'VERİ MERKEZİ · COLO', title: d[2], position: pos(d[0], d[1]), range: 5000,
        rows: [['Şehir', [d[3], d[4]].filter(Boolean).join(', ') || '—'], ['İşletmeci', d[5] || '—'], ['Konum', `${d[0].toFixed(4)}, ${d[1].toFixed(4)}`], ['Kaynak', link(`https://www.peeringdb.com/search?q=${encodeURIComponent(d[2])}`, 'PeeringDB')]] };
    }
    return null;
  }
  function onDeselect() { clearInterval(camRefresh); }

  // click on empty globe with the weather layer on → Open-Meteo for that point
  async function onEmptyClick(screenPos, select) {
    if (!lWx.checked) return false;
    const ray = viewer.camera.getPickRay(screenPos); const c = ray && scene.globe.pick(ray, scene) || viewer.camera.pickEllipsoid(screenPos);
    if (!c) return false;
    const cg = Cesium.Cartographic.fromCartesian(c);
    try { const key = await pointWx(Cesium.Math.toDegrees(cg.latitude), Cesium.Math.toDegrees(cg.longitude)); select('wx', key); }
    catch (err) { toast('Hava durumu alınamadı: ' + err.message); }
    return true;
  }

  // kick off (light layers immediately, heavy ones only if enabled)
  loadEvents(); setInterval(loadEvents, 30 * 60e3);
  loadNews(); loadCables(); loadRail(); loadCams(); loadDc();
  if (lRadar.checked) setRadar(true);
  if (lWx.checked) loadCityWx();
  return { info, onDeselect, onEmptyClick, play, counts: () => ({ events: recs.event.size }) };
}
