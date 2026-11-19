/* Webhook de Hotmart: autenticación por hottok, mapeo producto→plan, activar/desactivar, idempotencia y vínculo con la cuenta.
   Supabase simulado, sin red. Los payloads simulan el postback v2.0.0 y van con un hottok de prueba local. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const HOTTOK = "hottok-de-prueba-local";
process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.HOTMART_HOTTOK = HOTTOK;
delete process.env.HOTMART_PLAN_MAP;

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "Comprador@Test.cl" };
let db;
function reset() {
  process.env.HOTMART_HOTTOK = HOTTOK;
  delete process.env.HOTMART_PLAN_MAP;
  db = { plan_access: [], hotmart_events: [], subscribers: [], messages: [], admins: [] };
}

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, data) => ({ ok: status < 400, status, statusText: "", headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.host !== "db.test") return json(404, {});
  if (u.pathname === "/auth/v1/user") return init.headers.Authorization === "Bearer good" ? json(200, { id: USER.id, email: USER.email.toLowerCase() }) : json(401, {});
  if (!u.pathname.startsWith("/rest/v1/")) return json(404, {});
  const table = u.pathname.split("/").pop();
  const rows = db[table];
  const method = init.method || "GET";
  const sel = () => rows.filter((r) => [...u.searchParams].every(([k, v]) => {
    if (["select", "order", "limit", "on_conflict"].includes(k)) return true;
    return v.startsWith("eq.") ? String(r[k]) === v.slice(3) : true;
  }));
  if (method === "GET") return json(200, sel());
  if (method === "POST") {
    const key = u.searchParams.get("on_conflict");
    const out = [];
    for (const r of JSON.parse(init.body)) {
      const dup = key ? rows.find((x) => x[key] === r[key]) : table === "plan_access" ? rows.find((x) => x.email === r.email && x.plan === r.plan) : null;
      if (dup) { if (/ignore-duplicates/.test(init.headers.Prefer || "")) continue; return json(409, { message: "duplicate key" }); }
      const n = { id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r };
      rows.push(n); out.push(n);
    }
    return json(201, out);
  }
  if (method === "PATCH") { const out = sel(); out.forEach((r) => Object.assign(r, JSON.parse(init.body))); return json(200, out); }
  return json(404, {});
};

const webhook = require("../api/hotmart/webhook");
const account = require("../api/account");

function post(payload, { token = HOTTOK, method = "POST", raw } = {}) {
  return new Promise((resolve) => {
    const headers = { "content-type": "application/json" };
    if (token !== null) headers["x-hotmart-hottok"] = token;
    const req = { method, url: "/api/hotmart/webhook", headers, body: raw !== undefined ? raw : JSON.stringify(payload) };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(d) { resolve({ status: this.statusCode, body: d ? JSON.parse(d) : null }); } };
    webhook(req, res);
  });
}
function me() {
  return new Promise((resolve) => {
    const req = { method: "GET", url: "/api/account?action=me", headers: { authorization: "Bearer good" }, query: { action: "me" } };
    const res = { statusCode: 200, setHeader() {}, end(d) { resolve({ status: this.statusCode, body: JSON.parse(d) }); } };
    account(req, res);
  });
}

const T0 = Date.UTC(2026, 10, 19, 15, 0, 0);
const IN_30D = T0 + 30 * 86400000;
let n = 0;
function purchase(event, over = {}) {
  const { productId = 108538114, email = "comprador@test.cl", id, createdAt = T0, nextCharge = IN_30D, offer = "off123", transaction = "HP1" } = over;
  return {
    id: id || `evt-${++n}`, creation_date: createdAt, event, version: "2.0.0",
    data: {
      product: { id: productId, ucode: "uc-" + productId, name: "Plan" },
      buyer: { email, name: "Comprador Prueba" },
      purchase: { transaction, status: "APPROVED", approved_date: createdAt, date_next_charge: nextCharge, offer: { code: offer }, recurrence_number: 1 },
      subscription: { status: "ACTIVE", subscriber: { code: "SUB1" } },
    },
  };
}
const cancellation = (over = {}) => ({
  id: over.id || `evt-${++n}`, creation_date: over.createdAt || T0 + 1000, event: "SUBSCRIPTION_CANCELLATION", version: "2.0.0",
  data: { product: { id: over.productId || 108538114, name: "Plan" }, cancellation_date: T0 + 1000, date_next_charge: over.nextCharge, subscriber: { code: "SUB1", email: over.email || "comprador@test.cl", name: "Comprador Prueba" }, subscription: { id: 1, plan: { name: "Mensual" } } },
});

beforeEach(reset);

test("hottok: sin header o incorrecto => 401; sin configurar => 503; solo POST", async () => {
  assert.equal((await post(purchase("PURCHASE_APPROVED"), { token: null })).status, 401);
  assert.equal((await post(purchase("PURCHASE_APPROVED"), { token: "otro" })).status, 401);
  assert.equal((await post(purchase("PURCHASE_APPROVED"), { token: HOTTOK + "x" })).status, 401);
  assert.equal((await post(null, { method: "GET" })).status, 405);
  assert.equal(db.plan_access.length, 0);
  process.env.HOTMART_HOTTOK = "";
  assert.equal((await post(purchase("PURCHASE_APPROVED"), { token: "" })).status, 503, "sin HOTMART_HOTTOK no se acepta nada");
  assert.equal(db.plan_access.length, 0);
});

test("compra aprobada: activa el plan del correo del comprador aunque no tenga cuenta, y la guarda en el log", async () => {
  const r = await post(purchase("PURCHASE_APPROVED", { email: "Comprador@Test.CL" }));
  assert.equal(r.status, 200);
  assert.equal(r.body.outcome, "applied");
  assert.equal(db.plan_access.length, 1);
  const a = db.plan_access[0];
  assert.deepEqual([a.email, a.plan, a.status, a.source], ["comprador@test.cl", "basico", "activa", "hotmart"]);
  assert.equal(new Date(a.period_end).getTime(), IN_30D, "vigente hasta la próxima cobranza de Hotmart");
  assert.equal(db.hotmart_events.length, 1);
  assert.deepEqual([db.hotmart_events[0].event, db.hotmart_events[0].outcome, db.hotmart_events[0].plan], ["PURCHASE_APPROVED", "applied", "basico"]);
  assert.ok(!JSON.stringify(db.hotmart_events).includes("Comprador Prueba"), "el log no guarda datos personales extra");
});

test("mapeo de los tres planes por product.id, y por offer.code o HOTMART_PLAN_MAP; un curso no activa ningún plan", async () => {
  for (const [productId, plan] of [[108538114, "basico"], [108559411, "pro"], [108559868, "premium"]]) {
    await post(purchase("PURCHASE_APPROVED", { productId, email: `${plan}@test.cl` }));
    assert.equal(db.plan_access.find((x) => x.email === `${plan}@test.cl`).plan, plan);
  }
  const curso = await post(purchase("PURCHASE_APPROVED", { productId: 101158236, email: "curso@test.cl" }));
  assert.equal(curso.body.outcome, "unmapped");
  assert.ok(!db.plan_access.some((x) => x.email === "curso@test.cl"), "el curso se ve en Hotmart: no da acceso en el sitio");
  // oferta no reconocida => se corrige con la variable de entorno
  const raro = purchase("PURCHASE_APPROVED", { productId: 999, offer: "abc9", email: "raro@test.cl" });
  assert.equal((await post(raro)).body.outcome, "unmapped");
  process.env.HOTMART_PLAN_MAP = JSON.stringify({ abc9: "pro", 999: "nada" });
  const raro2 = purchase("PURCHASE_APPROVED", { productId: 999, offer: "abc9", email: "raro@test.cl" });
  assert.equal((await post(raro2)).body.outcome, "applied");
  assert.equal(db.plan_access.find((x) => x.email === "raro@test.cl").plan, "pro");
});

test("idempotente: el mismo evento dos veces no cambia nada ni se duplica", async () => {
  const ev = purchase("PURCHASE_APPROVED", { id: "evt-fijo" });
  assert.equal((await post(ev)).body.outcome, "applied");
  const snapshot = JSON.stringify(db.plan_access);
  const again = await post(ev);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(JSON.stringify(db.plan_access), snapshot);
  assert.equal(db.hotmart_events.length, 1);
  assert.equal(db.plan_access.length, 1);
});

test("se vincula a la cuenta al registrarse o iniciar sesión con el mismo correo", async () => {
  await post(purchase("PURCHASE_APPROVED", { productId: 108559868 }));
  // la persona se registra después del pago (el correo puede venir con otras mayúsculas)
  db.subscribers.push({ user_id: USER.id, email: USER.email.toLowerCase(), nombre: "Comprador", plan: null, status: "sin_suscripcion" });
  const r = await me();
  assert.equal(r.status, 200);
  assert.equal(r.body.subscriber.planName, "Plan Premium");
  assert.equal(r.body.canAsk, true);
  assert.equal(r.body.features.videollamada, true);
  assert.equal(db.subscribers[0].status, "activa");
  assert.equal(new Date(db.subscribers[0].period_end).getTime(), IN_30D);
});

test("sin plan_access todavía: el panel muestra la cuenta sin plan (pago en verificación)", async () => {
  db.subscribers.push({ user_id: USER.id, email: USER.email.toLowerCase(), nombre: "Comprador", plan: null, status: "sin_suscripcion" });
  const r = await me();
  assert.equal(r.body.subscriber.hasSubscription, false);
  assert.equal(r.body.canAsk, false);
});

test("si la cuenta ya existe, el webhook activa el plan en el momento", async () => {
  db.subscribers.push({ user_id: USER.id, email: USER.email.toLowerCase(), nombre: "Comprador", plan: null, status: "sin_suscripcion" });
  await post(purchase("PURCHASE_APPROVED", { productId: 108559411 }));
  assert.deepEqual([db.subscribers[0].plan, db.subscribers[0].status], ["pro", "activa"]);
});

test("reembolso, contracargo y compra cancelada desactivan el plan", async () => {
  for (const [i, event] of ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED"].entries()) {
    reset();
    db.subscribers.push({ user_id: USER.id, email: USER.email.toLowerCase(), nombre: "C", plan: null, status: "sin_suscripcion" });
    await post(purchase("PURCHASE_APPROVED", { createdAt: T0 }));
    assert.equal(db.subscribers[0].status, "activa");
    const r = await post(purchase(event, { createdAt: T0 + 60000 + i }));
    assert.equal(r.body.outcome, "applied", event);
    assert.equal(db.plan_access[0].status, "cancelada", event);
    assert.equal(db.subscribers[0].status, "cancelada", event);
    assert.equal((await me()).body.canAsk, false, event);
  }
});

test("cancelación de la suscripción: sigue activa hasta la fecha pagada; si ya pasó, se desactiva", async () => {
  db.subscribers.push({ user_id: USER.id, email: USER.email.toLowerCase(), nombre: "C", plan: null, status: "sin_suscripcion" });
  await post(purchase("PURCHASE_APPROVED"));
  const future = Date.now() + 10 * 86400000;
  const r = await post(cancellation({ nextCharge: future }));
  assert.equal(r.body.outcome, "applied");
  assert.equal(db.plan_access[0].status, "cancelada_fin_periodo");
  assert.equal(new Date(db.plan_access[0].period_end).getTime(), future);
  assert.equal((await me()).body.canAsk, true, "ya pagó ese período");
  await post(cancellation({ nextCharge: Date.now() - 5 * 86400000, createdAt: T0 + 5000 }));
  assert.equal(db.plan_access[0].status, "cancelada");
  assert.equal((await me()).body.canAsk, false);
});

test("renovación (nuevo PURCHASE_APPROVED) extiende la vigencia; COMPLETE no la acorta; un evento viejo se ignora", async () => {
  await post(purchase("PURCHASE_APPROVED", { createdAt: T0, nextCharge: IN_30D }));
  const renewal = T0 + 30 * 86400000;
  await post(purchase("PURCHASE_APPROVED", { createdAt: renewal, nextCharge: renewal + 30 * 86400000, transaction: "HP2" }));
  const end = new Date(db.plan_access[0].period_end).getTime();
  assert.equal(end, renewal + 30 * 86400000);
  await post(purchase("PURCHASE_COMPLETE", { createdAt: renewal + 1000, nextCharge: IN_30D, transaction: "HP2" }));
  assert.equal(new Date(db.plan_access[0].period_end).getTime(), end, "COMPLETE no recorta lo ya pagado");
  const stale = await post(purchase("PURCHASE_CANCELED", { createdAt: T0 + 500 }));
  assert.equal(stale.body.outcome, "stale");
  assert.equal(db.plan_access[0].status, "activa");
  assert.equal(db.hotmart_events.at(-1).outcome, "stale");
});

test("reactivación: una compra aprobada después de cancelar vuelve a activar el plan", async () => {
  await post(purchase("PURCHASE_APPROVED", { createdAt: T0 }));
  await post(purchase("PURCHASE_REFUNDED", { createdAt: T0 + 1000 }));
  assert.equal(db.plan_access[0].status, "cancelada");
  await post(purchase("PURCHASE_APPROVED", { createdAt: T0 + 2000, nextCharge: IN_30D, transaction: "HP3" }));
  assert.equal(db.plan_access[0].status, "activa");
  assert.equal(db.plan_access.length, 1);
});

test("eventos sin efecto, sin correo o mal formados", async () => {
  assert.equal((await post(purchase("PURCHASE_BILLET_PRINTED"))).body.outcome, "ignored");
  assert.equal((await post(purchase("PURCHASE_DELAYED"))).body.outcome, "ignored");
  const sinCorreo = purchase("PURCHASE_APPROVED"); delete sinCorreo.data.buyer;
  assert.equal((await post(sinCorreo)).body.outcome, "no_email");
  assert.equal((await post(null, { raw: "{no es json" })).status, 400);
  assert.equal((await post({ hola: 1 })).status, 400);
  assert.equal(db.plan_access.length, 0);
});

test("migración de accesos: aditiva, con RLS y sin permisos para el navegador", () => {
  const fs = require("node:fs"), path = require("node:path");
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261119150000_hotmart_accesos.sql"), "utf8").replace(/--.*$/gm, "");
  assert.ok(!/\bdrop\s+(table|column|schema)\b|\bdelete\s+from\b|\btruncate\b|\balter\s+table\s+\S+\s+(drop|rename)\b/i.test(sql), "solo cambios aditivos");
  assert.ok(!/\bpayments\b/i.test(sql), "no toca la tabla payments");
  assert.match(sql, /alter table public\.plan_access enable row level security/);
  assert.match(sql, /alter table public\.hotmart_events enable row level security/);
  assert.ok(!/create policy|to\s+(anon|authenticated)/i.test(sql), "sin acceso desde el navegador");
  assert.match(sql, /unique \(email, plan\)/);
  assert.match(sql, /event_id text not null unique/);
});
