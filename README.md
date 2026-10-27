# GOD'S EYE · Küresel Gözlem Konsolu

Tarayıcıda çalışan, açık ve canlı verilerle beslenen 3D dünya küresi (CesiumJS). API anahtarı gerekmez.

**Katmanlar**
- ✈ Uçuşlar — OpenSky Network `states/all` (küresel), erişilemezse adsb.lol (kamera merkezinin 250 nm çevresi). 15 sn'de bir yenilenir, aradaki sürede ölü hesap (dead reckoning) ile hareket eder.
- ◉ Uydular — CelesTrak TLE grupları, satellite.js (SGP4) ile her saniye yayılır; seçilen uydunun yörüngesi çizilir. CelesTrak 2 saatten sık indirmeye 403 döndüğü için proxy 2 saat CDN önbelleğe alır ve `public/tle/` altında yedek anlık görüntü bulunur.
- ◎ Depremler — USGS GeoJSON (varsayılan son 24 saat), büyüklüğe göre boyutlandırılmış.

**Diğer:** arama / uçuş (koordinat, `geo:` URI, çağrı kodu, uydu adı, Nominatim/Photon yer arama), bilgi paneli, takip modu, sayaç HUD'u, karanlık/uydu/OSM altlık, NVG/FLIR/CRT filtreleri, URL hash ile paylaşılabilir kamera.

**Sunucusuz proxy'ler (`/api`)**: `flights`, `tle?group=`, `quakes?feed=`, `health`.

```bash
npm install
npm run dev      # http://localhost:5173 (API'ler Vite middleware ile yerelde de çalışır)
npm run build && npm run preview
```

Esinlenme: [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (MIT). Bu uygulama sıfırdan yazılmıştır; o projeden kod kopyalanmamıştır.
Veri: OpenSky Network, adsb.lol (ODbL), CelesTrak, USGS. Harita: Esri, © OpenStreetMap katkıcıları.

## GitHub Pages sürümü (statik)

`npm run build:pages` → `dist-pages/` (base `/gods-eye/`, `VITE_STATIC=1`). Sunucu yok: USGS ve CelesTrak doğrudan tarayıcıdan (CORS) çağrılır, CelesTrak erişilemezse `public/tle/` yedekleri kullanılır; uçuşlar adsb.lol'dan ücretsiz `proxy.cors.dev` CORS vekili üzerinden gelir (paylaşımlı vekil, ara sıra 429/502 → tekrar denenir).

## Gerçekçi mod (Google Photorealistic 3D + Cesium World Terrain)

Token yoksa uygulama ücretsiz Esri + NASA Black Marble ile çalışır. Fotogerçekçi 3D için şunlardan birini verin:

| Değişken | Ne açar |
|---|---|
| `VITE_CESIUM_ION_TOKEN` | Cesium World Terrain, Bing Aerial (ion), Google 3D Tiles (ion asset 2275207), ion/Google geocoder |
| `VITE_GOOGLE_MAPS_KEY` | Google Map Tiles API ile 3D Tiles + Google geocoder |

Build zamanında `.env.local` (gitignored) veya Vercel env; çalışma zamanında `?ionToken=…` / `?googleKey=…` (localStorage'a kaydedilir, boş değer siler).
Bu anahtarlar tarayıcıda görünür; mutlaka HTTP referrer kısıtlaması koyun (kitchenhubplatform.github.io, gods-eye-sand-two.vercel.app).

## İstihbarat katmanları (anahtarsız, istemci tarafı)

| Katman | Kaynak | Not |
|---|---|---|
| Doğal olaylar | NASA EONET v3 | canlı, 30 dk'da bir |
| Hava durumu | Open-Meteo (CC BY 4.0) | şehir etiketleri + haritaya tıklayınca nokta hava durumu |
| Yağış radarı | RainViewer | 10 dk'da bir, z≤7 |
| İstanbul raylı sistem | İBB Açık Veri Portalı | `public/data/ibb-*.geojson`, zemine/3D'ye oturtulur |
| Trafik kameraları | Caltrans CWWP2, City of Austin Open Data | kamu yol kameraları; anlık görüntü + (Caltrans) canlı HLS |
| Denizaltı kabloları | TeleGeography Submarine Cable Map (CC BY-NC-SA 3.0) | kablolar + iniş noktaları |
| Veri merkezleri | PeeringDB | ~5.300 tesis |
| Canlı TV/Radyo | TRT resmi HLS (CORS açık) | hls.js yalnızca açılınca yüklenir |
| Haber bandı | BBC Türkçe, TRT Haber RSS | Vercel'de `/api/news`, statikte CORS proxy |

Statik veri setlerini yenilemek için: `node scripts/fetch-static-data.mjs`. Mobilde ağır katmanlar (kamera, kablo, veri merkezi, raylı sistem, radar) varsayılan kapalıdır.
Uygulama PWA olarak yüklenebilir (manifest + service worker; canlı veriler önbelleğe alınmaz).
