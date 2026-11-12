/**
 * Cliente de Flow.cl para la suscripción mensual de Frío Austral.
 * Firma HMAC-SHA256: parámetros ordenados alfabéticamente, key=value unidos por "&" (sin "s").
 * Las claves salen SOLO de variables de entorno (FLOW_API_KEY, FLOW_SECRET_KEY). Nunca se registran.
 */
const crypto = require("crypto");
const FA_CONFIG = require("../../assets/fa-config.js");

function getFlowConfig() {
  const apiKey = (process.env.FLOW_API_KEY || "").trim();
  const secretKey = (process.env.FLOW_SECRET_KEY || "").trim();
  const explicitUrl = (process.env.FLOW_API_URL || "").trim().replace(/\/+$/, "");
  const env = process.env.FLOW_ENV === "production" ? "production" : "sandbox";
  const baseUrl = explicitUrl || (env === "production" ? "https://www.flow.cl/api" : "https://sandbox.flow.cl/api");
  return {
    apiKey,
    secretKey,
    env: baseUrl.includes("sandbox") ? "sandbox" : "production",
    baseUrl,
    isConfigured: Boolean(apiKey && secretKey),
  };
}

function signFlowParams(params, secretKey) {
  const toSign = Object.keys(params)
    .filter((k) => k !== "s")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHmac("sha256", secretKey).update(toSign).digest("hex");
}

function siteUrl() {
  const explicit = (process.env.SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:4173";
}

class FlowError extends Error {
  constructor(message, code, httpStatus) {
    super(message);
    this.name = "FlowError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function notConfigured() {
  return new FlowError("Flow no está configurado (faltan FLOW_API_KEY o FLOW_SECRET_KEY).", "not_configured", 503);
}

function signed(params) {
  const config = getFlowConfig();
  if (!config.isConfigured) throw notConfigured();
  const out = {};
  for (const [k, v] of Object.entries({ ...params, apiKey: config.apiKey })) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  out.s = signFlowParams(out, config.secretKey);
  return { config, out };
}

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.code && data.message)) {
    throw new FlowError(data.message || res.statusText || "Error de Flow", data.code || res.status, res.status);
  }
  return data;
}

async function flowPost(path, params, fetchImpl = fetch) {
  const { config, out } = signed(params);
  const res = await fetchImpl(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(out).toString(),
  });
  return parse(res);
}

async function flowGet(path, params, fetchImpl = fetch) {
  const { config, out } = signed(params);
  const res = await fetchImpl(`${config.baseUrl}${path}?${new URLSearchParams(out).toString()}`, { method: "GET" });
  return parse(res);
}

/* ---------- Planes (precio único en assets/fa-config.js) ---------- */
function getPlans() {
  return FA_CONFIG.PLANS;
}

function getPlan(key) {
  const p = FA_CONFIG.PLANS[key];
  if (!p) return null;
  return { key, ...p, flowPlanId: flowPlanId(key, p.amount) };
}

function flowPlanId(key, amount) {
  const prefix = (process.env.FLOW_PLAN_PREFIX || "fa").trim() || "fa";
  return `${prefix}-${key}-${Math.round(amount)}`;
}

function planKeyFromFlowPlanId(planId) {
  const m = String(planId || "").match(/-(basico|pro|premium)-\d+$/);
  return m ? m[1] : null;
}

/** Crea el plan en Flow si no existe. Idempotente. */
async function ensureFlowPlan(key) {
  const plan = getPlan(key);
  if (!plan) throw new FlowError("Plan desconocido", "bad_plan", 400);
  try {
    const existing = await flowGet("/plans/get", { planId: plan.flowPlanId });
    if (existing && existing.planId) return { planId: plan.flowPlanId, created: false, amount: existing.amount };
  } catch (err) {
    if (err.code === "not_configured") throw err;
    /* Flow responde error si el plan no existe: se crea abajo. */
  }
  const created = await flowPost("/plans/create", {
    planId: plan.flowPlanId,
    name: `Frío Austral · ${plan.name}`,
    currency: "CLP",
    amount: Math.round(plan.amount),
    interval: 3, // mensual
    interval_count: 1,
    trial_period_days: 0,
    days_until_due: 3,
    charges_retries_number: 3,
    urlCallback: `${siteUrl()}/api/flow/webhook`,
  });
  return { planId: plan.flowPlanId, created: true, amount: created.amount };
}

async function ensureAllFlowPlans() {
  const out = [];
  for (const key of Object.keys(getPlans())) out.push({ key, ...(await ensureFlowPlan(key)) });
  return out;
}

