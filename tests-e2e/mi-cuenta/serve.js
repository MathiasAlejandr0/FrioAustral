/* Servidor estático mínimo para las pruebas: sirve la raíz del repositorio (sin /api: lo simula mock.js). */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".json": "application/json" };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = path.join(root, p === "/" ? "index.html" : p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("no"); }
  res.setHeader("Content-Type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(Number(process.env.PORT || 4173), () => console.log("listo"));
