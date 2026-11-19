/* Recursos gratis: API del panel (validaciones, auth de admin, limpieza de Storage), lista pública y render de gratis.html.
   Supabase (rest y storage) simulado, sin red. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.ADMIN_EMAILS = "equipo@test.cl";

const root = path.join(__dirname, "..");
const U = {
  admin: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "equipo@test.cl" },
  sub: { id: "11111111-1111-4111-8111-111111111111", email: "sub@test.cl" },
};
const R1 = "99999999-9999-4999-8999-999999999991", R2 = "99999999-9999-4999-8999-999999999992";
const NEW_ID = "88888888-8888-4888-8888-888888888888";
const MB = 1024 * 1024;
let db, files, removed;

function reset() {
  db = {
    admins: [], subscribers: [],
    free_resources: [
      { id: R1, title: "Guía visible", description: "d", kind: "archivo", cover_path: `${R1}/cover-1700000000000-g.jpg`, file_path: `${R1}/file-1700000000000-guia.pdf`, file_name: "guia.pdf", content_type: "application/pdf", size_bytes: 2048, video_url: null, published: true, created_at: "2026-11-19T00:00:00Z" },
      { id: R2, title: "Oculto", description: "", kind: "video_externo", cover_path: null, file_path: null, file_name: null, content_type: null, size_bytes: null, video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", published: false, created_at: "2026-11-18T00:00:00Z" },
    ],
  };
  files = new Set([`free-resources/${R1}/cover-1700000000000-g.jpg`, `free-resources/${R1}/file-1700000000000-guia.pdf`]);
  removed = [];
}

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, data) => ({ ok: status < 400, status, statusText: "", headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.host !== "db.test") return json(404, {});
  if (u.pathname === "/auth/v1/user") {
    const who = Object.values(U).find((x) => init.headers.Authorization === `Bearer t-${x.id}`);
    return who ? json(200, who) : json(401, {});
  }
  if (u.pathname.startsWith("/storage/v1/")) {
    const s = u.pathname.replace("/storage/v1/", "");
    let m;
    if ((m = /^object\/upload\/sign\/(.+)$/.exec(s))) return json(200, { url: `/object/upload/sign/${m[1]}?token=TKN` });
    if ((m = /^object\/sign\/(.+)$/.exec(s))) return files.has(decodeURIComponent(m[1])) ? json(200, { signedURL: `/object/sign/${m[1]}?token=SIG` }) : json(400, { message: "not found" });
    if (/^object\/[^/]+$/.test(s) && init.method === "DELETE") { removed.push(...JSON.parse(init.body).prefixes); return json(200, []); }
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const rows = db[u.pathname.split("/").pop()];
    const method = init.method || "GET";
    const sel = () => rows.filter((r) => [...u.searchParams].every(([k, v]) => {
      if (["select", "order", "limit", "on_conflict"].includes(k)) return true;
      const [op, val] = [v.split(".")[0], v.split(".").slice(1).join(".")];
      return op === "eq" ? String(r[k]) === val : true;
    }));
    if (method === "GET") return json(200, sel());
    if (method === "POST") {
      const out = JSON.parse(init.body).map((r) => { const n = { created_at: "2026-11-19T12:00:00Z", published: true, description: "", cover_path: null, file_path: null, file_name: null, content_type: null, size_bytes: null, video_url: null, ...r }; rows.push(n); return n; });
      return json(201, out);
    }
    if (method === "PATCH") { const out = sel(); out.forEach((r) => Object.assign(r, JSON.parse(init.body))); return json(200, out); }
    if (method === "DELETE") { sel().forEach((r) => rows.splice(rows.indexOf(r), 1)); return json(204, null); }
  }
  return json(404, { message: "sin mock " + url });
};

const account = require("../api/account");
const admin = require("../api/admin");

function call(handler, { method = "GET", url, body, as }) {
  return new Promise((resolve) => {
    const req = { method, url, headers: { authorization: as ? `Bearer t-${U[as].id}` : "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, query: Object.fromEntries(new URL(url, "http://x").searchParams) };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(d) { resolve({ status: this.statusCode, body: d ? JSON.parse(d) : null }); } };
    handler(req, res);
  });
}
const A = (action, body, as = "admin") => call(admin, { method: body ? "POST" : "GET", url: `/api/admin?action=${action}`, body, as });
beforeEach(reset);

test("las acciones de recursos gratis exigen ser del equipo", async () => {
  for (const [a, body] of [["free-list"], ["free-upload-url", { kind: "archivo", role: "file", fileName: "a.pdf", contentType: "application/pdf", size: 5 }], ["free-save", { id: NEW_ID }], ["free-update", { id: R1, title: "x" }], ["free-delete", { id: R1 }]]) {
    assert.equal((await A(a, body, "sub")).status, 403, `${a}: un suscriptor no entra`);
    assert.equal((await A(a, body, null)).status, 401, `${a}: sin sesión`);
  }
  assert.equal((await A("free-list")).status, 200);
  assert.equal(db.free_resources.length, 2);
});

test("lista pública: solo los publicados y sin rutas internas de Storage", async () => {
  const r = await call(account, { url: "/api/account?action=free-resources" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items.map((i) => i.title), ["Guía visible"]);
  const it = r.body.items[0];
  assert.equal(it.coverUrl, `https://db.test/storage/v1/object/public/free-resources/${R1}/cover-1700000000000-g.jpg`);
  assert.equal(it.fileUrl, `https://db.test/storage/v1/object/public/free-resources/${R1}/file-1700000000000-guia.pdf`);
  assert.ok(!("cover_path" in it) && !("file_path" in it) && !("published" in it));
});

test("subida: valida tipo y tamaño en el servidor, con mensajes claros", async () => {
  const up = (b) => A("free-upload-url", { kind: "archivo", role: "file", fileName: "a.pdf", contentType: "application/pdf", size: 1000, ...b });
  assert.equal((await up({ kind: "otro" })).status, 400);
  assert.equal((await up({ role: "zip" })).status, 400);
  assert.equal((await up({ id: "no-uuid" })).status, 400);
  assert.equal((await up({ fileName: "a.exe", contentType: "application/x-msdownload" })).status, 400);
  assert.equal((await up({ contentType: "text/html" })).status, 400, "tipo y extensión deben coincidir");
  assert.equal((await up({ fileName: "a.mp4", contentType: "video/mp4" })).status, 400, "un archivo no admite video");
  const big = await up({ size: 51 * MB });
  assert.equal(big.status, 413);
  assert.match(big.body.message, /50 MB/);
  const bigVideo = await up({ kind: "video_corto", fileName: "v.mp4", contentType: "video/mp4", size: 51 * MB });
  assert.equal(bigVideo.status, 413);
  assert.match(bigVideo.body.message, /YouTube/, "sugiere el link de YouTube");
  assert.equal((await up({ kind: "video_corto", fileName: "v.mov", contentType: "video/quicktime", size: 5 * MB })).status, 400);
  assert.equal((await up({ kind: "video_externo", role: "file" })).status, 400, "un video con link no sube archivo");
  const cover = (b) => up({ role: "cover", fileName: "f.jpg", contentType: "image/jpeg", size: 1000, ...b });
  assert.equal((await cover({ contentType: "application/pdf", fileName: "f.pdf" })).status, 400);
  assert.equal((await cover({ size: 6 * MB })).status, 413);
  const okv = await up({ kind: "video_corto", fileName: "Clase corta.mp4", contentType: "video/mp4", size: 50 * MB });
  assert.equal(okv.status, 200);
  assert.equal(okv.body.bucket, "free-resources");
  assert.equal(okv.body.token, "TKN");
  assert.match(okv.body.id, /^[0-9a-f-]{36}$/);
  assert.match(okv.body.path, new RegExp(`^${okv.body.id}/file-\\d{13}-Clase-corta\\.mp4$`));
  const same = await cover({ id: okv.body.id });
  assert.equal(same.body.id, okv.body.id, "foto y archivo comparten el id del recurso");
  assert.match(same.body.path, new RegExp(`^${okv.body.id}/cover-`));
});

const P = (role, name, id = NEW_ID) => `${id}/${role}-1700000000001-${name}`;

test("guardar archivo: foto obligatoria, rutas del propio recurso y archivos ya subidos", async () => {
  const body = (b) => ({ id: NEW_ID, kind: "archivo", title: "Manual", description: "Para técnicos", coverPath: P("cover", "m.jpg"), coverType: "image/jpeg", coverSize: 1000, coverName: "m.jpg", filePath: P("file", "m.pdf"), fileName: "m.pdf", contentType: "application/pdf", size: 2000, ...b });
  assert.equal((await A("free-save", body({ coverPath: undefined }))).status, 400, "sin foto de referencia");
  assert.equal((await A("free-save", body({}))).status, 400, "los archivos aún no están en Storage");
  files.add(`free-resources/${P("cover", "m.jpg")}`); files.add(`free-resources/${P("file", "m.pdf")}`);
  assert.equal((await A("free-save", body({ title: "  " }))).status, 400);
  assert.equal((await A("free-save", body({ id: "x" }))).status, 400);
  assert.equal((await A("free-save", body({ filePath: P("file", "m.pdf", R1) }))).status, 400, "ruta de otro recurso");
  assert.equal((await A("free-save", body({ coverPath: P("file", "m.jpg") }))).status, 400, "la foto debe ser de rol cover");
  assert.equal((await A("free-save", body({ filePath: "../x.pdf" }))).status, 400);
  assert.equal((await A("free-save", body({ coverType: "application/pdf", coverName: "m.pdf" }))).status, 400);
  assert.equal((await A("free-save", body({ contentType: "video/mp4", fileName: "m.mp4" }))).status, 400);
  assert.equal((await A("free-save", body({ size: 60 * MB }))).status, 413);
  const ok = await A("free-save", body({ published: false }));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.item.published, false);
  const row = db.free_resources.find((r) => r.id === NEW_ID);
  assert.equal(row.kind, "archivo");
  assert.equal(row.file_path, P("file", "m.pdf"));
  assert.equal(row.created_by, U.admin.id);
  assert.equal((await call(account, { url: "/api/account?action=free-resources" })).body.items.length, 1, "oculto: no sale en la página pública");
});

test("guardar video corto: mp4/webm hasta 50 MB y foto de preview obligatoria", async () => {
  files.add(`free-resources/${P("cover", "p.png")}`); files.add(`free-resources/${P("file", "v.webm")}`);
  const body = (b) => ({ id: NEW_ID, kind: "video_corto", title: "Clase", coverPath: P("cover", "p.png"), coverType: "image/png", coverSize: 500, filePath: P("file", "v.webm"), fileName: "v.webm", contentType: "video/webm", size: 10 * MB, ...b });
  assert.equal((await A("free-save", body({ coverPath: undefined }))).status, 400);
  const tooBig = await A("free-save", body({ size: 55 * MB }));
  assert.equal(tooBig.status, 413);
  assert.match(tooBig.body.message, /YouTube/);
  assert.equal((await A("free-save", body({ contentType: "application/pdf", fileName: "v.pdf" }))).status, 400);
  const ok = await A("free-save", body({}));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.item.kind, "video_corto");
  assert.match(ok.body.item.fileUrl, /\/object\/public\/free-resources\/.+v\.webm$/);
});

test("guardar video externo: link https válido; YouTube usa su miniatura, otros links piden preview", async () => {
  const body = (b) => ({ id: NEW_ID, kind: "video_externo", title: "Video", videoUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc", ...b });
  for (const bad of ["", "http://youtu.be/dQw4w9WgXcQ", "javascript:alert(1)", "youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/@canal", "https://youtube.com/watch?v=corto", "https://user:pw@example.com/x"]) {
    assert.equal((await A("free-save", body({ videoUrl: bad }))).status, 400, bad || "(vacío)");
  }
  const yt = await A("free-save", body({}));
  assert.equal(yt.status, 201);
  assert.equal(db.free_resources.find((r) => r.id === NEW_ID).video_url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "guarda el link canónico");
  assert.equal(yt.body.item.coverUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  assert.equal(yt.body.item.coverFallbackUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  assert.equal(yt.body.item.youtube, true);
  const other = "99999999-9999-4999-8999-999999999993";
  assert.equal((await A("free-save", body({ id: other, videoUrl: "https://vimeo.com/123456" }))).status, 400, "no es YouTube: falta la preview");
  files.add(`free-resources/${P("cover", "v.webp", other)}`);
  const withCover = await A("free-save", body({ id: other, videoUrl: "https://vimeo.com/123456", coverPath: P("cover", "v.webp", other), coverType: "image/webp", coverSize: 900 }));
  assert.equal(withCover.status, 201);
  assert.match(withCover.body.item.coverUrl, /object\/public\/free-resources\//);
  assert.equal(withCover.body.item.youtube, false);
});

test("editar: publicar/ocultar, cambiar la foto borra la anterior y no se puede quitar la foto de un archivo", async () => {
  assert.equal((await A("free-update", { id: R1, title: "Guía editada", description: "nueva", published: false })).status, 200);
  assert.equal(db.free_resources[0].title, "Guía editada");
  assert.equal(db.free_resources[0].published, false);
  assert.equal((await A("free-update", { id: R1, title: "" })).status, 400);
  assert.equal((await A("free-update", { id: "no" , title: "x" })).status, 400);
  assert.equal((await A("free-update", { id: NEW_ID, title: "x" })).status, 404);
  assert.equal((await A("free-update", { id: R1, title: "x", removeCover: true })).status, 400, "un archivo siempre lleva foto");
  const newCover = P("cover", "n.jpg", R1);
  assert.equal((await A("free-update", { id: R1, title: "x", coverPath: newCover, coverType: "image/jpeg", coverSize: 10 })).status, 400, "no subida");
  files.add(`free-resources/${newCover}`);
  assert.equal((await A("free-update", { id: R1, title: "x", coverPath: newCover, coverType: "image/jpeg", coverSize: 10 })).status, 200);
  assert.equal(db.free_resources[0].cover_path, newCover);
  assert.deepEqual(removed, [`${R1}/cover-1700000000000-g.jpg`], "borra la foto anterior del Storage");
  // video externo: el link se vuelve a validar y se puede volver a la miniatura de YouTube
  assert.equal((await A("free-update", { id: R2, title: "v", videoUrl: "http://malo.cl" })).status, 400);
  assert.equal((await A("free-update", { id: R2, title: "v", videoUrl: "https://vimeo.com/55" })).status, 400, "sin miniatura de YouTube hace falta preview");
  assert.equal((await A("free-update", { id: R2, title: "v", videoUrl: "https://www.youtube.com/shorts/abcdefghijk", published: true })).status, 200);
  assert.equal(db.free_resources[1].video_url, "https://www.youtube.com/watch?v=abcdefghijk");
});

test("eliminar: borra la fila y también la foto y el archivo del Storage", async () => {
  assert.equal((await A("free-delete", { id: "no" })).status, 400);
  assert.equal((await A("free-delete", { id: NEW_ID })).status, 404);
  assert.equal((await A("free-delete", { id: R1 })).status, 200);
  assert.equal(db.free_resources.find((r) => r.id === R1), undefined);
  assert.deepEqual(removed.sort(), [`${R1}/cover-1700000000000-g.jpg`, `${R1}/file-1700000000000-guia.pdf`]);
  removed = [];
  assert.equal((await A("free-delete", { id: R2 })).status, 200);
  assert.deepEqual(removed, [], "un video de YouTube sin foto propia no tiene archivos");
});

/* ---------------- render de gratis.html ---------------- */
const G = require("../assets/fa-gratis.js");
const item = (o) => ({ id: "x1", title: "Título", description: "Descripción", kind: "archivo", coverUrl: "https://db.test/c.jpg", coverFallbackUrl: null, fileUrl: "https://db.test/f.pdf", fileName: "manual.pdf", size: 1572864, videoUrl: null, youtube: false, ...o });

