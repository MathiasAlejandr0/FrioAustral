/* Textos del sitio: el aplicador no toca el HTML original si no hay cambio, pinta con textContent
   (nunca innerHTML) y la API solo publica lo que un admin guardó. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const A = require("../assets/fa-aplicar-textos.js");
const TX = require("../assets/fa-textos.js");
const H = require("./lib-html-textos.js");
const { checkSiteText } = require("../api/_lib/content.js");

function el() {
  const node = {
    children: [], writes: [],
    set textContent(v) { this._text = String(v); this.children = v ? [{ tag: "text", textContent: String(v) }] : []; this.writes.push(["text", String(v)]); },
    get textContent() { return this._text || this.children.map((c) => c.textContent || "").join(""); },
    set innerHTML(v) { this.writes.push(["html", v]); },
    get innerHTML() { return ""; },
    replaceChildren() { this.children = []; this._text = ""; this.writes.push(["clear"]); },
    appendChild(n) { this.children.push(n); this.writes.push(["add", n.tag || "text", n.textContent || ""]); return n; },
    getAttribute(n) { return n === "data-edit" ? this.idEdit : ""; },
  };
  return node;
}
function docDe(nodos) {
  return {
    createElement(tag) { const n = el(); n.tag = tag; return n; },
    createTextNode(v) { return { tag: "text", textContent: v }; },
    querySelectorAll() { return nodos; },
  };
}

test("sin cambios, el texto original queda igual", () => {
  const nodo = el(); nodo.idEdit = "inicio.portada.1"; nodo.textContent = "Academia online · Video + PDF";
  assert.equal(A.aplicarTodos(docDe([nodo]), {}), 0);
  assert.equal(A.aplicarTodos(docDe([nodo]), { "otra.pagina.1": { body: "Otro" } }), 0);
  assert.equal(A.aplicarTodos(docDe([nodo]), { "inicio.portada.1": { body: "" } }), 0);
  assert.equal(nodo.textContent, "Academia online · Video + PDF");
  assert.ok(!nodo.writes.some((w) => w[0] === "html"));
});

test("un texto publicado reemplaza con textContent y un id que no está en la página se ignora", () => {
  const nodo = el(); nodo.idEdit = "inicio.portada.1"; nodo.textContent = "Original";
  const doc = docDe([nodo]);
  assert.equal(A.aplicarTodos(doc, { "inicio.portada.9": { body: "No está" }, "inicio.portada.1": { body: "Texto de prueba" } }), 1);
  assert.equal(nodo.textContent, "Texto de prueba");
  assert.deepEqual(nodo.writes.filter((w) => w[0] === "html"), []);
  assert.ok(nodo.writes.some((w) => w[0] === "text" && w[1] === "Texto de prueba"));
});

test("el HTML que peguen queda como texto, la negrita es un strong y el salto es un br", () => {
  const malo = el();
  A.aplicar(malo, "<img src=x onerror=alert(1)>", docDe([]));
  assert.equal(malo.textContent, "<img src=x onerror=alert(1)>");
  assert.deepEqual(malo.writes.filter((w) => w[0] === "html"), []);

  const box = el();
  const doc = docDe([]);
  A.aplicar(box, "Hola **taller**\nlisto", doc);
  assert.ok(box.writes.some((w) => w[0] === "clear"));
  assert.ok(box.children.some((n) => n.tag === "strong" && n.textContent === "taller"));
  assert.ok(box.children.some((n) => n.tag === "br"));
  assert.ok(box.children.some((n) => n.tag === "text" && n.textContent === "Hola "));
  assert.deepEqual(box.writes.filter((w) => w[0] === "html"), []);
});

test("cada data-edit del HTML está en el catálogo y el texto coincide; no queda ninguno sin marca", () => {
  const vistos = new Set();
  for (const [file, page] of H.PAGINAS) {
    const html = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.deepEqual(H.sinMarca(html), [], file);
    assert.ok(html.includes("assets/fa-aplicar-textos.js"), file);
    const root = H.parse(html);
    (function walk(nodo) {
      if (!nodo || nodo.type !== "el") return;
      const m = /data-edit="([^"]+)"/.exec(nodo.attr || "");
      if (m) {
        const t = TX.byId(m[1]);
        assert.ok(t, m[1]);
        assert.ok(t.paginas.includes(page), `${m[1]} no está en ${page}`);
        assert.equal(H.norm(H.textOf(nodo)), t.texto, m[1]);
        vistos.add(m[1]);
      }
      for (const c of nodo.children) walk(c);
    })(root);
  }
  for (const t of TX.TEXTOS) assert.ok(vistos.has(t.id), t.id);
  assert.equal(TX.TEXTOS.length, vistos.size);
});

test("el catálogo rechaza un id desconocido, HTML, el nombre del pago y un texto más largo que su tope", () => {
  assert.equal(checkSiteText("inicio.portada.1", "  Academia online · Video + PDF  ").reset, true);
  assert.throws(() => checkSiteText("no.existe.1", "Hola"), (e) => e.code === "bad_id");
  assert.throws(() => checkSiteText("inicio.portada.1", "<b>Hola</b>"), (e) => e.code === "bad_html");
  assert.throws(() => checkSiteText("inicio.portada.1", "Paga en Hotmart"), (e) => e.code === "bad_text");
  const largo = "a".repeat(TX.byId("inicio.portada.1").max + 1);
  assert.throws(() => checkSiteText("inicio.portada.1", largo), (e) => e.code === "too_long");
});

/* ---- API con Supabase simulado ---- */
process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.ADMIN_EMAILS = "equipo@test.cl";
process.env.SITE_URL = "https://sitio.test";

