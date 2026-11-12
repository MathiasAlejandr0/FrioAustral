const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const flow = require("../api/_lib/flow");

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(prev)) { if (prev[k] == null) delete process.env[k]; else process.env[k] = prev[k]; } }
}

test("signFlowParams ordena las llaves, ignora 's' y firma HMAC-SHA256 en hex", () => {
  const sig = flow.signFlowParams({ b: "2", a: "1", s: "x" }, "secret");
  assert.equal(sig, crypto.createHmac("sha256", "secret").update("a=1&b=2").digest("hex"));
});

test("getFlowConfig usa sandbox por defecto y FLOW_API_URL tiene prioridad", () => {
  withEnv({ FLOW_API_URL: null, FLOW_ENV: null, FLOW_API_KEY: null, FLOW_SECRET_KEY: null }, () => {
    const cfg = flow.getFlowConfig();
    assert.equal(cfg.baseUrl, "https://sandbox.flow.cl/api");
    assert.equal(cfg.env, "sandbox");
    assert.equal(cfg.isConfigured, false);
  });
  withEnv({ FLOW_ENV: "production", FLOW_API_URL: "https://sandbox.flow.cl/api" }, () => {
    assert.equal(flow.getFlowConfig().baseUrl, "https://sandbox.flow.cl/api");
  });
});

test("los planes salen de fa-config.js: $5.000, $10.000 y $20.000 al mes", () => {
  assert.equal(flow.getPlan("basico").amount, 5000);
  assert.equal(flow.getPlan("pro").amount, 10000);
  assert.equal(flow.getPlan("premium").amount, 20000);
  assert.equal(flow.getPlan("basico").questionsPerPeriod, 3);
  assert.equal(flow.getPlan("pro").questionsPerPeriod, null);
  assert.equal(flow.getPlan("premium").questionsPerPeriod, null);
  assert.equal(flow.getPlan("basico").flowPlanId, "fa-basico-5000");
  assert.equal(flow.planKeyFromFlowPlanId("fa-premium-20000"), "premium");
  assert.equal(flow.getPlan("nada"), null);
});

test("sin claves de Flow no se llama a la API", async () => {
  await withEnv({ FLOW_API_KEY: null, FLOW_SECRET_KEY: null }, async () => {
    await assert.rejects(() => flow.flowPost("/plans/get", {}), (e) => e.code === "not_configured");
  });
});

test("flowPost firma y envía form-urlencoded con apiKey", async () => {
  await withEnv({ FLOW_API_KEY: "k", FLOW_SECRET_KEY: "sec", FLOW_API_URL: "https://sandbox.flow.cl/api" }, async () => {
    let seen;
    const fake = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ planId: "x" }) }; };
    await flow.flowPost("/plans/create", { planId: "x", amount: 5000 }, fake);
    assert.equal(seen.url, "https://sandbox.flow.cl/api/plans/create");
    const body = Object.fromEntries(new URLSearchParams(seen.init.body));
    assert.equal(body.apiKey, "k");
    const { s, ...rest } = body;
    assert.equal(s, flow.signFlowParams(rest, "sec"));
  });
});

test("flowDate interpreta la hora de Chile", () => {
  assert.equal(flow.flowDate("2026-11-12 10:00:00"), "2026-11-12T13:00:00.000Z"); // verano -03
  assert.equal(flow.flowDate("2026-07-12 10:00:00"), "2026-07-12T14:00:00.000Z"); // invierno -04
  assert.equal(flow.flowDate(null), null);
});

const base = { subscriptionId: "sus_1", planId: "fa-basico-5000", status: 1, morose: 0, cancel_at_period_end: 0, period_start: "2026-11-12 00:00:00", period_end: "2099-12-11 00:00:00", next_invoice_date: "2099-12-12 00:00:00" };
const now = new Date("2026-11-20T12:00:00Z");

test("mapSubscription: activa y pagada => puede preguntar", () => {
  const m = flow.mapSubscription({ ...base, invoices: [{ id: 1, status: 1, amount: 5000, created: "2026-11-12 00:00:00" }] }, now);
  assert.equal(m.status, "activa");
  assert.equal(m.canAsk, true);
  assert.equal(m.planKey, "basico");
  assert.equal(m.invoices[0].status, "pagado");
});

test("mapSubscription: primer cobro sin pagar => pago_pendiente, no pregunta", () => {
  const m = flow.mapSubscription({ ...base, invoices: [{ id: 1, status: 0, amount: 5000, paymentLink: "https://flow/x" }] }, now);
  assert.equal(m.status, "pago_pendiente");
  assert.equal(m.canAsk, false);
  assert.equal(m.invoices[0].payment_link, "https://flow/x");
});

test("mapSubscription: morosa, cancelada a fin de período y cancelada", () => {
  assert.equal(flow.mapSubscription({ ...base, morose: 1, invoices: [{ id: 1, status: 0 }] }, now).status, "morosa");
  const fin = flow.mapSubscription({ ...base, cancel_at_period_end: 1, invoices: [{ id: 1, status: 1 }] }, now);
  assert.equal(fin.status, "cancelada_fin_periodo");
  assert.equal(fin.canAsk, true);
  assert.equal(fin.nextChargeAt, null);
  const c = flow.mapSubscription({ ...base, status: 4, invoices: [{ id: 1, status: 1 }] }, now);
  assert.equal(c.status, "cancelada");
  assert.equal(c.canAsk, false);
});
