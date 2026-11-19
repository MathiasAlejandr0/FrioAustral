/* Pruebas de los arreglos de la auditoría de seguridad y calidad (nov-2026). Sin red: Supabase simulado. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
delete process.env.ADMIN_EMAILS;

const ROOT = path.join(__dirname, "..");
const USER = { id: "11111111-1111-1111-1111-111111111111", email: "cliente@test.cl" };
let restMode = "ok";

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, data) => ({ ok: status < 400, status, statusText: "", headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.pathname === "/auth/v1/user") return init.headers.Authorization === "Bearer good" ? json(200, USER) : json(401, {});
  if (u.pathname.startsWith("/rest/v1/admins")) return json(200, [{ user_id: USER.id }]);
  if (restMode === "fail") return json(400, { code: "42703", message: 'column subscribers.secreto_interno does not exist' });
  if (u.pathname.startsWith("/rest/v1/subscribers")) return json(200, [{ user_id: USER.id, email: USER.email, plan: "basico", status: "activa", period_end: "2099-01-01T00:00:00Z" }]);
  return json(200, []);
};

const account = require("../api/account");
const admin = require("../api/admin");
const { communityItems, MAX_ITEMS } = require("../api/_lib/community");

function call(handler, url, { method = "GET", token = "good", timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sin respuesta en ${timeoutMs} ms: ${url}`)), timeoutMs);
    const req = { method, url, headers: { authorization: `Bearer ${token}` }, query: Object.fromEntries(new URL(url, "http://x").searchParams), body: method === "POST" ? {} : undefined };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(d) { clearTimeout(timer); resolve({ status: this.statusCode, body: d ? JSON.parse(d) : null }); } };
    handler(req, res);
  });
}

test("acciones con nombre de propiedad de Object (constructor, toString, __proto__) responden 404 y no dejan la función colgada", async () => {
  for (const action of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
    const a = await call(account, `/api/account?action=${action}`);
    assert.equal(a.status, 404, `account ${action}`);
    assert.equal(a.body.code, "not_found");
    const b = await call(admin, `/api/admin?action=${action}`);
    assert.equal(b.status, 404, `admin ${action}`);
  }
});

test("un error de la base de datos no muestra tablas ni columnas al navegador", async () => {
  restMode = "fail";
  try {
    const r = await call(account, "/api/account?action=me");
    assert.equal(r.status, 500);
    assert.equal(r.body.code, "db_error");
    const blob = JSON.stringify(r.body);
    assert.ok(!/secreto_interno|column|subscribers|42703|Base de datos:/i.test(blob), blob);
  } finally { restMode = "ok"; }
});

/* Implementación anterior (cuadrática), para comprobar que el resultado no cambió. */
function communityOld(rows, q = "") {
  const sorted = rows.slice().sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)) || String(a.created_at).localeCompare(String(b.created_at)));
  const items = [];
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (m.sender !== "cliente") continue;
    const reply = sorted.slice(i + 1).find((x) => x.user_id === m.user_id && x.sender === "equipo");
    const nextQ = sorted.slice(i + 1).find((x) => x.user_id === m.user_id && x.sender === "cliente");
    if (!reply || (nextQ && new Date(nextQ.created_at) < new Date(reply.created_at))) continue;
    if (q && !(m.body.toLowerCase().includes(q) || reply.body.toLowerCase().includes(q))) continue;
    items.push({ pregunta: String(m.body || ""), respuesta: String(reply.body || ""), fecha: reply.created_at });
  }
  items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return items.slice(0, 60);
}

test("preguntas de otros: el recorrido lineal da exactamente lo mismo que el algoritmo anterior", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let run = 0; run < 200; run++) {
    const rows = [];
    const users = ["a", "b", "c", "d"].map((x) => x.repeat(8) + "-0000-0000-0000-000000000000");
    let t = Date.UTC(2026, 10, 1);
    const n = Math.floor(rnd() * 40);
    for (let i = 0; i < n; i++) {
      t += rnd() < 0.1 ? 0 : 1000 + Math.floor(rnd() * 100000);
      rows.push({ user_id: users[Math.floor(rnd() * users.length)], sender: rnd() < 0.55 ? "cliente" : "equipo", body: rnd() < 0.3 ? "Compresor R134a" : "presión baja", created_at: new Date(t).toISOString() });
    }
    rows.reverse(); /* la API ahora los pide del más nuevo al más antiguo */
    for (const q of ["", "r134a", "nada"]) assert.deepEqual(communityItems(rows, q), communityOld(rows, q), `run ${run} q=${q}`);
  }
});

