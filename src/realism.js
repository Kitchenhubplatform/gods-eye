// Realism layer: Cesium ion / Google Photorealistic 3D Tiles, World Terrain, sun lighting, night lights, HDR, shadows.
// Everything degrades gracefully: with no token the free Esri + NASA GIBS setup is used.
import * as Cesium from 'cesium';

const LS_ION = 'ge.ionToken', LS_GOOGLE = 'ge.googleKey';

/** Tokens: URL override (?ionToken= / ?googleKey=, persisted in localStorage, empty value clears) → localStorage → build-time env. */
export function readTokens() {
  const url = new URL(location.href);
  const pick = (param, lsKey, envVal) => {
    if (url.searchParams.has(param)) {
      const v = (url.searchParams.get(param) || '').trim();
      try { v ? localStorage.setItem(lsKey, v) : localStorage.removeItem(lsKey); } catch { /* private mode */ }
      url.searchParams.delete(param);
      if (v) return v;
    }
    try { const s = localStorage.getItem(lsKey); if (s) return s; } catch { /* ignore */ }
    return (envVal || '').trim();
  };
  const ion = pick('ionToken', LS_ION, import.meta.env.VITE_CESIUM_ION_TOKEN);
  const google = pick('googleKey', LS_GOOGLE, import.meta.env.VITE_GOOGLE_MAPS_KEY);
  if (url.href !== location.href) history.replaceState(null, '', url.pathname + url.search + url.hash); // keep secrets out of share links
  return { ion, google };
}

export const NIGHT_LIGHTS = () => new Cesium.UrlTemplateImageryProvider({
  url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
  maximumLevel: 8, credit: 'NASA Black Marble (GIBS/EOSDIS)',
});

export function makeBasemaps(tokens) {
  const maps = {
    dark: { label: 'Karanlık', make: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', maximumLevel: 16, credit: 'Esri, HERE, Garmin, © OpenStreetMap contributors' }) },
    sat: { label: 'Uydu', make: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel: 19, credit: 'Esri, Maxar, Earthstar Geographics' }) },
    osm: { label: 'OSM', make: () => new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }) },
  };
  if (tokens.ion) maps.bing = { label: 'Bing (ion)', make: () => Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS }) };
  return maps;
}

/**
 * ctx: { viewer, LOW_POWER, toast, requestRender, onStatus(text, state) }
 */