test("tarjetas: mismo formato, textos escapados y el botón correcto por tipo", () => {
  const doc = G.cardHtml(item({ title: '<img src=x onerror="alert(1)">', description: "a & b" }));
  assert.ok(!doc.includes("<img src=x"), "el título no inyecta HTML");
  assert.match(doc, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(doc, /class="dl glass reveal fa-rc"/);
  assert.match(doc, /<div class="fa-rc-media"><img src="https:\/\/db\.test\/c\.jpg"/);
  assert.match(doc, />Descargar<\/a>/);
  assert.match(doc, /href="https:\/\/db\.test\/f\.pdf\?download=manual\.pdf"/);
  assert.match(doc, /PDF · 1,5 MB/);
  const ext = G.cardHtml(item({ kind: "video_externo", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", youtube: true, fileUrl: null }));
  assert.match(ext, /<a class="btn btn-red fa-rc-cta" href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ" target="_blank" rel="noopener noreferrer">Ver video/);
  assert.match(ext, /Video en YouTube/);
  const short = G.cardHtml(item({ kind: "video_corto", fileUrl: "https://db.test/v.mp4", size: 5 * MB }));
  assert.match(short, /<button type="button" class="btn btn-red fa-rc-cta" data-play[^>]*>Ver video<\/button>/);
  assert.match(short, /data-video="https:\/\/db\.test\/v\.mp4"/);
  assert.match(short, /Video corto · 5,0 MB/);
  assert.equal(G.cardHtml(item({ kind: "video_externo", videoUrl: "javascript:alert(1)" })).includes("javascript:"), false, "solo links http(s)");
  assert.equal(G.cardHtml(item({ coverUrl: "javascript:x" })).includes("javascript:"), false);
});

test("secciones: videos arriba (YouTube, externos y cortos) y documentos abajo; sin recursos no hay sección", () => {
  const items = [item({ id: "a", kind: "archivo" }), item({ id: "b", kind: "video_externo", videoUrl: "https://vimeo.com/1" }), item({ id: "c", kind: "video_corto", fileUrl: "https://db.test/v.mp4" })];
  const g = G.groups(items);
  assert.deepEqual(g.videos.map((r) => r.id), ["b", "c"]);
  assert.deepEqual(g.docs.map((r) => r.id), ["a"]);
  assert.deepEqual(G.groups([]), { videos: [], docs: [] });
  assert.equal(G.render([]), "", "sin recursos no hay estado vacío ni tarjetas");
  assert.deepEqual(G.groups(null), { videos: [], docs: [] });
});

function fakePage(items, ok = true) {
  const mk = () => ({ html: "", hidden: true, attrs: {}, insertAdjacentHTML(_, h) { this.html += h; }, set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, setAttribute(k, v) { this.attrs[k] = v; }, querySelectorAll: () => [], classList: { add() {} } });
  const els = { faFreeVideos: mk(), faFreeDocs: mk(), "documentos-gratis": mk() };
  els.faFreeVideos.hidden = false;
  const doc = { readyState: "complete", getElementById: (id) => els[id] || null, addEventListener() {} };
  const prev = global.fetch;
  global.fetch = async () => (ok ? { ok: true, json: async () => ({ items }) } : Promise.reject(new Error("sin red")));
  G.init({ document: doc });
  return new Promise((res) => setTimeout(() => { global.fetch = prev; res(els); }, 20));
}

test("gratis.html en el navegador: 3 casos (videos y documentos, solo videos, sin recursos)", async () => {
  const v = item({ id: "v1", kind: "video_externo", videoUrl: "https://vimeo.com/1" });
  const d = item({ id: "d1" });
  const both = await fakePage([v, d]);
  assert.match(both.faFreeVideos.html, /data-id="v1"/);
  assert.match(both.faFreeDocs.html, /data-id="d1"/);
  assert.equal(both["documentos-gratis"].hidden, false, "con documentos se muestra la sección");
  const onlyVideos = await fakePage([v]);
  assert.match(onlyVideos.faFreeVideos.html, /data-id="v1"/);
  assert.equal(onlyVideos["documentos-gratis"].hidden, true, "sin documentos la sección no aparece");
  const none = await fakePage([]);
  assert.equal(none.faFreeVideos.html, "");
  assert.equal(none["documentos-gratis"].hidden, true);
  const down = await fakePage(null, false);
  assert.equal(down["documentos-gratis"].hidden, true, "si la API falla, solo queda YouTube");
});

test("gratis.html: títulos 'Videos gratis' y 'Documentos gratis', tarjeta de YouTube fija con el mismo formato", () => {
  const html = fs.readFileSync(path.join(root, "gratis.html"), "utf8");
  assert.match(html, /<section[^>]*id="videos-gratis"[\s\S]*?<h2[^>]*>Videos <em>gratis<\/em><\/h2>/);
  assert.match(html, /<section[^>]*id="documentos-gratis"[^>]*\shidden>[\s\S]*?<h2[^>]*>Documentos <em>gratis<\/em><\/h2>/);
  assert.ok(html.indexOf('id="videos-gratis"') < html.indexOf('id="documentos-gratis"'), "videos arriba, documentos abajo");
  assert.match(html, /id="faFreeVideos"[^>]*>\s*<article class="dl glass reveal fa-rc" data-kind="youtube">\s*<a class="fa-rc-media"[\s\S]*?<div class="fa-rc-body">[\s\S]*?<h4>Clases gratis en YouTube<\/h4>[\s\S]*?Ir al canal/);
  assert.match(html, /<script src="assets\/fa-gratis\.js">/);
  assert.match(html, /href="assets\/fa-gratis\.css"/);
  assert.ok(!/Pronto|no hay recursos|sin recursos/i.test(html), "sin estado vacío");
});

test("CSS: grilla de 1/2/3 columnas, foto 16:10 con cover y textos recortados", () => {
  const css = fs.readFileSync(path.join(root, "assets/fa-gratis.css"), "utf8");
  assert.match(css, /\.free-grid\.fa-free\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@media\(min-width:600px\)\{\.free-grid\.fa-free\{grid-template-columns:repeat\(2,/);
  assert.match(css, /@media\(min-width:980px\)\{\.free-grid\.fa-free\{grid-template-columns:repeat\(3,/);
  assert.match(css, /grid-auto-rows:1fr/);
  assert.match(css, /\.fa-rc-media\{[^}]*aspect-ratio:16\/10/);
  assert.match(css, /\.fa-rc-media img[^{]*\{[^}]*object-fit:cover/);
  assert.match(css, /-webkit-line-clamp:3/);
  assert.match(css, /\.fa-rc-cta\{[^}]*margin-top:auto/);
});

test("migración: aditiva, RLS con lectura pública solo de publicados y escritura solo con service role", () => {
  const dir = path.join(root, "supabase", "migrations");
  const f = fs.readdirSync(dir).find((x) => /recursos_gratis/.test(x));
  assert.ok(f, "existe la migración de recursos gratis");
  const sql = fs.readFileSync(path.join(dir, f), "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /create table if not exists public\.free_resources/);
  assert.match(sql, /alter table public\.free_resources enable row level security/);
  assert.match(sql, /create policy "free_resources_select_publicados" on public\.free_resources\s+for select to anon, authenticated using \(published\)/);
  assert.ok(!/for (insert|update|delete|all)/i.test(sql), "sin políticas de escritura");
  assert.ok(!/drop (table|column)|delete from|truncate|alter table (?!public\.free_resources)/i.test(sql), "no toca objetos existentes");
  assert.match(sql, /'free-resources', 'free-resources', true, 52428800/);
  assert.match(sql, /grant select on public\.free_resources to anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.free_resources to service_role/);
  assert.ok(!/grant (insert|update|delete)[^;]*to (anon|authenticated)/i.test(sql));
});

test("el panel tiene las secciones «Videos gratis» y «Documentos gratis» con las reglas de tamaño y tipo", () => {
  const js = fs.readFileSync(path.join(root, "assets/fa-panel-gratis.js"), "utf8");
  const mapa = fs.readFileSync(path.join(root, "assets/fa-panel-mapa.js"), "utf8");
  assert.match(mapa, /Videos gratis/); assert.match(mapa, /Documentos gratis/);
  assert.match(js, /free-upload-url/); assert.match(js, /free-save/); assert.match(js, /free-update/); assert.match(js, /free-delete/);
  assert.match(js, /"Agregar video de YouTube"|Agregar video de YouTube/); assert.match(js, /Subir video corto/); assert.match(js, /Subir documento/);
  assert.match(js, /revisar\(f, VIDEO, 50/); assert.match(js, /revisar\(f, DOC, 50/);
  assert.match(js, /Súbelo a YouTube y usa «Agregar video de YouTube»/);
  assert.match(js, /Mejor ocultarlo/);
});