test("preguntas de otros: casos puntuales y tope de resultados", () => {
  const U = "22222222-2222-2222-2222-222222222222";
  const at = (h) => new Date(Date.UTC(2026, 10, 1, h)).toISOString();
  assert.deepEqual(communityItems([
    { user_id: U, sender: "cliente", body: "Primera", created_at: at(1) },
    { user_id: U, sender: "cliente", body: "Segunda", created_at: at(2) },
    { user_id: U, sender: "equipo", body: "Respuesta", created_at: at(3) },
    { user_id: U, sender: "equipo", body: "Otra respuesta", created_at: at(4) },
    { user_id: U, sender: "cliente", body: "Sin respuesta", created_at: at(5) },
  ]), [{ pregunta: "Segunda", respuesta: "Respuesta", fecha: at(3) }]);
  const many = [];
  for (let i = 0; i < 100; i++) many.push({ user_id: U, sender: "cliente", body: "p" + i, created_at: at(i * 2) }, { user_id: U, sender: "equipo", body: "r" + i, created_at: at(i * 2 + 1) });
  const out = communityItems(many);
  assert.equal(out.length, MAX_ITEMS);
  assert.equal(out[0].pregunta, "p99");
  assert.deepEqual(communityItems(null), []);
});

test("cabeceras de seguridad: CSP mínima, anti-iframe ajeno y las del panel ganan (van después de la regla general)", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const idx = (src) => cfg.headers.findIndex((h) => h.source === src);
  const get = (src, key) => (cfg.headers[idx(src)].headers.find((h) => h.key === key) || {}).value;
  const all = "/(.*)", panel = "/(mi-cuenta|equipo|admin|contenido).html";
  assert.ok(idx(all) !== -1 && idx(panel) !== -1);
  /* En Vercel, si dos reglas ponen la misma cabecera, queda la de la regla que va después. */
  assert.ok(idx(panel) > idx(all), "la regla de los paneles debe ir después de la general");
  assert.equal(get(all, "X-Content-Type-Options"), "nosniff");
  assert.equal(get(all, "X-Frame-Options"), "SAMEORIGIN"); /* el panel muestra las páginas en un iframe del mismo sitio */
  assert.match(get(all, "Content-Security-Policy"), /frame-ancestors 'self'/);
  assert.match(get(all, "Content-Security-Policy"), /object-src 'none'/);
  assert.match(get(all, "Content-Security-Policy"), /base-uri 'self'/);
  assert.match(get(all, "Permissions-Policy"), /camera=\(\)/);
  assert.equal(get(panel, "X-Frame-Options"), "DENY");
  assert.match(get(panel, "Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.equal(get(panel, "Referrer-Policy"), "same-origin");
  assert.equal(get(panel, "Cache-Control"), "no-store");
  assert.equal(get("/api/(.*)", "Cache-Control"), "no-store");
  /* las redirecciones del panel siguen iguales */
  assert.deepEqual(cfg.redirects.map((r) => [r.source, r.destination]), [
    ["/admin", "/equipo.html"], ["/admin.html", "/equipo.html"],
    ["/contenido", "/equipo.html#/paginas/inicio"], ["/contenido.html", "/equipo.html#/paginas/inicio"],
  ]);
});

test(".vercelignore deja fuera del sitio las pruebas, migraciones y scripts de demo, pero no lo que usa el sitio", () => {
  const lines = fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  for (const p of ["/tests", "/tests-e2e", "/docs", "/supabase", "/servidor_demo.py", "/servidor_demo.ps1", "/rangeserver.py", "/GUIA_DEMO.txt"]) assert.ok(lines.includes(p), p);
  for (const keep of ["/api", "/assets", "/media", "/index.html", "/vercel.json"]) assert.ok(!lines.some((l) => keep === l || keep.startsWith(l + "/")), keep);
  for (const l of lines) assert.ok(fs.existsSync(path.join(ROOT, l)), `la ruta ignorada existe: ${l}`);
  /* las funciones solo dependen de /api y /assets */
  for (const f of fs.readdirSync(path.join(ROOT, "api"), { recursive: true }).filter((f) => f.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(ROOT, "api", f), "utf8");
    for (const m of src.matchAll(/require\("(\.[^"]+)"\)/g)) {
      const target = path.relative(ROOT, path.resolve(path.join(ROOT, "api", path.dirname(f)), m[1]));
      assert.ok(/^(api|assets)[\\/]/.test(target), `${f} usa ${target}`);
    }
  }
});

test("supabase-js desde el CDN se carga con integridad (SRI) y versión fija", () => {
  const src = fs.readFileSync(path.join(ROOT, "assets", "fa-auth.js"), "utf8");
  assert.match(src, /supabase-js@\d+\.\d+\.\d+\/dist\/umd\/supabase\.js/);
  assert.match(src, /const SDK_SRI = "sha384-[A-Za-z0-9+/]{64}"/);
  assert.match(src, /s\.integrity = SDK_SRI/);
  assert.match(src, /s\.crossOrigin = "anonymous"/);
});

test("la suite E2E del panel no carga las pruebas de Mi cuenta (cada una tiene su propio Playwright)", () => {
  const cfg = fs.readFileSync(path.join(ROOT, "tests-e2e", "playwright.config.js"), "utf8");
  assert.match(cfg, /testIgnore:.*"mi-cuenta\/\*\*"/, "testIgnore debe excluir mi-cuenta/**");
});

test("el límite de 64 KiB también se aplica a JSON preparseado por Vercel, strings y Buffer, en bytes UTF-8", async () => {
  const { readBody } = require("../api/_lib/http");
  const headers = { "content-type": "application/json" };
  for (const body of [{ note: "a".repeat(65536) }, '{"x":"' + "a".repeat(65536) + '"}', Buffer.from('{"x":"' + "ñ".repeat(32768) + '"}')]) {
    await assert.rejects(readBody({ headers, body }), (e) => e.status === 413 && e.code === "too_large");
  }
  assert.deepEqual(await readBody({ headers, body: { x: "sí" } }), { x: "sí" });
  assert.deepEqual(await readBody({ headers, body: '{"x":"sí"}' }), { x: "sí" });
  assert.deepEqual(await readBody({ headers: { "content-type": "application/x-www-form-urlencoded" }, body: "x=s%C3%AD" }), { x: "sí" });
});

test("el lector rechaza arrays, null y escalares con 400, en vez de terminar en TypeError/500", async () => {
  const { readBody } = require("../api/_lib/http");
  const headers = { "content-type": "application/json" };
  for (const body of [[], 4, true, "null", "[]", '"hola"', "1", "true"]) {
    await assert.rejects(readBody({ headers, body }), (e) => e.status === 400 && e.code === "bad_body", String(body));
  }
  await assert.rejects(readBody({ headers, body: "{" }), (e) => e.status === 400 && e.code === "bad_json");
});

test("el lector limita también el stream y devuelve 400 para JSON null leído desde el stream", async () => {
  const { Readable } = require("stream");
  const { readBody } = require("../api/_lib/http");
  const req = (text) => { const r = Readable.from([Buffer.from(text)]); r.headers = { "content-type": "application/json" }; return r; };
  assert.deepEqual(await readBody(req('{"x":1}')), { x: 1 });
  await assert.rejects(readBody(req('"' + "a".repeat(65536) + '"')), (e) => e.status === 413);
  await assert.rejects(readBody(req("null")), (e) => e.status === 400 && e.code === "bad_body");
});

test("la migración propuesta solo quita TRUNCATE/REFERENCES/TRIGGER a anon y authenticated (no toca datos ni políticas)", () => {
  const sql = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20261120000000_revocar_privilegios_sobrantes.sql"), "utf8").replace(/--.*$/gm, "").trim();
  assert.match(sql, /^revoke truncate, references, trigger on[\s\S]+from anon, authenticated;$/);
  assert.ok(!/\b(delete|drop|insert|update|alter|grant|policy)\b/i.test(sql.replace(/^revoke truncate, references, trigger on/, "")));
  for (const t of ["plan_materials", "site_media", "admins", "subscribers", "messages", "payments", "videocalls", "plan_access", "hotmart_events", "free_resources"]) assert.ok(sql.includes(`public.${t}`), t);
});

test("accesibilidad: acordeón cerrado inerte, logo sin deformar, nombre accesible de la marca contiene su texto visible", () => {
  const store = fs.readFileSync(path.join(ROOT, "assets", "fa-store.js"), "utf8");
  assert.match(store, /\.inert\s*=\s*true/);
  assert.match(store, /\.inert\s*=\s*!on/);
  assert.match(fs.readFileSync(path.join(ROOT, "assets", "site.css"), "utf8"), /\.brand img\{[^}]*object-fit:contain/);
  for (const f of ["fa-panel.css", "fa-cuenta-panel.css"]) assert.match(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"), /img\[src\*="logo-frio-austral"\]\s*\{\s*object-fit:\s*contain/);
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!html.includes('aria-label="Frío Austral, inicio"'), f);
  }
});
