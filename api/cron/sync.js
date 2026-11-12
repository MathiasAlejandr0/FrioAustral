/** Cron diario (vercel.json): resincroniza con Flow todas las suscripciones vigentes. Protegido con CRON_SECRET. */
const { rest } = require("../_lib/supa");
const S = require("../_lib/subs");
const { send, bearer } = require("../_lib/http");

module.exports = async (req, res) => {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret || bearer(req) !== secret) return send(res, 401, { ok: false });
  const subs = await rest("subscribers?select=*&flow_subscription_id=not.is.null&status=neq.cancelada&limit=2000");
  let ok = 0, fail = 0;
  for (const sub of subs || []) {
    try { await S.syncFromFlow(sub); ok++; } catch (e) { fail++; console.error("[cron sync]", e.code); }
  }
  send(res, 200, { ok: true, synced: ok, failed: fail });
};
