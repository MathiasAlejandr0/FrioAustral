const { test } = require("node:test");
const assert = require("node:assert/strict");
const { signFlowParams, getPlanAmounts, getFlowConfig } = require("../api/_lib/flow");

test("signFlowParams ordena las llaves y firma HMAC-SHA256 en hex", () => {
  const params = { b: "2", a: "1" };
  const sig = signFlowParams(params, "secret");
  const crypto = require("crypto");
  const expected = crypto.createHmac("sha256", "secret").update("a=1&b=2").digest("hex");
  assert.equal(sig, expected);
  assert.equal(sig.length, 64);
});

test("getPlanAmounts no inventa precios si la env está vacía", () => {
  const prev = process.env.FLOW_PLAN_AMOUNTS;
  delete process.env.FLOW_PLAN_AMOUNTS;
  try {
    assert.deepEqual(getPlanAmounts(), {});
  } finally {
    if (prev == null) delete process.env.FLOW_PLAN_AMOUNTS;
    else process.env.FLOW_PLAN_AMOUNTS = prev;
  }
});

test("getPlanAmounts lee montos confirmados en CLP", () => {
  const prev = process.env.FLOW_PLAN_AMOUNTS;
  process.env.FLOW_PLAN_AMOUNTS = "basico:5000,pro:10000,premium:20000";
  try {
    assert.deepEqual(getPlanAmounts(), { basico: 5000, pro: 10000, premium: 20000 });
  } finally {
    if (prev == null) delete process.env.FLOW_PLAN_AMOUNTS;
    else process.env.FLOW_PLAN_AMOUNTS = prev;
  }
});

test("getFlowConfig usa sandbox por defecto", () => {
  const prevUrl = process.env.FLOW_API_URL;
  const prevEnv = process.env.FLOW_ENV;
  delete process.env.FLOW_API_URL;
  delete process.env.FLOW_ENV;
  try {
    const cfg = getFlowConfig();
    assert.equal(cfg.baseUrl, "https://sandbox.flow.cl/api");
    assert.equal(cfg.env, "sandbox");
    assert.equal(cfg.isConfigured, false);
  } finally {
    if (prevUrl == null) delete process.env.FLOW_API_URL;
    else process.env.FLOW_API_URL = prevUrl;
    if (prevEnv == null) delete process.env.FLOW_ENV;
    else process.env.FLOW_ENV = prevEnv;
  }
});

test("FLOW_API_URL tiene prioridad sobre FLOW_ENV", () => {
  const prevUrl = process.env.FLOW_API_URL;
  const prevEnv = process.env.FLOW_ENV;
  process.env.FLOW_ENV = "production";
  process.env.FLOW_API_URL = "https://sandbox.flow.cl/api";
  try {
    const cfg = getFlowConfig();
    assert.equal(cfg.baseUrl, "https://sandbox.flow.cl/api");
  } finally {
    if (prevUrl == null) delete process.env.FLOW_API_URL;
    else process.env.FLOW_API_URL = prevUrl;
    if (prevEnv == null) delete process.env.FLOW_ENV;
    else process.env.FLOW_ENV = prevEnv;
  }
});