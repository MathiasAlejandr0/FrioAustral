/* Pruebas de la API con Supabase y Flow simulados (sin red). */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.FLOW_API_KEY = "k";
process.env.FLOW_SECRET_KEY = "s";
process.env.FLOW_API_URL = "https://sandbox.flow.cl/api";
process.env.SITE_URL = "https://sitio.test";

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "cliente@test.cl" };
let db, calls;

function reset() {
  db = {
    subscribers: [{ user_id: USER.id, email: USER.email, nombre: "Cliente", plan: "basico", status: "activa", flow_customer_id: "cus_1", flow_subscription_id: "sus_1", period_start: "2026-11-01T03:00:00Z", period_end: "2099-12-01T03:00:00Z", synced_at: new Date().toISOString(), card_last4: "1234" }],
    messages: [],
    payments: [],
    admins: [],
  };
  calls = [];
}

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  calls.push({ url: String(url), method: init.method || "GET", body: init.body });
  const json = (status, data, headers = {}) => ({ ok: status < 400, status, statusText: "", headers: { get: (h) => headers[h.toLowerCase()] || null }, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.host === "db.test" && u.pathname === "/auth/v1/user") {
    return init.headers.Authorization === "Bearer good" ? json(200, USER) : json(401, {});
  }
  if (u.host === "db.test" && u.pathname.startsWith("/rest/v1/")) {
    const table = u.pathname.split("/").pop();
    const rows = db[table];
    const method = init.method || "GET";
    if (method === "GET") {
      let out = rows.slice();
      for (const [k, v] of u.searchParams) {
        if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
        const [op, val] = [v.split(".")[0], v.split(".").slice(1).join(".")];
        if (op === "eq") out = out.filter((r) => String(r[k]) === val);
        if (op === "gte") out = out.filter((r) => String(r[k]) >= val);
      }
      return json(200, out, { "content-range": `0-${out.length}/${out.length}` });
    }
    if (method === "POST") {
      const body = JSON.parse(init.body);
      const added = body.map((r, i) => ({ id: rows.length + i + 1, created_at: new Date().toISOString(), ...r }));
      rows.push(...added);
      return json(201, added);
    }
    if (method === "PATCH") {
      const patch = JSON.parse(init.body);
      let out = rows;
      for (const [k, v] of u.searchParams) { if (v.startsWith("eq.")) out = out.filter((r) => String(r[k]) === v.slice(3)); }
      out.forEach((r) => Object.assign(r, patch));
      return json(200, out);
    }
  }
  if (u.host === "sandbox.flow.cl") {
    if (u.pathname.endsWith("/subscription/cancel")) return json(200, { subscriptionId: "sus_1" });
    if (u.pathname.endsWith("/subscription/get")) return json(200, { subscriptionId: "sus_1", planId: "fa-basico-5000", status: 1, morose: 0, cancel_at_period_end: 1, period_start: "2026-11-01 00:00:00", period_end: "2099-12-01 00:00:00", invoices: [{ id: 9, status: 1, amount: 5000, created: "2026-11-01 00:00:00" }] });
  }
  return json(404, { message: "no mock " + url });
};

const account = require("../api/account");

function call(handler, { method = "GET", url, body, token = "good" }) {
  return new Promise((resolve) => {
    const req = { method, url, headers: { authorization: token ? `Bearer ${token}` : "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, query: Object.fromEntries(new URL(url, "http://x").searchParams) };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(data) { resolve({ status: this.statusCode, body: data ? JSON.parse(data) : null, headers: this.headers }); } };
    handler(req, res);
  });
}

beforeEach(reset);

test("sin sesión => 401", async () => {
  const r = await call(account, { url: "/api/account?action=me", token: "bad" });
  assert.equal(r.status, 401);
});

test("plan Consulta: 3 preguntas por período y la cuarta se bloquea", async () => {
  for (let i = 1; i <= 3; i++) {
    const r = await call(account, { method: "POST", url: "/api/account?action=message", body: { body: `Pregunta ${i}` } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.quota.left, 3 - i);
  }
  const r4 = await call(account, { method: "POST", url: "/api/account?action=message", body: { body: "Pregunta 4" } });
  assert.equal(r4.status, 403);
  assert.equal(r4.body.code, "quota");
  assert.equal(db.messages.length, 3);
});

test("plan Ilimitado no tiene tope", async () => {
  db.subscribers[0].plan = "pro";
  for (let i = 0; i < 6; i++) {
    const r = await call(account, { method: "POST", url: "/api/account?action=message", body: { body: `P${i}` } });
    assert.equal(r.status, 201);
    assert.equal(r.body.quota.unlimited, true);
  }
});

test("suscripción morosa no puede preguntar", async () => {
  db.subscribers[0].status = "morosa";
  const r = await call(account, { method: "POST", url: "/api/account?action=message", body: { body: "Hola" } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "inactive");
});

test("me devuelve plan, cupo, chat y pagos", async () => {
  const r = await call(account, { url: "/api/account?action=me" });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscriber.planName, "Consulta");
  assert.equal(r.body.subscriber.amount, 5000);
  assert.equal(r.body.quota.limit, 3);
  assert.ok(Array.isArray(r.body.messages));
  assert.ok(Array.isArray(r.body.payments));
});

test("cancelar llama a Flow subscription/cancel al final del período", async () => {
  const r = await call(account, { method: "POST", url: "/api/account?action=cancel", body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = calls.find((x) => x.url.endsWith("/subscription/cancel"));
  assert.ok(c);
  assert.equal(new URLSearchParams(c.body).get("at_period_end"), "1");
  assert.equal(r.body.subscriber.status, "cancelada_fin_periodo");
  assert.equal(db.payments.length, 1);
});

test("los errores no filtran detalles internos", async () => {
  const r = await call(account, { url: "/api/account?action=nada" });
  assert.equal(r.status, 404);
  assert.ok(!JSON.stringify(r.body).includes("service"));
});
