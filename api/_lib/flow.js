/**
 * Cliente mínimo de Flow.cl para Frío Austral.
 * Firma HMAC-SHA256 según la especificación de Flow: parámetros ordenados
 * alfabéticamente en formato key=value unidos por &.
 * Patrón alineado con la integración ya usada en otros proyectos de Mathias
 * (sin copiar secretos ni lógica de negocio de esos repos).
 */
const crypto = require("crypto");

function getFlowConfig() {
  const apiKey = (process.env.FLOW_API_KEY || "").trim();
  const secretKey = (process.env.FLOW_SECRET_KEY || "").trim();
  const explicitUrl = (process.env.FLOW_API_URL || "").trim().replace(/\/+$/, "");
  const env = process.env.FLOW_ENV === "production" ? "production" : "sandbox";
  const baseUrl =
    explicitUrl ||
    (env === "production" ? "https://www.flow.cl/api" : "https://sandbox.flow.cl/api");

  return {
    apiKey,
    secretKey,
    env: baseUrl.includes("sandbox") ? "sandbox" : env,
    baseUrl,
    isConfigured: Boolean(apiKey && secretKey),
  };
}

function signFlowParams(params, secretKey) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHmac("sha256", secretKey).update(toSign).digest("hex");
}

function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4173")
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Montos confirmados para cobrar, en CLP.
 * Formato de FLOW_PLAN_AMOUNTS: "basico:5000,pro:10000,premium:20000"
 * Si falta, no se cobra (no se inventa el precio).
 */
function getPlanAmounts() {
  const raw = (process.env.FLOW_PLAN_AMOUNTS || "").trim();
  if (!raw) return {};
  const out = {};
  raw.split(",").forEach((part) => {
    const [id, amount] = part.split(":").map((s) => String(s || "").trim());
    const n = Number(amount);
    if (id && Number.isFinite(n) && n > 0) out[id] = Math.round(n);
  });
  return out;
}

function planLabels() {
  return { basico: "Consulta", pro: "Ilimitado", premium: "Taller Pro" };
}

async function flowPost(path, params) {
  const config = getFlowConfig();
  if (!config.isConfigured) {
    const err = new Error("Flow no está configurado (falta FLOW_API_KEY o FLOW_SECRET_KEY)");
    err.code = "not_configured";
    throw err;
  }
  const bodyParams = { ...params, apiKey: config.apiKey };
  bodyParams.s = signFlowParams(bodyParams, config.secretKey);
  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(bodyParams)) formBody.append(key, String(value));

  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code) {
    const err = new Error(data.message || res.statusText || "Error de Flow");
    err.code = data.code || res.status;
    throw err;
  }
  return data;
}

async function flowGet(path, params) {
  const config = getFlowConfig();
  if (!config.isConfigured) {
    const err = new Error("Flow no está configurado (falta FLOW_API_KEY o FLOW_SECRET_KEY)");
    err.code = "not_configured";
    throw err;
  }
  const queryParams = { ...params, apiKey: config.apiKey };
  queryParams.s = signFlowParams(queryParams, config.secretKey);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) qs.append(key, String(value));
  const res = await fetch(`${config.baseUrl}${path}?${qs.toString()}`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code) {
    const err = new Error(data.message || res.statusText || "Error de Flow");
    err.code = data.code || res.status;
    throw err;
  }
  return data;
}

async function createFlowPayment({ commerceOrder, subject, amount, email }) {
  const config = getFlowConfig();
  const site = siteUrl();
  const params = {
    apiKey: config.apiKey,
    commerceOrder,
    subject,
    currency: "CLP",
    amount: Math.round(amount),
    email: String(email).toLowerCase().trim(),
    urlConfirmation: `${site}/api/flow/confirm`,
    urlReturn: `${site}/api/flow/return`,
  };
  const signature = signFlowParams(params, config.secretKey);
  params.s = signature;

  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) formBody.append(key, String(value));

  const res = await fetch(`${config.baseUrl}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code || !data.url) {
    const err = new Error(data.message || res.statusText || "No se pudo crear el pago en Flow");
    err.code = data.code || res.status;
    throw err;
  }
  return {
    redirectUrl: `${data.url}?token=${data.token}`,
    token: String(data.token),
    flowOrder: data.flowOrder,
  };
}

async function getFlowPaymentStatus(token) {
  return flowGet("/payment/getStatus", { token: String(token).trim() });
}

module.exports = {
  getFlowConfig,
  signFlowParams,
  siteUrl,
  getPlanAmounts,
  planLabels,
  flowPost,
  flowGet,
  createFlowPayment,
  getFlowPaymentStatus,
};