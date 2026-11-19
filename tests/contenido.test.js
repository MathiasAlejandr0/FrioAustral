/* Material por plan, fotos/videos del sitio y accesos por plan (respaldo manual): reglas y control de acceso.
   Supabase (rest y storage) simulado, sin red. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.ADMIN_EMAILS = "equipo@test.cl";
process.env.SITE_URL = "https://sitio.test";

const root = path.join(__dirname, "..");
const U = {
  admin: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "equipo@test.cl" },
  apr: { id: "11111111-1111-4111-8111-111111111111", email: "apr@test.cl" },
  prem: { id: "22222222-2222-4222-8222-222222222222", email: "prem@test.cl" },
  old: { id: "33333333-3333-4333-8333-333333333333", email: "old@test.cl" },
};
const MAT_E = "99999999-9999-4999-8999-999999999991", MAT_G = "99999999-9999-4999-8999-999999999992";
let db, files, removed;

function reset() {
  const fut = "2099-12-01T03:00:00Z";
  db = {
    admins: [],
    subscribers: [
      { user_id: U.apr.id, email: U.apr.email, plan: "basico", status: "activa", period_end: fut },
      { user_id: U.prem.id, email: U.prem.email, plan: "premium", status: "activa", period_end: fut },
      { user_id: U.old.id, email: U.old.email, plan: "premium", status: "activa", period_end: "2020-01-01T00:00:00Z" },
    ],
    plan_materials: [
      { id: MAT_E, title: "Ebook", description: "", category: "ebook", storage_path: `${MAT_E}/ebook.pdf`, file_name: "ebook.pdf", content_type: "application/pdf", size_bytes: 10, plans: ["premium"], published: true, created_at: "2026-11-19T00:00:00Z" },
      { id: MAT_G, title: "Guía", description: "", category: "guia", storage_path: `${MAT_G}/guia.pdf`, file_name: "guia.pdf", content_type: "application/pdf", size_bytes: 10, plans: ["basico", "pro", "premium"], published: true, created_at: "2026-11-18T00:00:00Z" },
    ],
    site_media: [],
    plan_access: [],
    hotmart_events: [],
  };
  files = new Set([`plan-material/${MAT_E}/ebook.pdf`, `plan-material/${MAT_G}/guia.pdf`]);
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
      if (op === "eq") return String(r[k]) === val;
      if (op === "cs") return (r[k] || []).includes(val.replace(/[{}]/g, ""));
      return true;
    }));
    if (method === "GET") return json(200, sel());
    if (method === "POST") {
      const key = u.searchParams.get("on_conflict");
      const out = JSON.parse(init.body).map((r) => { const ex = key && rows.find((x) => x[key] === r[key]); if (ex) { Object.assign(ex, r); return ex; } const n = { id: require("node:crypto").randomUUID(), created_at: "now", ...r }; rows.push(n); return n; });
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
beforeEach(reset);

test("cada suscriptor ve solo el material de su plan", async () => {
  const apr = await call(account, { url: "/api/account?action=materials", as: "apr" });
  assert.deepEqual(apr.body.items.map((m) => m.title), ["Guía"]);
  const prem = await call(account, { url: "/api/account?action=materials", as: "prem" });
  assert.deepEqual(prem.body.items.map((m) => m.title).sort(), ["Ebook", "Guía"]);
  assert.ok(prem.body.items.every((m) => !("storage_path" in m) && !("path" in m)), "la lista no expone rutas de Storage");
});

test("descarga: URL firmada solo si el material es de tu plan y tu suscripción está vigente", async () => {
  const ok = await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_E }, as: "prem" });
  assert.equal(ok.status, 200);
  assert.match(ok.body.url, /^https:\/\/db\.test\/storage\/v1\/object\/sign\/plan-material\/.+token=SIG&download=ebook\.pdf$/);
  assert.equal((await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_E }, as: "apr" })).status, 404, "Aprendiz no accede al ebook Premium");
  assert.equal((await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_G }, as: "old" })).status, 403, "suscripción vencida");
  assert.equal((await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_G } })).status, 401, "sin sesión");
  db.plan_materials[0].published = false;
  assert.equal((await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_E }, as: "prem" })).status, 404, "material oculto");
  assert.equal((await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: "no-uuid" }, as: "prem" })).status, 400);
});


test("material-url con inline:true abre PDF/imagen en pestaña (sin &download) y los demás tipos siguen descargándose", async () => {
  const pdf = await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_E, inline: true }, as: "prem" });
  assert.match(pdf.body.url, /token=SIG$/);
  assert.doesNotMatch(pdf.body.url, /download=/);
  db.plan_materials[0].content_type = "application/zip"; db.plan_materials[0].file_name = "ebook.zip";
  const zip = await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_E, inline: true }, as: "prem" });
  assert.match(zip.body.url, /download=ebook\.zip$/);
  const sinInline = await call(account, { method: "POST", url: "/api/account?action=material-url", body: { id: MAT_G, inline: "yes" }, as: "prem" });
  assert.match(sinInline.body.url, /download=guia\.pdf$/);
});

test("el panel de contenido exige ser del equipo", async () => {
  for (const a of ["materials", "media"]) assert.equal((await call(admin, { url: `/api/admin?action=${a}`, as: "prem" })).status, 403);
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=material-upload-url", body: { fileName: "a.pdf", contentType: "application/pdf", size: 5 }, as: "apr" })).status, 403);
  assert.equal((await call(admin, { url: "/api/admin?action=materials", as: "admin" })).status, 200);
});

test("subir material: valida tipo, tamaño, ruta y que el archivo exista; guarda planes", async () => {
  const bad = (b) => call(admin, { method: "POST", url: "/api/admin?action=material-upload-url", body: b, as: "admin" });
  assert.equal((await bad({ fileName: "a.exe", contentType: "application/x-msdownload", size: 5 })).status, 400);
  assert.equal((await bad({ fileName: "a.pdf", contentType: "text/html", size: 5 })).status, 400);
  assert.equal((await bad({ fileName: "a.pdf", contentType: "application/pdf", size: 51 * 1024 * 1024 })).status, 413);
  const up = await bad({ fileName: "Guía Técnica R134a.pdf", contentType: "application/pdf", size: 2048 });
  assert.equal(up.status, 200);
  assert.equal(up.body.bucket, "plan-material");
  assert.equal(up.body.token, "TKN");
  assert.match(up.body.path, /^[0-9a-f-]{36}\/Guia-Tecnica-R134a\.pdf$/);
  const save = (b) => call(admin, { method: "POST", url: "/api/admin?action=material-save", as: "admin", body: { path: up.body.path, fileName: "Guía Técnica R134a.pdf", contentType: "application/pdf", size: 2048, title: "Guía R134a", category: "guia", plans: ["pro", "premium"], ...b } });
  assert.equal((await save({})).status, 400, "el archivo aún no está en Storage");
  files.add(`plan-material/${up.body.path}`);
  assert.equal((await save({ path: "../x.pdf" })).status, 400);
  assert.equal((await save({ plans: [] })).status, 400);
  assert.equal((await save({ plans: ["oro"] })).status, 400);
  assert.equal((await save({ title: "  " })).status, 400);
  const ok = await save({});
  assert.equal(ok.status, 201);
  const row = db.plan_materials.find((m) => m.title === "Guía R134a");
  assert.deepEqual(row.plans, ["pro", "premium"]);
  assert.equal(row.created_by, U.admin.id);
  // el plan Técnico ya lo ve; Aprendiz no
  const pro = db.subscribers[0]; pro.plan = "pro";
  assert.ok((await call(account, { url: "/api/account?action=materials", as: "apr" })).body.items.some((m) => m.title === "Guía R134a"));
  pro.plan = "basico";
  assert.ok(!(await call(account, { url: "/api/account?action=materials", as: "apr" })).body.items.some((m) => m.title === "Guía R134a"));
});

test("editar y eliminar material (borra también el archivo)", async () => {
  const upd = await call(admin, { method: "POST", url: "/api/admin?action=material-update", as: "admin", body: { id: MAT_E, title: "Ebook v2", category: "ebook", plans: ["pro", "premium"], published: true } });
  assert.equal(upd.status, 200);
  assert.deepEqual(db.plan_materials[0].plans, ["pro", "premium"]);
  const del = await call(admin, { method: "POST", url: "/api/admin?action=material-delete", as: "admin", body: { id: MAT_E } });
  assert.equal(del.status, 200);
  assert.equal(db.plan_materials.length, 1);
  assert.deepEqual(removed, [`${MAT_E}/ebook.pdf`]);
});

test("fotos y videos: espacios del catálogo, tipos por espacio, guardar, reemplazar y volver al original", async () => {
  const up = (b) => call(admin, { method: "POST", url: "/api/admin?action=media-upload-url", as: "admin", body: b });
  assert.equal((await up({ slot: "no-existe", fileName: "a.png", contentType: "image/png", size: 5 })).status, 400);
  assert.equal((await up({ slot: "inicio-curso", fileName: "a.mp4", contentType: "video/mp4", size: 5 })).status, 400, "video en espacio de foto");
  assert.equal((await up({ slot: "inicio-portada-video", fileName: "a.png", contentType: "image/png", size: 5 })).status, 400, "foto en espacio de video");
  assert.equal((await up({ slot: "inicio-curso", fileName: "a.png", contentType: "image/png", size: 13 * 1024 * 1024 })).status, 413);
  const r = await up({ slot: "inicio-curso", fileName: "Foto Curso.PNG", contentType: "image/png", size: 5000 });
  assert.equal(r.status, 200);
  assert.equal(r.body.bucket, "site-media");
  assert.match(r.body.path, /^inicio-curso\/\d{13}-Foto-Curso\.png$/);
  const save = (path, extra) => call(admin, { method: "POST", url: "/api/admin?action=media-save", as: "admin", body: { slot: "inicio-curso", path, fileName: "Foto Curso.PNG", contentType: "image/png", size: 5000, alt: "Curso", ...extra } });
  assert.equal((await save(r.body.path)).status, 400, "no se subió");
  files.add(`site-media/${r.body.path}`);
  assert.equal((await save("taller-nosotros/1795100000000-x.png")).status, 400, "ruta de otro espacio");
  assert.equal((await save(r.body.path)).status, 200);
  assert.equal(db.site_media.length, 1);
  // público: lo ve cualquiera, sin sesión
  const pub = await call(account, { url: "/api/account?action=site-media" });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.items["inicio-curso"].url, `https://db.test/storage/v1/object/public/site-media/${r.body.path}`);
  assert.equal(pub.body.items["inicio-curso"].kind, "image");
  // reemplazar borra el archivo anterior
  const r2 = await up({ slot: "inicio-curso", fileName: "otra.png", contentType: "image/png", size: 100 });
  files.add(`site-media/${r2.body.path}`);
  assert.equal((await save(r2.body.path)).status, 200);
  assert.equal(db.site_media.length, 1);
  assert.deepEqual(removed, [r.body.path]);
  // volver al original
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=media-reset", as: "admin", body: { slot: "inicio-curso" } })).status, 200);
  assert.equal(db.site_media.length, 0);
  assert.deepEqual((await call(account, { url: "/api/account?action=site-media" })).body.items, {});
});

test("accesos por plan: lista, respaldo manual por correo, quitar y vigencia", async () => {
  const grant = (b) => call(admin, { method: "POST", url: "/api/admin?action=access-grant", as: "admin", body: b });
  assert.equal((await grant({ email: U.apr.email, plan: "oro", until: "2099-01-01" })).status, 400);
  assert.equal((await grant({ email: "no-es-correo", plan: "pro", until: "2099-01-01" })).status, 400);
  assert.equal((await grant({ email: U.apr.email, plan: "pro", until: "2020-01-01" })).status, 400);
  assert.equal((await grant({ email: U.apr.email, plan: "pro", until: "31/12/2099" })).status, 400);
  assert.equal((await call(admin, { url: "/api/admin?action=access-list", as: "apr" })).status, 403, "solo el equipo");
  const until = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const ok = await grant({ email: "  APR@test.cl ", plan: "premium", until });
  assert.equal(ok.status, 200);
  assert.equal(db.plan_access.length, 1);
  assert.equal(db.plan_access[0].email, "apr@test.cl");
  assert.equal(db.plan_access[0].source, "manual");
  assert.equal(db.subscribers[0].plan, "premium");
  assert.equal(db.subscribers[0].status, "activa");
  assert.equal(new Date(db.subscribers[0].period_end).getTime(), new Date(`${until}T23:59:59-03:00`).getTime(), "vence al terminar el día elegido (hora de Chile)");
  assert.ok((await call(account, { url: "/api/account?action=materials", as: "apr" })).body.items.some((m) => m.title === "Ebook"), "ya ve el ebook Premium");
  const list = await call(admin, { url: "/api/admin?action=access-list", as: "admin" });
  assert.equal(list.status, 200);
  assert.equal(list.body.items[0].hasAccount, true);
  assert.equal(list.body.items[0].active, true);
  assert.equal(list.body.items[0].planName, "Plan Premium");
  assert.ok(Array.isArray(list.body.events));
  // acceso para un correo que todavía no tiene cuenta
  assert.equal((await grant({ email: "nuevo@test.cl", plan: "pro", until })).status, 200);
  assert.equal((await call(admin, { url: "/api/admin?action=access-list", as: "admin" })).body.items.find((i) => i.email === "nuevo@test.cl").hasAccount, false);
  // vencida por fecha: pierde el acceso
  db.subscribers[0].period_end = "2020-01-01T00:00:00Z";
  assert.equal((await call(account, { url: "/api/account?action=materials", as: "apr" })).status, 403);
  // quitar
  await grant({ email: U.apr.email, plan: "premium", until });
  const id = db.plan_access.find((r) => r.email === U.apr.email).id;
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=access-revoke", as: "admin", body: { id: "no" } })).status, 400);
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=access-revoke", as: "admin", body: { id } })).status, 200);
  assert.equal(db.subscribers[0].status, "cancelada");
  assert.equal((await call(account, { url: "/api/account?action=materials", as: "apr" })).status, 403, "sin acceso tras quitar el plan");
});

test("catálogo de espacios: todos los archivos existen en el sitio y los ids son únicos", () => {
  const { SLOTS } = require("../assets/fa-slots.js");
  assert.equal(new Set(SLOTS.map((s) => s.id)).size, SLOTS.length);
  const sites = fs.readdirSync(root).filter((f) => f.endsWith(".html")).concat(["assets/media.css", "assets/v5.css"]).map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
  for (const s of SLOTS) {
    assert.match(s.id, /^[a-z0-9-]{3,60}$/);
    for (const b of s.bases || []) assert.ok(sites.includes(`media/img/${b}-`), `${s.id}: ${b} no se usa en el sitio`);
    if (s.video) assert.ok(sites.includes(`data-media="${s.video}"`), `${s.id}: video no usado`);
    if (s.css) assert.ok(sites.includes(s.css.slice(1)), `${s.id}: ${s.css} no existe`);
  }
});

test("las páginas públicas cargan el reemplazo de medios y el panel no se indexa", () => {
  for (const f of ["index.html", "taller.html", "cursos.html", "comunidad.html", "gratis.html", "planes.html"]) {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(html.indexOf("assets/fa-slots.js") > -1 && html.indexOf("assets/fa-medios.js") > html.indexOf("assets/fa-slots.js"), f);
  }
  const c = fs.readFileSync(path.join(root, "contenido.html"), "utf8");
  assert.match(c, /name="robots" content="noindex"/);
  assert.match(c, /assets\/fa-auth\.js/);
  assert.match(fs.readFileSync(path.join(root, "vercel.json"), "utf8"), /mi-cuenta\|equipo\|admin\|contenido/);
});

test("migración: aditiva, con RLS, bucket de material privado y sin permisos de escritura para el navegador", () => {
  const dir = path.join(root, "supabase", "migrations");
  const sql = fs.readFileSync(path.join(dir, "20261119120000_material_planes_y_medios.sql"), "utf8").replace(/--.*$/gm, "");
  assert.ok(!/\bdrop\s+(table|column|schema)\b|\bdelete\s+from\b|\btruncate\b|\balter\s+table\s+\S+\s+drop\b/i.test(sql), "solo cambios aditivos");
  assert.match(sql, /alter table public\.plan_materials enable row level security/);
  assert.match(sql, /alter table public\.site_media enable row level security/);
  assert.match(sql, /'plan-material', 'plan-material', false/);
  assert.match(sql, /'site-media', 'site-media', true/);
  assert.ok(!/grant\s+(insert|update|delete)[^;]*\bto\s+(anon|authenticated)\b/i.test(sql), "el navegador no escribe");
  assert.ok(!/on storage\.objects\s+for\s+(insert|update|delete|all)/i.test(sql));
});
