/** Lógica de suscriptores: estado, cupo de preguntas, sincronización con Flow. */
const flow = require("./flow");
const { rest, enc, HttpError } = require("./supa");

const SYNC_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_MESSAGE = 4000;

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdmin(user) {
  const email = String(user.email || "").toLowerCase();
  if (email && adminEmails().includes(email)) return true;
  const rows = await rest(`admins?select=user_id&user_id=eq.${enc(user.id)}`);
  return Array.isArray(rows) && rows.length > 0;
}

async function getSubscriber(userId) {
  const rows = await rest(`subscribers?select=*&user_id=eq.${enc(userId)}`);
  return (rows && rows[0]) || null;
}

async function ensureSubscriber(user, nombre) {
  const existing = await getSubscriber(user.id);
  if (existing) return existing;
  const rows = await rest("subscribers?on_conflict=user_id", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: [{
      user_id: user.id,
      email: String(user.email || "").toLowerCase(),
      nombre: String(nombre || (user.user_metadata && user.user_metadata.nombre) || "").slice(0, 120),
    }],
  });
  return rows[0];
}

async function updateSubscriber(userId, patch) {
  const rows = await rest(`subscribers?user_id=eq.${enc(userId)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { ...patch, updated_at: new Date().toISOString() },
  });
  return (rows && rows[0]) || null;
}

/** Trae la suscripción desde Flow y la guarda (estado, período, importes). */
async function syncFromFlow(sub) {
  if (!sub || !sub.flow_subscription_id) return sub;
  const remote = await flow.getSubscription(sub.flow_subscription_id);
  const m = flow.mapSubscription(remote);
  const updated = await updateSubscriber(sub.user_id, {
    status: m.status,
    plan: m.planKey || sub.plan,
    flow_plan_id: m.flowPlanId,
    period_start: m.periodStart,
    period_end: m.periodEnd,
    next_charge_at: m.nextChargeAt,
    cancel_at_period_end: m.cancelAtPeriodEnd,
    synced_at: new Date().toISOString(),
  });
  if (m.invoices.length) {
    await rest("payments?on_conflict=flow_invoice_id", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: m.invoices.map((i) => ({ ...i, user_id: sub.user_id, flow_subscription_id: sub.flow_subscription_id })),
    });
  }
  return updated || sub;
}

async function maybeSync(sub) {
  if (!sub || !sub.flow_subscription_id) return sub;
  const age = sub.synced_at ? Date.now() - new Date(sub.synced_at).getTime() : Infinity;
  if (age < SYNC_MAX_AGE_MS) return sub;
  try {
    return await syncFromFlow(sub);
  } catch (err) {
    console.error("[sync]", err.code, err.message);
    return sub;
  }
}

function canAsk(sub, now = new Date()) {
  if (!sub || !sub.plan) return false;
  if (sub.status !== "activa" && sub.status !== "cancelada_fin_periodo") return false;
  if (sub.period_end && new Date(sub.period_end).getTime() + 86400000 < now.getTime()) return false;
  return true;
}

function periodWindow(sub, now = new Date()) {
  if (sub && sub.period_start && sub.period_end && new Date(sub.period_end) > now) {
    return { from: sub.period_start, to: sub.period_end };
  }
  const from = new Date(now.getTime() - 30 * 86400000).toISOString();
  return { from, to: null };
}

async function quotaFor(sub, now = new Date()) {
  const plan = sub && sub.plan ? flow.getPlan(sub.plan) : null;
  const limit = plan ? plan.questionsPerPeriod : 0;
  const w = periodWindow(sub, now);
  let used = 0;
  if (sub) {
    const r = await rest(
      `messages?select=id&user_id=eq.${enc(sub.user_id)}&sender=eq.cliente&created_at=gte.${enc(w.from)}`,
      { prefer: "count=exact", count: true }
    );
    used = r.count;
  }
  const unlimited = limit === null || limit === undefined;
  return {
    limit: unlimited ? null : limit,
    used,
    left: unlimited ? null : Math.max(0, limit - used),
    unlimited,
    periodFrom: w.from,
    periodTo: w.to,
  };
}

function cleanMessage(body) {
  const text = String(body || "").replace(/\r\n/g, "\n").trim();
  if (!text) throw new HttpError(400, "Escribe tu pregunta.", "empty");
  if (text.length > MAX_MESSAGE) throw new HttpError(400, `Máximo ${MAX_MESSAGE} caracteres por mensaje.`, "too_long");
  return text;
}

function publicSub(sub) {
  if (!sub) return null;
  const plan = sub.plan ? flow.getPlan(sub.plan) : null;
  return {
    email: sub.email,
    nombre: sub.nombre,
    plan: sub.plan,
    planName: plan ? plan.name : null,
    amount: plan ? plan.amount : null,
    pendingPlan: sub.pending_plan,
    status: sub.status,
    periodStart: sub.period_start,
    periodEnd: sub.period_end,
    nextChargeAt: sub.next_charge_at,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    card: sub.card_last4 ? { brand: sub.card_brand, last4: sub.card_last4 } : null,
    hasSubscription: !!sub.flow_subscription_id,
    syncedAt: sub.synced_at,
  };
}

module.exports = {
  adminEmails,
  isAdmin,
  getSubscriber,
  ensureSubscriber,
  updateSubscriber,
  syncFromFlow,
  maybeSync,
  canAsk,
  quotaFor,
  cleanMessage,
  publicSub,
  periodWindow,
};
