/**
 * POST /api/hotmart/webhook  — postback v2.0.0 de Hotmart.
 *  - Autenticación: header X-HOTMART-HOTTOK debe ser igual a la variable HOTMART_HOTTOK (401 si no coincide).
 *  - PURCHASE_APPROVED / PURCHASE_COMPLETE      → activa el plan del correo del comprador (con o sin cuenta).
 *  - PURCHASE_CANCELED / REFUNDED / CHARGEBACK  → desactiva el plan.
 *  - SUBSCRIPTION_CANCELLATION                  → el plan sigue hasta la fecha ya pagada (date_next_charge); si ya pasó, se desactiva.
 *  - Idempotente: el mismo evento (id) dos veces no cambia nada; un evento más antiguo que el último aplicado se ignora.
 *  - Todos los eventos quedan en la tabla hotmart_events. Responde 200 a todo lo que no sea error del servidor.
 */
const { readBody, send } = require("../_lib/http");
const { HttpError } = require("../_lib/supa");
const H = require("../_lib/hotmart");
const A = require("../_lib/access");

function headerOf(req, name) {
  const h = req.headers || {};
  return h[name] || h[name.toLowerCase()] || "";
}

async function handleEvent(ev) {
  const log = (outcome, detail) => ({
    event_id: ev.eventId, event: ev.event || "?", event_created_at: ev.createdAt ? ev.createdAt.toISOString() : null,
    email: ev.email, plan: ev.plan, product_id: ev.productId, offer_code: ev.offerCode, transaction: ev.transaction,
    outcome, detail: detail || null,
  });
  if (ev.action === "ignore") return log("ignored", "Evento sin efecto en los planes.");
  if (!ev.email) return log("no_email", "El evento no trae el correo del comprador.");
  if (!ev.plan) return log("unmapped", "El producto u oferta no corresponde a ningún plan (por ejemplo, un curso).");

  const existing = await A.getAccess(ev.email, ev.plan);
  const evAt = ev.createdAt || ev.approvedAt || new Date();
  if (existing && existing.last_event_at && evAt.getTime() < new Date(existing.last_event_at).getTime()) {
    return log("stale", "Llegó un evento más antiguo que el último aplicado.");
  }
  const now = new Date();
  const common = {
    last_event: ev.event, last_event_id: ev.eventId, last_event_at: evAt.toISOString(),
    hotmart_transaction: ev.transaction, hotmart_subscriber_code: ev.subscriberCode || (existing && existing.hotmart_subscriber_code) || null,
    hotmart_product_id: ev.productId, hotmart_offer_code: ev.offerCode, source: "hotmart",
  };
  if (ev.name) common.buyer_name = ev.name.slice(0, 120);

  if (ev.action === "grant" && ev.event === "PURCHASE_COMPLETE" && existing && existing.status !== "cancelada" && existing.period_end) {
    /* COMPLETE llega al terminar la garantía de una compra ya aprobada: confirma, no extiende ni reactiva. */
    await A.saveAccess(ev.email, ev.plan, common);
    return log("applied", "Compra completa: el plan ya estaba activo, sin cambios en la vigencia.");
  }
  if (ev.action === "grant") {
    let end = H.grantPeriodEnd(ev);
    if (existing && existing.period_end && existing.status !== "cancelada" && new Date(existing.period_end) > end) end = new Date(existing.period_end);
    await A.saveAccess(ev.email, ev.plan, {
      ...common, status: "activa", period_start: (ev.approvedAt || evAt).toISOString(), period_end: end.toISOString(),
    });
    return log("applied", `Plan activo hasta ${end.toISOString()}.`);
  }
  if (ev.action === "revoke") {
    await A.saveAccess(ev.email, ev.plan, { ...common, status: "cancelada", period_end: now.toISOString() });
    return log("applied", "Plan desactivado.");
  }
  /* cancel_at_end */
  if (ev.nextCharge && ev.nextCharge.getTime() > now.getTime()) {
    await A.saveAccess(ev.email, ev.plan, { ...common, status: "cancelada_fin_periodo", period_end: ev.nextCharge.toISOString() });
    return log("applied", `Cancelada: queda activo hasta ${ev.nextCharge.toISOString()}.`);
  }
  await A.saveAccess(ev.email, ev.plan, { ...common, status: "cancelada", period_end: now.toISOString() });
  return log("applied", "Cancelada: plan desactivado.");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return send(res, 405, { ok: false, code: "method" });
    const expected = (process.env.HOTMART_HOTTOK || "").trim();
    if (!expected) {
      console.error("[hotmart] falta HOTMART_HOTTOK: se rechaza el evento");
      return send(res, 503, { ok: false, code: "not_configured" });
    }
    if (!H.hottokOk(headerOf(req, "x-hotmart-hottok"), expected)) return send(res, 401, { ok: false, code: "unauthorized" });

    const payload = await readBody(req);
    if (!payload || typeof payload !== "object" || !payload.event) throw new HttpError(400, "Evento no válido.", "bad_event");
    const ev = H.interpret(payload);

    if (await A.eventSeen(ev.eventId)) return send(res, 200, { ok: true, duplicate: true });
    const entry = await handleEvent(ev);
    if (entry.outcome === "applied" && ev.email) await A.applyAccess(ev.email);
    await A.logEvent(entry);
    send(res, 200, { ok: true, outcome: entry.outcome });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error("[hotmart]", err && err.code, err && err.message);
    send(res, status, { ok: false, code: (err && err.code) || "error" });
  }
};
