/**
 * urlCallback de los planes: Flow hace POST con "token" cada vez que se paga (o intenta pagar) un importe.
 * Se consulta el pago con payment/getStatus y se resincroniza la suscripción del pagador.
 * Siempre responde 200 para que Flow no reintente indefinidamente; los errores quedan en el log.
 */
const flow = require("../_lib/flow");
const { rest, enc } = require("../_lib/supa");
const S = require("../_lib/subs");
const { readBody, send, queryOf } = require("../_lib/http");

module.exports = async (req, res) => {
  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const token = String(body.token || queryOf(req).token || "").trim();
    if (!token) return send(res, 200, { ok: true, ignored: "no_token" });
    const pay = await flow.getPaymentStatus(token);
    const email = String(pay.payer || "").toLowerCase();
    let subs = [];
    if (email) subs = await rest(`subscribers?select=*&email=eq.${enc(email)}&flow_subscription_id=not.is.null`);
    for (const sub of subs || []) await S.syncFromFlow(sub);
    return send(res, 200, { ok: true, synced: (subs || []).length });
  } catch (err) {
    console.error("[flow webhook]", err && err.code, err && err.message);
    return send(res, 200, { ok: false });
  }
};
