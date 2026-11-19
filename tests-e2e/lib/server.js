/* Servidor estático mínimo para las pruebas de navegador. Sirve el sitio tal cual; /api lo simulan las pruebas con page.route. */
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4", ".webm": "video/webm", ".json": "application/json", ".ico": "image/x-icon" };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    /* Igual que Vercel: una dirección de página que no existe devuelve 404.html con código 404; lo demás, JSON. */
    if (!p.startsWith("/api/") && !path.extname(p).replace(".html", "")) { res.writeHead(404, { "content-type": MIME[".html"], "cache-control": "no-store" }); return fs.createReadStream(path.join(ROOT, "404.html")).pipe(res); }
    res.writeHead(404, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: false, message: "no existe" }));
  }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
});
srv.listen(+(process.env.PORT || 4599), "127.0.0.1", () => console.log("listo"));
