/* Videollamadas del Plan Premium: permisos, salas privadas y flujo de agenda. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.SITE_URL = "https://sitio.test";
process.env.ADMIN_EMAILS = "equipo@test.cl";

const USERS = {
  pro: { id: "11111111-1111-1111-1111-111111111111", email: "pro@test.cl" },
  otro: { id: "33333333-3333-3333-3333-333333333333", email: "otro@test.cl" },
  team: { id: "99999999-9999-9999-9999-999999999999", email: "equipo@test.cl" },
};
let db;
const sub = (u, plan) => ({ user_id: u.id, email: u.email, nombre: u.email, plan, status: "activa", period_start: "2026-11-01T03:00:00Z", period_end: "2099-12-01T03:00:00Z" });
beforeEach(() => {
  db = { subscribers: [sub(USERS.pro, "premium"), sub(USERS.otro, "premium")], videocalls: [], admins: [], messages: [], payments: [] };
});

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, data) => ({ ok: status < 400, status, statusText: "", headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.pathname === "/auth/v1/user") {
    const tok = String(init.headers.Authorization || "").replace("Bearer ", "");
    return USERS[tok] ? json(200, USERS[tok]) : json(401, {});
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const rows = db[u.pathname.split("/").pop()];
    const filt = (list) => {
      let out = list;
      for (const [k, v] of u.searchParams) {
        if (["select", "order", "limit"].includes(k)) continue;
        if (v.startsWith("eq.")) out = out.filter((r) => String(r[k]) === v.slice(3));
        if (v.startsWith("neq.")) out = out.filter((r) => String(r[k]) !== v.slice(4));
        if (v.startsWith("in.(")) { const l = v.slice(4, -1).split(","); out = out.filter((r) => l.includes(String(r[k]))); }
      }
      return out;
    };
    const m = init.method || "GET";
    if (m === "GET") return json(200, filt(rows));
    if (m === "POST") { const add = JSON.parse(init.body).map((r) => ({ id: require("crypto").randomUUID(), created_at: new Date().toISOString(), ...r })); rows.push(...add); return json(201, add); }
    if (m === "PATCH") { const out = filt(rows); out.forEach((r) => Object.assign(r, JSON.parse(init.body))); return json(200, out); }
  }
  return json(404, {});
};

const account = require("../api/account");
const admin = require("../api/admin");
function call(h, { method = "GET", url, body, as }) {
  return new Promise((resolve) => {
    const req = { method, url, headers: { authorization: `Bearer ${as}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, query: Object.fromEntries(new URL(url, "http://x").searchParams) };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(d) { resolve({ status: this.statusCode, body: d ? JSON.parse(d) : null }); } };
    h(req, res);
  });
}
const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const request = (as = "pro", when = inHours(24)) => call(account, { method: "POST", url: "/api/account?action=video-request", body: { when, note: "Compresor" }, as });

test("solo el Plan Premium puede pedir videollamadas (lo valida el servidor)", async () => {
  for (const plan of ["basico", "pro"]) {
    db.subscribers[0].plan = plan;
    const r = await request();
    assert.equal(r.status, 403, plan);
    assert.equal(r.body.code, "not_premium");
  }
  db.subscribers[0].plan = "premium";
  db.subscribers[0].status = "morosa";
  assert.equal((await request()).status, 403);
  assert.equal(db.videocalls.length, 0);
});

test("la sala es aleatoria, la crea el servidor y no se entrega antes de confirmar", async () => {
  const r = await request();
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(db.videocalls[0].room, /^frioaustral-[0-9a-f-]{36}$/);
  assert.equal(r.body.item.room, null);
  assert.equal(r.body.item.url, null);
  await request("pro", inHours(48));
  assert.notEqual(db.videocalls[0].room, db.videocalls[1].room);
});

test("flujo: cliente pide, equipo confirma y ambos ven la sala", async () => {
  const id = (await request()).body.item.id;
  const c = await call(admin, { method: "POST", url: "/api/admin?action=video-confirm", body: { id }, as: "team" });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.item.status, "confirmada");
  const room = db.videocalls[0].room;
  assert.equal(c.body.item.url, "https://meet.jit.si/" + room);
  const mine = await call(account, { url: "/api/account?action=videos", as: "pro" });
  assert.equal(mine.body.items[0].url, "https://meet.jit.si/" + room);
  assert.equal(mine.body.items[0].canJoin, false, "faltan 24 h: todavía no se entra");
});

test("flujo: el equipo propone otra hora y el cliente la acepta", async () => {
  const id = (await request()).body.item.id;
  const when = inHours(30);
  const p = await call(admin, { method: "POST", url: "/api/admin?action=video-propose", body: { id, when }, as: "team" });
  assert.equal(p.body.item.status, "propuesta");
  assert.equal(p.body.item.url, null);
  const a = await call(account, { method: "POST", url: "/api/account?action=video-accept", body: { id }, as: "pro" });
  assert.equal(a.status, 200);
  assert.equal(a.body.item.status, "confirmada");
  assert.equal(a.body.item.scheduledAt, when);
});

test("el botón de entrar se habilita desde 10 minutos antes", () => {
  const V = require("../api/_lib/video");
  const now = Date.parse("2026-11-20T15:00:00Z");
  const at = (min) => ({ status: "confirmada", scheduled_at: new Date(now + min * 60e3).toISOString(), room: "frioaustral-x" });
  assert.equal(V.canJoin(at(11), now), false);
  assert.equal(V.canJoin(at(10), now), true);
  assert.equal(V.canJoin(at(-60), now), true);
  assert.equal(V.canJoin({ ...at(5), status: "solicitada" }, now), false);
});

test("otro usuario no ve ni toca la videollamada ajena, y no es del equipo", async () => {
  const id = (await request()).body.item.id;
  await call(admin, { method: "POST", url: "/api/admin?action=video-confirm", body: { id }, as: "team" });
  const list = await call(account, { url: "/api/account?action=videos", as: "otro" });
  assert.equal(list.body.items.length, 0);
  assert.equal(JSON.stringify(list.body).includes(db.videocalls[0].room), false);
  for (const action of ["video-accept", "video-cancel"]) {
    const r = await call(account, { method: "POST", url: `/api/account?action=${action}`, body: { id }, as: "otro" });
    assert.equal(r.status, 404, action);
  }
  const adm = await call(admin, { url: "/api/admin?action=videos", as: "otro" });
  assert.equal(adm.status, 403);
  assert.equal(db.videocalls[0].status, "confirmada");
});

test("valida la hora propuesta", async () => {
  assert.equal((await request("pro", "no-es-fecha")).body.code, "bad_when");
  assert.equal((await request("pro", inHours(0.1))).body.code, "too_soon");
});

test("la migración deja la tabla sin acceso desde el navegador", () => {
  const sql = require("fs").readFileSync(require("path").join(__dirname, "../supabase/migrations/20261117130000_videollamadas.sql"), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.videocalls from anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/);
});

test("Entrar a la videollamada abre meet.jit.si en una pestaña nueva, sin embeber", () => {
  const fs = require("fs");
  const path = require("path");
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.equal(fs.existsSync(path.join(__dirname, "../assets/fa-jitsi.js")), false);
  for (const f of ["mi-cuenta.html", "equipo.html"]) {
    const html = read(f);
    assert.doesNotMatch(html, /fa-jitsi\.js/);
    assert.doesNotMatch(html, /external_api\.js/);
  }
  assert.doesNotMatch(read("assets/fa-app.css"), /\.fa-jitsi/);
  const note = "Se abre en una pestaña nueva, sin límite de tiempo. El primero del equipo en entrar puede tener que iniciar sesión con Google o GitHub para abrir la sala.";
  for (const f of ["assets/fa-cuenta.js", "assets/fa-equipo.js"]) {
    const js = read(f);
    assert.ok(js.includes(note), f);
    assert.match(js, /target="_blank"/);
    assert.match(js, /rel="noopener"/);
    assert.match(js, /href="\$\{esc\(v\.url\)}"/);
    assert.doesNotMatch(js, /FAJitsi/);
    assert.doesNotMatch(js, /<iframe/);
    assert.doesNotMatch(js, /external_api/);
  }
});
