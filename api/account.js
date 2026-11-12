/**
 * API del panel "Mi cuenta" (suscriptor).
 *   POST /api/account?action=signup        {nombre, email, password}   crea la cuenta (sin sesión)
 *   GET  /api/account?action=me                                         estado, cupo, chat, pagos
 *   POST /api/account?action=start         {plan}                       inicia la suscripción (Flow)
 *   POST /api/account?action=message       {body}                       envía una pregunta (respeta cupo)
 *   POST /api/account?action=cancel                                     cancela al final del período
 *   POST /api/account?action=change-plan   {plan}                       cambia de plan
 *   POST /api/account?action=change-card                                registrar otra tarjeta en Flow
 *   GET  /api/account?action=community&q=                               base de preguntas (Taller Pro)
 */
const flow = require("./_lib/flow");
const { getUserFromToken, rest, enc, adminCreateUser, HttpError } = require("./_lib/supa");
const S = require("./_lib/subs");
const { readBody, send, bearer, queryOf, handle } = require("./_lib/http");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function needPost(req) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
}

async function signup(req, res) {
  needPost(req);
  const b = await readBody(req);
  const nombre = String(b.nombre || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!nombre) throw new HttpError(400, "Escribe tu nombre.", "nombre");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Revisa tu email.", "email");
  if (password.length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.", "password");
  const user = await adminCreateUser({ email, password, nombre });
  await S.ensureSubscriber({ id: user.id, email, user_metadata: { nombre } }, nombre);
  send(res, 201, { ok: true });
}

async function me(req, res, user) {
  let sub = await S.ensureSubscriber(user);
  sub = await S.maybeSync(sub);
  const [quota, messages, payments] = await Promise.all([
    S.quotaFor(sub),
    rest(`messages?select=id,sender,body,created_at&user_id=eq.${enc(user.id)}&order=created_at.desc&limit=200`),
    rest(`payments?select=flow_invoice_id,amount,status,subject,period_start,period_end,due_date,paid_at,payment_link,created_at&user_id=eq.${enc(user.id)}&order=created_at.desc&limit=36`),
  ]);
  await rest(`messages?user_id=eq.${enc(user.id)}&sender=eq.equipo&read_by_client=eq.false`, {
    method: "PATCH", prefer: "return=minimal", body: { read_by_client: true },
  }).catch(() => {});
  const plan = sub.plan ? flow.getPlan(sub.plan) : null;
  send(res, 200, {
    ok: true,
    subscriber: S.publicSub(sub),
    canAsk: S.canAsk(sub),
    quota,
    features: plan ? { calls: !!plan.calls, community: !!plan.community } : { calls: false, community: false },
    messages: (messages || []).reverse(),
    payments: payments || [],
    flowEnv: flow.getFlowConfig().env,
  });
}

async function createSubscriptionFor(sub, planKey) {
  const plan = flow.getPlan(planKey);
  await flow.ensureFlowPlan(planKey);
  const created = await flow.createSubscription({ planId: plan.flowPlanId, customerId: sub.flow_customer_id });
  let updated = await S.updateSubscriber(sub.user_id, {
    flow_subscription_id: created.subscriptionId,
    plan: planKey,
    pending_plan: null,
    flow_plan_id: plan.flowPlanId,
    status: "pago_pendiente",
    cancel_at_period_end: false,
    synced_at: null,
  });
  try { updated = await S.syncFromFlow(updated); } catch (e) { console.error("[sync after create]", e.code); }
  return updated;
}

async function ensureCustomer(sub) {
  if (sub.flow_customer_id) return sub;
  const c = await flow.createCustomer({ name: sub.nombre || sub.email, email: sub.email, externalId: sub.user_id });
  return S.updateSubscriber(sub.user_id, { flow_customer_id: c.customerId });
}

async function start(req, res, user) {
  needPost(req);
  const b = await readBody(req);
  const planKey = String(b.plan || "");
  if (!flow.getPlan(planKey)) throw new HttpError(400, "Plan no válido.", "bad_plan");
  let sub = await S.ensureSubscriber(user, b.nombre);
  if (sub.flow_subscription_id && sub.status !== "cancelada") {
    sub = await S.syncFromFlow(sub).catch(() => sub);
    if (sub.status !== "cancelada") {
      throw new HttpError(409, "Ya tienes una suscripción. Para cambiar de plan usa el panel Mi cuenta.", "already_subscribed");
    }
  }
  sub = await ensureCustomer(sub);
  if (sub.card_last4) {
    await createSubscriptionFor(sub, planKey);
    return send(res, 200, { ok: true, redirect: "mi-cuenta.html?alta=ok" });
  }
  await S.updateSubscriber(sub.user_id, { pending_plan: planKey, status: "pendiente_tarjeta" });
  const reg = await flow.registerCard(sub.flow_customer_id);
  send(res, 200, { ok: true, redirect: `${reg.url}?token=${encodeURIComponent(reg.token)}` });
}

async function message(req, res, user) {
  needPost(req);
  const b = await readBody(req);
  const text = S.cleanMessage(b.body);
  let sub = await S.getSubscriber(user.id);
  sub = await S.maybeSync(sub);
  if (!S.canAsk(sub)) throw new HttpError(403, "Tu suscripción no está activa. Renueva o regulariza el pago para seguir preguntando.", "inactive");
  const q = await S.quotaFor(sub);
  if (!q.unlimited && q.left <= 0) {
    throw new HttpError(403, `Usaste tus ${q.limit} preguntas de este período. Puedes cambiarte al plan Ilimitado.`, "quota");
  }
  const rows = await rest("messages", {
    method: "POST", prefer: "return=representation",
    body: [{ user_id: user.id, sender: "cliente", body: text }],
  });
  send(res, 201, { ok: true, message: rows[0], quota: await S.quotaFor(sub) });
}

async function cancel(req, res, user) {
  needPost(req);
  const sub = await S.getSubscriber(user.id);
  if (!sub || !sub.flow_subscription_id || sub.status === "cancelada") throw new HttpError(400, "No tienes una suscripción activa.", "no_sub");
  await flow.cancelSubscription(sub.flow_subscription_id, true);
  const updated = await S.syncFromFlow(sub).catch(() => S.updateSubscriber(user.id, { cancel_at_period_end: true, status: "cancelada_fin_periodo" }));
  send(res, 200, { ok: true, subscriber: S.publicSub(updated) });
}

async function changePlan(req, res, user) {
  needPost(req);
  const b = await readBody(req);
  const planKey = String(b.plan || "");
  const plan = flow.getPlan(planKey);
  if (!plan) throw new HttpError(400, "Plan no válido.", "bad_plan");
  const sub = await S.getSubscriber(user.id);
  if (!sub || !sub.flow_subscription_id || sub.status === "cancelada") throw new HttpError(400, "No tienes una suscripción activa.", "no_sub");
  if (sub.plan === planKey) throw new HttpError(400, "Ya estás en ese plan.", "same_plan");
  await flow.ensureFlowPlan(planKey);
  await flow.changeSubscriptionPlan(sub.flow_subscription_id, plan.flowPlanId);
  let updated = await S.updateSubscriber(user.id, { plan: planKey, flow_plan_id: plan.flowPlanId, synced_at: null });
  updated = await S.syncFromFlow(updated).catch(() => updated);
  send(res, 200, { ok: true, subscriber: S.publicSub(updated) });
}

async function changeCard(req, res, user) {
  needPost(req);
  let sub = await S.ensureSubscriber(user);
  sub = await ensureCustomer(sub);
  let reg;
  try {
    reg = await flow.registerCard(sub.flow_customer_id);
  } catch (err) {
    if (err.name !== "FlowError" || err.code === "not_configured") throw err;
    /* Si Flow no deja registrar con una tarjeta vigente, se quita la anterior y se registra la nueva. */
    await flow.unregisterCard(sub.flow_customer_id);
    await S.updateSubscriber(user.id, { card_brand: null, card_last4: null });
    reg = await flow.registerCard(sub.flow_customer_id);
  }
  send(res, 200, { ok: true, redirect: `${reg.url}?token=${encodeURIComponent(reg.token)}` });
}

async function community(req, res, user) {
  const sub = await S.maybeSync(await S.getSubscriber(user.id));
  const plan = sub && sub.plan ? flow.getPlan(sub.plan) : null;
  if (!plan || !plan.community || !S.canAsk(sub)) throw new HttpError(403, "La base de preguntas es parte del plan Taller Pro.", "not_premium");
  const q = String(queryOf(req).q || "").trim().toLowerCase().slice(0, 80);
  const rows = await rest("messages?select=user_id,sender,body,created_at&order=user_id.asc,created_at.asc&limit=3000");
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if (m.sender !== "cliente") continue;
    const reply = rows.slice(i + 1).find((x) => x.user_id === m.user_id && x.sender === "equipo");
    const nextQ = rows.slice(i + 1).find((x) => x.user_id === m.user_id && x.sender === "cliente");
    if (!reply || (nextQ && new Date(nextQ.created_at) < new Date(reply.created_at))) continue;
    if (q && !(m.body.toLowerCase().includes(q) || reply.body.toLowerCase().includes(q))) continue;
    items.push({ pregunta: m.body, respuesta: reply.body, fecha: reply.created_at });
  }
  items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  send(res, 200, { ok: true, items: items.slice(0, 60) });
}

const ROUTES = { me, start, message, cancel, "change-plan": changePlan, "change-card": changeCard, community };

module.exports = handle(async (req, res) => {
  const action = String(queryOf(req).action || "");
  if (action === "signup") return signup(req, res);
  const fn = ROUTES[action];
  if (!fn) throw new HttpError(404, "Acción no encontrada.", "not_found");
  const user = await getUserFromToken(bearer(req));
  return fn(req, res, user);
});
