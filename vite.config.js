import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesiumStatic';

// Serve /api/* handlers in `vite dev` / `vite preview` so the app works locally without `vercel dev`.
function localApi() {
  const mount = (server, load) => {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url.match(/^\/api\/([a-z0-9-]+)/);
      if (!m) return next();
      try {
        const mod = await load(`/api/${m[1]}.js`);
        await mod.default(req, res);
      } catch (e) {
        res.statusCode = 500; res.end(String(e));
      }
    });
  };
  return {
    name: 'local-api',
    configureServer(server) { mount(server, (p) => server.ssrLoadModule(p)); },
    configurePreviewServer(server) { mount(server, (p) => import(pathToFileURL(process.cwd() + p).href)); },
  };
}

const base = process.env.BASE_PATH || '/';
export default defineConfig({
  base,
  define: { CESIUM_BASE_URL: JSON.stringify(`${base}${cesiumBaseUrl}`) },
  build: { chunkSizeWarningLimit: 6000, target: ['es2020', 'safari14', 'chrome87', 'firefox78'] },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
    localApi(),
  ],
});