/* ---------- Clientes, tarjeta y suscripciones ---------- */
const createCustomer = ({ name, email, externalId }) =>
  flowPost("/customer/create", { name, email, externalId });
const registerCard = (customerId) =>
  flowPost("/customer/register", { customerId, url_return: `${siteUrl()}/api/flow/card-return` });
const getRegisterStatus = (token) => flowGet("/customer/getRegisterStatus", { token });
const unregisterCard = (customerId) => flowPost("/customer/unRegister", { customerId });
const getCustomer = (customerId) => flowGet("/customer/get", { customerId });
const createSubscription = ({ planId, customerId }) => flowPost("/subscription/create", { planId, customerId });
const getSubscription = (subscriptionId) => flowGet("/subscription/get", { subscriptionId });
const cancelSubscription = (subscriptionId, atPeriodEnd = true) =>
  flowPost("/subscription/cancel", { subscriptionId, at_period_end: atPeriodEnd ? 1 : 0 });
const changeSubscriptionPlan = (subscriptionId, newPlanId) =>
  flowPost("/subscription/changePlan", { subscriptionId, newPlanId });
const getPaymentStatus = (token) => flowGet("/payment/getStatus", { token });

/* ---------- Fechas de Flow ("YYYY-MM-DD HH:MM:SS", hora de Chile) ---------- */
function santiagoOffsetMinutes(date) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Santiago",
        hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(date).map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch (e) {
    return -180;
  }
}

function flowDate(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const off = santiagoOffsetMinutes(new Date(naive));
  return new Date(naive - off * 60000).toISOString();
}

/**
 * Traduce la suscripción de Flow al estado del panel.
 * Puede preguntar solo si la suscripción está vigente (1 activa / 2 trial) y el último importe está pagado.
 */
function mapSubscription(sub, now = new Date()) {
  const invoices = Array.isArray(sub && sub.invoices) ? sub.invoices.slice() : [];
  invoices.sort((a, b) => String(a.created || "").localeCompare(String(b.created || "")) || (a.id || 0) - (b.id || 0));
  const valid = invoices.filter((i) => Number(i.status) !== 2);
  const last = valid[valid.length - 1] || null;
  const flowStatus = Number(sub && sub.status);
  const cancelAtEnd = Number(sub && sub.cancel_at_period_end) === 1;
  const morose = Number(sub && sub.morose);
  let status;
  if (flowStatus === 4) status = "cancelada";
  else if (flowStatus === 0) status = "pendiente";
  else if (morose === 1) status = "morosa";
  else if (flowStatus === 2) status = cancelAtEnd ? "cancelada_fin_periodo" : "activa";
  else if (!last || Number(last.status) !== 1) status = "pago_pendiente";
  else status = cancelAtEnd ? "cancelada_fin_periodo" : "activa";
  const periodEnd = flowDate(sub && sub.period_end);
  const canAsk =
    (status === "activa" || status === "cancelada_fin_periodo") &&
    (!periodEnd || new Date(periodEnd).getTime() + 86400000 > now.getTime());
  return {
    status,
    canAsk,
    flowStatus,
    morose,
    cancelAtPeriodEnd: cancelAtEnd,
    planKey: planKeyFromFlowPlanId(sub && sub.planId),
    flowPlanId: (sub && sub.planId) || null,
    periodStart: flowDate(sub && sub.period_start),
    periodEnd,
    nextChargeAt: cancelAtEnd || flowStatus === 4 ? null : flowDate(sub && sub.next_invoice_date),
    invoices: invoices.map((i) => ({
      flow_invoice_id: Number(i.id),
      amount: Math.round(Number(i.amount) || 0),
      status: Number(i.status) === 1 ? "pagado" : Number(i.status) === 2 ? "anulado" : "impago",
      subject: i.subject || null,
      period_start: flowDate(i.period_start),
      period_end: flowDate(i.period_end),
      due_date: flowDate(i.due_date),
      paid_at: i.payment && i.payment.paymentData && i.payment.paymentData.date ? flowDate(i.payment.paymentData.date) : null,
      payment_link: Number(i.status) === 1 ? null : i.paymentLink || null,
      error: i.errorDescription || null,
      created_at: flowDate(i.created),
    })),
  };
}

module.exports = {
  FlowError,
  getFlowConfig,
  signFlowParams,
  siteUrl,
  flowPost,
  flowGet,
  getPlans,
  getPlan,
  flowPlanId,
  planKeyFromFlowPlanId,
  ensureFlowPlan,
  ensureAllFlowPlans,
  createCustomer,
  registerCard,
  getRegisterStatus,
  unregisterCard,
  getCustomer,
  createSubscription,
  getSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  getPaymentStatus,
  flowDate,
  mapSubscription,
};
