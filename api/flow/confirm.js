const { getFlowPaymentStatus } = require("../_lib/flow");

/**
 * Webhook de confirmación de Flow (urlConfirmation).
 * Flow envía el token por POST (form) o GET.
 *
 * TODO: persistir la suscripción pagada (por ejemplo en Supabase) y disparar
 * lo que ocurra después del pago (acceso a consultas, WhatsApp con Guillermo, etc.).
 * Hoy solo verifica el estado y responde 200 para que Flow no reintente sin fin.
 */
function tokenFrom(req) {
  const q = req.query || {};
  const b = req.body || {};
  return String(q.token || q.Token || b.token || b.Token || "").trim();
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).send("Método no permitido");
  }
  const token = tokenFrom(req);
  if (!token) return res.status(400).send("Falta token");
  try {
    const status = await getFlowPaymentStatus(token);
    /* status: 1 pendiente, 2 pagado, 3 rechazado, 4 anulado */
    if (Number(status.status) === 2) {
      /* TODO: guardar commerceOrder, email (status.payer), monto y plan. */
      console.log("flow.confirm.paid", {
        commerceOrder: status.commerceOrder,
        amount: status.amount,
        flowOrder: status.flowOrder,
      });
    }
    return res.status(200).send("OK");
  } catch (err) {
    console.error("flow.confirm.error", err && err.message);
    return res.status(502).send("Error al confirmar");
  }
};