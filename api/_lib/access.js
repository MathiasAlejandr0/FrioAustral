/**
 * Acceso por plan guardado por EMAIL (tabla plan_access) y su vínculo con la cuenta del sitio.
 * El webhook de Hotmart (y, como respaldo, el admin) escriben aquí; applyAccess() copia el resultado
 * a subscribers cuando existe una cuenta con ese correo.
 */
const { rest, enc } = require("./supa");

const RANK = { basico: 1, pro: 2, premium: 3 };
const GRACE_MS = 86400000; /* mismo margen de 1 día que S.canAsk */

async function getAccess(email, plan) {
  const rows = await rest(`plan_access?select=*&email=eq.${enc(email)}&plan=eq.${enc(plan)}&limit=1`);
  return (rows && rows[0]) || null;
}

async function listAccess(email) {
  return (await rest(`plan_access?select=*&email=eq.${enc(email)}&limit=20`)) || [];
}

/** Crea o actualiza la fila (email, plan). */
async function saveAccess(email, plan, fields) {
  const now = new Date().toISOString();
  const existing = await getAccess(email, plan);
  if (existing) {
    const rows = await rest(`plan_access?id=eq.${enc(existing.id)}`, {
      method: "PATCH", prefer: "return=representation", body: { ...fields, updated_at: now },
    });
    return (rows && rows[0]) || { ...existing, ...fields };
  }
  const rows = await rest("plan_access", {
    method: "POST", prefer: "return=representation", body: [{ email, plan, ...fields }],
  });
  return rows[0];
}

/** Plan que corresponde a un correo según sus filas de plan_access. */
function effective(rows, now = new Date()) {
  const live = rows.filter((r) => (r.status === "activa" || r.status === "cancelada_fin_periodo") && r.period_end && new Date(r.period_end).getTime() + GRACE_MS >= now.getTime());
  if (live.length) {
    live.sort((a, b) => (RANK[b.plan] - RANK[a.plan]) || String(b.period_end).localeCompare(String(a.period_end)));
    const r = live[0];
    return { plan: r.plan, status: r.status, period_start: r.period_start || null, period_end: r.period_end };
  }
  if (!rows.length) return null;
  const last = rows.slice().sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))[0];
  return { plan: last.plan, status: "cancelada", period_start: last.period_start || null, period_end: last.period_end || null };
}

/**
 * Copia el acceso por email a las cuentas con ese correo. Sin filas en plan_access no toca nada.
 * Devuelve true si cambió alguna cuenta.
 */
async function applyAccess(email, now = new Date()) {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return false;
  const rows = await listAccess(key);
  const eff = effective(rows, now);
  if (!eff) return false;
  const subs = await rest(`subscribers?select=user_id,plan,status,period_end&email=eq.${enc(key)}&limit=5`);
  let changed = false;
  for (const s of subs || []) {
    const same = s.plan === eff.plan && s.status === eff.status && (s.period_end ? new Date(s.period_end).getTime() : null) === (eff.period_end ? new Date(eff.period_end).getTime() : null);
    if (same) continue;
    await rest(`subscribers?user_id=eq.${enc(s.user_id)}`, {
      method: "PATCH", prefer: "return=minimal",
      body: {
        plan: eff.plan, pending_plan: null, status: eff.status,
        period_start: eff.period_start, period_end: eff.period_end,
        cancel_at_period_end: eff.status === "cancelada_fin_periodo",
        updated_at: new Date().toISOString(),
      },
    });
    changed = true;
  }
  return changed;
}

async function eventSeen(eventId) {
  const rows = await rest(`hotmart_events?select=id&event_id=eq.${enc(eventId)}&limit=1`);
  return !!(rows && rows.length);
}

async function logEvent(row) {
  await rest("hotmart_events?on_conflict=event_id", {
    method: "POST", prefer: "return=minimal,resolution=ignore-duplicates", body: [row],
  });
}

module.exports = { getAccess, listAccess, saveAccess, effective, applyAccess, eventSeen, logEvent, RANK };
