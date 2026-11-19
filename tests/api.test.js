/* Pruebas de la API con Supabase simulado (sin red). */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.SITE_URL = "https://sitio.test";

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "cliente@test.cl" };
let db, calls;

function reset() {
  db = {
    subscribers: [{ user_id: USER.id, email: USER.email, nombre: "Cliente", plan: "basico", status: "activa", period_start: "2026-11-01T03:00:00Z", period_end: "2099-12-01T03:00:00Z" }],
    messages: [],
    plan_access: [],
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
      for (const [k, v] of u.searchParams) {
        if (v.startsWith("eq.")) out = out.filter((r) => String(r[k]) === v.slice(3));
        if (v.startsWith("in.(")) {
          const list = v.slice(4, -1).split(",");
          out = out.filter((r) => list.includes(String(r[k])));
        }
      }
      out.forEach((r) => Object.assign(r, patch));
      return json(200, out);
    }
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

test("Plan Aprendiz: 3 preguntas por período y la cuarta se bloquea", async () => {
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

test("Plan Técnico no tiene tope", async () => {
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

test("me devuelve plan, cupo y chat", async () => {
  const r = await call(account, { url: "/api/account?action=me" });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscriber.planName, "Plan Aprendiz");
  assert.equal(r.body.subscriber.amount, 5000);
  assert.equal(r.body.quota.limit, 3);
  assert.ok(Array.isArray(r.body.messages));
  assert.equal(r.body.payments, undefined);
});

test("ya no existen las acciones de cobro (alta, cancelar, cambiar plan o tarjeta)", async () => {
  for (const action of ["start", "cancel", "change-plan", "change-card"]) {
    const r = await call(account, { method: "POST", url: `/api/account?action=${action}`, body: { plan: "pro" } });
    assert.equal(r.status, 404, action);
  }
});

test("me vincula el plan activado por Hotmart al registrarse con el mismo correo", async () => {
  db.subscribers[0].plan = null; db.subscribers[0].status = "sin_suscripcion"; db.subscribers[0].period_end = null;
  let r = await call(account, { url: "/api/account?action=me" });
  assert.equal(r.body.subscriber.hasSubscription, false, "sin plan: el panel muestra «pago en verificación»");
  assert.equal(r.body.canAsk, false);
  db.plan_access.push({ id: "a1", email: USER.email, plan: "pro", status: "activa", period_start: "2026-11-19T00:00:00Z", period_end: "2099-01-01T00:00:00Z", updated_at: "2026-11-19T00:00:00Z" });
  r = await call(account, { url: "/api/account?action=me" });
  assert.equal(r.body.subscriber.planName, "Plan Técnico");
  assert.equal(r.body.canAsk, true);
});

test("los errores no filtran detalles internos", async () => {
  const r = await call(account, { url: "/api/account?action=nada" });
  assert.equal(r.status, 404);
  assert.ok(!JSON.stringify(r.body).includes("service"));
});

test("el historial de otros usuarios es solo del Plan Premium y sale sin datos personales", async () => {
  let r = await call(account, { url: "/api/account?action=community" });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "not_premium");

  db.subscribers[0].plan = "pro";
  r = await call(account, { url: "/api/account?action=community" });
  assert.equal(r.status, 403);

  db.subscribers[0].plan = "premium";
  db.messages.push(
    { id: 1, user_id: "22222222-2222-2222-2222-222222222222", sender: "cliente", body: "¿Cuánto gas lleva una Hilux?", created_at: "2026-11-01T00:00:00.000Z" },
    { id: 2, user_id: "22222222-2222-2222-2222-222222222222", sender: "equipo", body: "Revisa la etiqueta del equipo.", created_at: "2026-11-01T01:00:00.000Z" },
  );
  r = await call(account, { url: "/api/account?action=community" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.items.length, 1);
  assert.deepEqual(Object.keys(r.body.items[0]).sort(), ["fecha", "pregunta", "respuesta"]);
  assert.equal(r.body.items[0].pregunta, "¿Cuánto gas lleva una Hilux?");
  const blob = JSON.stringify(r.body);
  assert.equal(blob.includes("22222222"), false);
  assert.equal(blob.includes("user_id"), false);
  assert.equal(blob.includes("@"), false);
  assert.equal(r.body.features, undefined);
});

test("me del Plan Premium expone los beneficios extra", async () => {
  db.subscribers[0].plan = "premium";
  const r = await call(account, { url: "/api/account?action=me" });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscriber.planName, "Plan Premium");
  assert.equal(r.body.subscriber.amount, 20000);
  assert.equal(r.body.features.ver_preguntas_otros, true);
  assert.equal(r.body.features.whatsapp, undefined);
  assert.equal(r.body.features.videollamada, true);
  assert.equal(r.body.features.ebooks_gratis, true);
  assert.equal(r.body.features.biblioteca, true);
});
