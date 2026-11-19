/**
 * Webhook de Hotmart (postback v2.0.0): validación del hottok, mapeo producto→plan e interpretación del evento.
 * Docs: https://developers.hotmart.com/docs/en/2.0.0/webhook/purchase-webhook/
 *       https://developers.hotmart.com/docs/en/2.0.0/webhook/cancel-subscription-webhook/
 *
 * Campos que usamos del payload:
 *   id, event, creation_date (ms)
 *   data.product.id / data.product.ucode            producto comprado
 *   data.purchase.offer.code                        código de la oferta
 *   data.purchase.transaction, approved_date (ms), date_next_charge (ms)
 *   data.buyer.email / name                         comprador (eventos PURCHASE_*)
 *   data.subscriber.email / code                    suscriptor (SUBSCRIPTION_CANCELLATION)
 *   data.date_next_charge (ms)                      SUBSCRIPTION_CANCELLATION: hasta cuándo queda pagado
 */
const crypto = require("crypto");
const FA_CONFIG = require("../../assets/fa-config.js");

const GRANT_EVENTS = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"];
const REVOKE_EVENTS = ["PURCHASE_CANCELED", "PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK"];
const CANCEL_AT_END_EVENTS = ["SUBSCRIPTION_CANCELLATION"];
const DAY_MS = 86400000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Compara el hottok en tiempo constante. `expected` vacío nunca coincide. */
function hottokOk(received, expected) {
  if (!expected || !received) return false;
  const a = crypto.createHash("sha256").update(String(received)).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/** "https://pay.hotmart.com/D108538114T?x=1" → "D108538114T" */
function checkoutCode(url) {
  const m = /^https:\/\/pay\.hotmart\.com\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(String(url || ""));
  return m ? m[1] : "";
}

/**
 * Tabla valor-de-Hotmart → plan. Sale de los links de pago de fa-config.js: el código del link
 * (D108538114T) y el número que lleva dentro (108538114, que es el data.product.id del producto).
 * Se puede ampliar o corregir sin tocar código con HOTMART_PLAN_MAP, un JSON {"<product.id | product.ucode | offer.code>": "basico|pro|premium"}.
 */
function planMap(env = process.env) {
  const map = {};
  for (const [key, plan] of Object.entries(FA_CONFIG.PLANS)) {
    const code = checkoutCode(plan.hotmartCheckoutUrl);
    if (!code) continue;
    map[code] = key;
    const digits = /(\d{6,})/.exec(code);
    if (digits) map[digits[1]] = key;
  }
  if (env.HOTMART_PLAN_MAP) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(env.HOTMART_PLAN_MAP))) {
        if (FA_CONFIG.PLANS[v]) map[String(k)] = v;
      }
    } catch (e) { console.error("[hotmart] HOTMART_PLAN_MAP no es un JSON válido"); }
  }
  return map;
}

function toDate(v) {
  if (v === undefined || v === null || v === "") return null;
  const d = typeof v === "number" || /^\d+$/.test(String(v)) ? new Date(Number(v)) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function str(v) {
  return v === undefined || v === null || v === "" ? null : String(v);
}

function classify(event) {
  if (GRANT_EVENTS.includes(event)) return "grant";
  if (REVOKE_EVENTS.includes(event)) return "revoke";
  if (CANCEL_AT_END_EVENTS.includes(event)) return "cancel_at_end";
  return "ignore";
}

/** Convierte el payload de Hotmart en un objeto plano. No lanza: lo que falta queda en null. */
function interpret(payload, env = process.env) {
  const p = payload && typeof payload === "object" ? payload : {};
  const d = p.data && typeof p.data === "object" ? p.data : {};
  const product = d.product || {};
  const purchase = d.purchase || {};
  const offer = purchase.offer || {};
  const buyer = d.buyer || {};
  const subscriber = d.subscriber || (d.subscription && d.subscription.user) || {};
  const emailRaw = String(buyer.email || subscriber.email || "").trim().toLowerCase();
  const map = planMap(env);
  const candidates = [str(product.id), str(product.ucode), str(offer.code)].filter(Boolean);
  const hit = candidates.find((c) => map[c]);
  const event = String(p.event || "");
  const createdAt = toDate(p.creation_date);
  const approvedAt = toDate(purchase.approved_date);
  const nextCharge = toDate(purchase.date_next_charge) || toDate(d.date_next_charge);
  const id = str(p.id) || crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex").slice(0, 40);
  return {
    eventId: id,
    event,
    action: classify(event),
    createdAt,
    approvedAt,
    nextCharge,
    email: EMAIL_RE.test(emailRaw) ? emailRaw : null,
    name: str(buyer.name || subscriber.name),
    plan: hit ? map[hit] : null,
    productId: str(product.id) || str(product.ucode),
    offerCode: str(offer.code),
    transaction: str(purchase.transaction),
    subscriberCode: str(subscriber.code || (d.subscription && d.subscription.subscriber && d.subscription.subscriber.code)),
  };
}

/** Fin del período pagado: date_next_charge si es posterior a la compra; si no, 31 días desde la aprobación. */
function grantPeriodEnd(ev) {
  const base = ev.approvedAt || ev.createdAt || new Date();
  if (ev.nextCharge && ev.nextCharge.getTime() > base.getTime()) return ev.nextCharge;
  return new Date(base.getTime() + 31 * DAY_MS);
}

module.exports = { hottokOk, checkoutCode, planMap, interpret, classify, grantPeriodEnd, GRANT_EVENTS, REVOKE_EVENTS, CANCEL_AT_END_EVENTS, DAY_MS };