const U = {
  admin: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "equipo@test.cl" },
  apr: { id: "11111111-1111-4111-8111-111111111111", email: "apr@test.cl" },
};
let db;
function reset() { db = { admins: [], site_texts: [], subscribers: [] }; }
global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, data) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(data), json: async () => data });
  if (u.pathname === "/auth/v1/user") {
    const who = Object.values(U).find((x) => init.headers.Authorization === `Bearer t-${x.id}`);
    return who ? json(200, who) : json(401, {});
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const tabla = u.pathname.split("/").pop();
    if (db.fallar === tabla) return json(500, { message: 'relation "site_texts" does not exist' });
    const rows = db[tabla];
    const method = init.method || "GET";
    const sel = () => rows.filter((r) => [...u.searchParams].every(([k, v]) => {
      if (["select", "order", "limit", "on_conflict"].includes(k)) return true;
      const [op, val] = [v.split(".")[0], v.split(".").slice(1).join(".")];
      if (op === "eq") return String(r[k]) === val;
      if (op === "neq") return String(r[k]) !== val;
      return true;
    }));
    if (method === "GET") return json(200, sel());
    if (method === "POST") {
      const key = u.searchParams.get("on_conflict") || "id";
      const out = JSON.parse(init.body).map((r) => {
        const ex = rows.find((x) => x[key] === r[key]);
        if (ex) { Object.assign(ex, r); return ex; }
        rows.push(r); return r;
      });
      return json(201, out);
    }
    if (method === "PATCH") { const out = sel(); out.forEach((r) => Object.assign(r, JSON.parse(init.body))); return json(200, out); }
    if (method === "DELETE") { sel().forEach((r) => rows.splice(rows.indexOf(r), 1)); return json(204, null); }
  }
  return json(404, {});
};
const admin = require("../api/admin.js");
const account = require("../api/account.js");
function call(mod, { method = "GET", url, body, as = "admin" }) {
  return new Promise((resolve) => {
    const req = { method, url, headers: { authorization: as ? `Bearer t-${U[as].id}` : "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(d) { resolve({ status: this.statusCode, headers: this.headers, body: d ? JSON.parse(d) : null }); } };
    mod(req, res).catch((e) => resolve({ status: e.status || 500, body: { message: e.message, code: e.code } }));
  });
}
beforeEach(reset);

test("solo un admin publica, guarda el anterior y el sitio público no muestra un borrador", async () => {
  assert.equal((await call(admin, { url: "/api/admin?action=texts", as: "apr" })).status, 403);
  const id = "inicio.portada.1";
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=texts-save", body: { id, body: "<b>no</b>" } })).body.code, "bad_html");
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=texts-save", body: { id, body: "Primero" } })).status, 200);
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=texts-save", body: { id, body: "Segundo" } })).status, 200);
  const lista = await call(admin, { url: "/api/admin?action=texts" });
  assert.equal(lista.body.items[0].body, "Segundo");
  assert.equal(lista.body.items[0].hasPrevious, true);
  db.site_texts.push({ id: "inicio.portada.2", body: "oculto", previous: null, published: false, updated_at: "x" });
  const pub = await call(account, { url: "/api/account?action=site-texts", as: null });
  assert.equal(pub.body.items[id].body, "Segundo");
  assert.equal(pub.body.items["inicio.portada.2"], undefined, "lo no publicado no sale");
  assert.equal(pub.headers["Cache-Control"].includes("public"), true);
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=texts-restore-previous", body: { id } })).body.body, "Primero");
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=texts-restore-previous", body: { id } })).status, 404);
  assert.equal((await call(admin, { method: "POST", url: "/api/admin?action=texts-reset", body: { id } })).status, 200);
  assert.deepEqual((await call(account, { url: "/api/account?action=site-texts", as: null })).body.items, {});
});

test("si la base no responde, el sitio público sigue con el HTML original", async () => {
  db.fallar = "site_texts";
  const pub = await call(account, { url: "/api/account?action=site-texts", as: null });
  assert.equal(pub.status, 200);
  assert.deepEqual(pub.body.items, {});
});

test("la migración de textos es aditiva, lee solo lo publicado y escribe solo si fa_is_admin", () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase/migrations/20261120120000_textos_del_sitio.sql"), "utf8").replace(/--.*$/gm, "");
  assert.equal(path.basename(path.join(__dirname, "..", "supabase/migrations/20261120120000_textos_del_sitio.sql")), "20261120120000_textos_del_sitio.sql");
  assert.ok(!/\bdrop\s+table\b|\bdelete\s+from\b|\btruncate\s+table\b/i.test(sql));
  assert.match(sql, /alter table public\.site_texts enable row level security/);
  assert.match(sql, /for select to anon, authenticated\s+using \(published\)/);
  assert.match(sql, /public\.fa_is_admin\(\)/);
  assert.ok(!/grant\s+(insert|update|delete)[^;]*\bto\s+anon\b/i.test(sql));
  assert.match(sql, /grant insert, update, delete on public\.site_texts to authenticated/);
});
