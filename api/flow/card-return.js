/**
 * url_return de customer/register: Flow hace POST con "token" cuando el cliente termina de registrar la tarjeta.
 * Si había un plan pendiente, aquí se crea la suscripción mensual (cobro automático).
 */
const flow = require("../_lib/flow");
const { rest, enc } = require("../_lib/supa");
const S = require("../_lib/subs");
const { readBody, redirect, queryOf } = require("../_lib/http");

module.exports = async (req, res) => {
  const site = flow.siteUrl();
  const go = (q) => redirect(res, `${site}/mi-cuenta.html?${q}`);
  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const token = String(body.token || queryOf(req).token || "").trim();
    if (!token) return go("tarjeta=error");
    const reg = await flow.getRegisterStatus(token);
    const rows = await rest(`subscribers?select=*&flow_customer_id=eq.${enc(reg.customerId || "")}`);
    let sub = rows && rows[0];
    if (!sub) return go("tarjeta=error");
    if (String(reg.status) !== "1") {
      if (sub.pending_plan && !sub.flow_subscription_id) await S.updateSubscriber(sub.user_id, { status: "sin_suscripcion" });
      return go("tarjeta=rechazada");
    }
    sub = await S.updateSubscriber(sub.user_id, {
      card_brand: reg.creditCardType || null,
      card_last4: reg.last4CardDigits || null,
    });
    const needsSub = sub.pending_plan && (!sub.flow_subscription_id || sub.status === "cancelada" || sub.status === "pendiente_tarjeta");
    if (!needsSub) return go("tarjeta=ok");
    const plan = flow.getPlan(sub.pending_plan);
    await flow.ensureFlowPlan(plan.key);
    const created = await flow.createSubscription({ planId: plan.flowPlanId, customerId: sub.flow_customer_id });
    sub = await S.updateSubscriber(sub.user_id, {
      flow_subscription_id: created.subscriptionId,
      plan: plan.key,
      pending_plan: null,
      flow_plan_id: plan.flowPlanId,
      status: "pago_pendiente",
      cancel_at_period_end: false,
      synced_at: null,
    });
    await S.syncFromFlow(sub).catch((e) => console.error("[card-return sync]", e.code));
    return go("alta=ok");
  } catch (err) {
    console.error("[card-return]", err && err.code, err && err.message);
    return go("tarjeta=error");
  }
};
