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