export function createRealism(ctx, tokens) {
  const { viewer, LOW_POWER } = ctx;
  const scene = viewer.scene, globe = scene.globe;
  const hasTiles = !!(tokens.ion || tokens.google);
  const basemaps = makeBasemaps(tokens);
  const state = { mode: 'real', basemap: null, night: true, tiles3d: hasTiles, sunNow: true, tilesActive: false };
  let baseLayer = null, nightLayer = null, tileset = null, tilesetLoading = null, geocoder = null;

  if (tokens.google) Cesium.GoogleMaps.defaultApiKey = tokens.google;
  if (tokens.ion) Cesium.Ion.defaultAccessToken = tokens.ion;

  // Google ToS: Photorealistic 3D Tiles must be paired with the Google geocoder.
  if (tokens.google) geocoder = new Cesium.GoogleGeocoderService({ key: tokens.google });
  else if (tokens.ion) geocoder = new Cesium.IonGeocoderService({ scene, geocodeProviderType: Cesium.IonGeocodeProviderType.GOOGLE });

  // Terrain: Cesium World Terrain needs ion; otherwise the smooth ellipsoid.
  if (tokens.ion) {
    Cesium.createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: !LOW_POWER })
      .then((t) => { viewer.terrainProvider = t; globe.depthTestAgainstTerrain = true; ctx.requestRender(); })
      .catch((e) => ctx.onStatus(`ARAZİ · Cesium World Terrain yüklenemedi (${e.message || e})`, 'err'));
  }

  // Real-time clock so the sun / terminator / night lights match the actual time.
  viewer.clock.currentTime = Cesium.JulianDate.now();
  viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
  viewer.clock.shouldAnimate = true;

  async function setBasemap(key) {
    if (!basemaps[key]) key = 'sat';
    state.basemap = key;
    let provider;
    try {
      provider = await basemaps[key].make();
    } catch (e) {
      // e.g. invalid/expired ion token → Bing aerial fails: fall back to free Esri imagery
      console.warn('basemap failed', key, e?.message || e);
      if (key === 'bing') {
        delete basemaps.bing;
        if (!tokens.google) { geocoder = null; state.tiles3d = false; }
        ctx.onStatus(`ION · token reddedildi (${e?.message || e}); ücretsiz Esri moduna geçildi`, 'err');
        ctx.toast('Cesium ion token geçersiz — Esri uydu görüntüsüne geçildi');
        ctx.onBasemapsChanged?.();
      }
      if (key !== 'sat') return setBasemap('sat');
      return;
    }
    if (state.basemap !== key) return; // superseded
    if (baseLayer) viewer.imageryLayers.remove(baseLayer, true);
    baseLayer = viewer.imageryLayers.addImageryProvider(provider, 0);
    applyNight();
    ctx.requestRender();
  }

  function applyNight() {
    const want = state.mode === 'real' && state.night;
    if (want && !nightLayer) {
      nightLayer = viewer.imageryLayers.addImageryProvider(NIGHT_LIGHTS());
      nightLayer.dayAlpha = 0.0; nightLayer.nightAlpha = 1.0; nightLayer.brightness = 1.8; nightLayer.contrast = 1.2;
    }
    if (nightLayer) { nightLayer.show = want; viewer.imageryLayers.raiseToTop(nightLayer); }
  }

  function applyMode(mode) {
    state.mode = mode;
    const real = mode === 'real';
    document.documentElement.classList.toggle('mode-real', real);
    document.documentElement.classList.toggle('mode-tactical', !real);
    globe.enableLighting = real;
    globe.dynamicAtmosphereLighting = real;
    globe.dynamicAtmosphereLightingFromSun = real;
    globe.showGroundAtmosphere = real || !LOW_POWER;
    globe.atmosphereLightIntensity = real ? 10 : 6;
    globe.baseColor = real ? Cesium.Color.fromCssColorString('#0b1a2a') : Cesium.Color.fromCssColorString('#04070b');
    scene.skyAtmosphere.show = true;
    scene.skyBox.show = true;
    scene.sun.show = real; scene.moon.show = real;
    scene.fog.enabled = true;
    scene.fog.density = real ? 2.0e-4 : 1.0e-4;
    if (scene.highDynamicRangeSupported) scene.highDynamicRange = real && !LOW_POWER;
    scene.postProcessStages.bloom.enabled = false;
    // keep the day/night terminator visible from orbit (defaults fade lighting out beyond ~10,000 km)
    globe.lightingFadeOutDistance = real ? 6.5e7 : Cesium.Math.PI_OVER_TWO * 6356752;
    globe.lightingFadeInDistance = real ? 9.0e7 : Cesium.Math.PI * 6356752;
    globe.nightFadeOutDistance = real ? 1.0e6 : Cesium.Math.PI_OVER_TWO * 6356752;
    globe.nightFadeInDistance = real ? 9.0e7 : 5 * Cesium.Math.PI_OVER_TWO * 6356752;
    const wantBase = real ? (tokens.ion ? 'bing' : 'sat') : 'dark';
    if (state.basemap == null || ctx.autoBasemap) setBasemap(wantBase).catch(() => {});
    applyNight();
    updateTiles();
    ctx.requestRender();
    return wantBase;
  }

  async function ensureTileset() {
    if (tileset || tilesetLoading || !hasTiles) return tilesetLoading;
    ctx.onStatus('3D · Google Photorealistic 3D Tiles yükleniyor…', 'warn');
    tilesetLoading = Cesium.createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true }, {
      maximumScreenSpaceError: LOW_POWER ? 40 : 16,
      cacheBytes: (LOW_POWER ? 192 : 768) * 1024 * 1024,
      maximumCacheOverflowBytes: (LOW_POWER ? 64 : 512) * 1024 * 1024,
      dynamicScreenSpaceError: true,
      foveatedScreenSpaceError: true,
      skipLevelOfDetail: LOW_POWER,
      showCreditsOnScreen: true,
      shadows: Cesium.ShadowMode.ENABLED,
    }).then((ts) => {
      tileset = ts; tileset.show = false;
      scene.primitives.add(tileset, 0);
      tileset.tileFailed.addEventListener((e) => console.warn('3D tile failed', e?.message));
      ctx.onStatus(`3D · Google Photorealistic 3D Tiles (${tokens.google ? 'Google anahtarı' : 'Cesium ion'})`, 'ok');
      updateTiles();
      return ts;
    }).catch((e) => {
      tilesetLoading = null; state.tiles3d = false;
      ctx.onStatus(`3D · yüklenemedi: ${e.message || e}`, 'err');
      ctx.toast('Google 3D karolar yüklenemedi; token/anahtarı kontrol edin');
    });
    return tilesetLoading;
  }

  // Hybrid "Cesium + Google Earth": far away → Cesium globe (night lights, terminator); close in → Google 3D mesh, globe hidden.
  const ON_BELOW = 350e3, OFF_ABOVE = 450e3;
  function updateTiles() {
    const h = viewer.camera.positionCartographic.height;
    const allowed = state.tiles3d && hasTiles;
    if (allowed && h < OFF_ABOVE * 2) ensureTileset();
    let active = state.tilesActive;
    if (!allowed || !tileset) active = false;
    else if (h < ON_BELOW) active = true;
    else if (h > OFF_ABOVE) active = false;
    if (tileset) tileset.show = active;
    globe.show = !active;
    // Black Marble is only ~500 m/px: fade it out near the ground so it doesn't smear over the city imagery
    if (nightLayer) nightLayer.alpha = Math.min(1, Math.max(0, (h - 60e3) / (600e3 - 60e3)));
    // shadows only when zoomed into a city on capable devices
    const wantShadows = active && !LOW_POWER && h < 25e3 && state.mode === 'real';
    if (viewer.shadows !== wantShadows) {
      viewer.shadows = wantShadows;
      if (wantShadows) { const sm = scene.shadowMap; sm.softShadows = true; sm.darkness = 0.35; sm.size = 2048; sm.maximumDistance = 5000; }
    }
    if (active !== state.tilesActive) { state.tilesActive = active; ctx.requestRender(); }
  }
  viewer.camera.changed.addEventListener(updateTiles);
  viewer.camera.percentageChanged = 0.05;
  viewer.camera.moveEnd.addEventListener(updateTiles);

  /** Smooth, eased fly-to. Point targets dive to a street-level oblique when 3D tiles are available. */
  function flyTo({ lat, lon, alt, rect, duration }) {
    const opts = { duration: duration ?? 2.6, easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT, maximumHeight: 6e6 };
    if (rect) return viewer.camera.flyTo({ ...opts, destination: rect });
    const city = hasTiles && state.tiles3d && alt <= 3e5;
    if (city) {
      // oblique view: stand ~1.6 km south of the target at 1.2 km, looking north and down
      const h = Math.max(900, Math.min(alt, 2500));
      const back = h * 1.3 / 111320;
      return viewer.camera.flyTo({ ...opts, destination: Cesium.Cartesian3.fromDegrees(lon, lat - back, h), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 } });
    }
    return viewer.camera.flyTo({ ...opts, destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt) });
  }

  return {
    state, hasTiles, basemaps, tokens, get geocoder() { return geocoder; },
    setMode: applyMode, setBasemap, flyTo,
    setAutoBasemap(v) { ctx.autoBasemap = v; },
    setNight(v) { state.night = v; applyNight(); ctx.requestRender(); },
    setTiles(v) { state.tiles3d = v; updateTiles(); ctx.requestRender(); },
    useGoogleGeocoder() { return !!geocoder; },
  };
}
