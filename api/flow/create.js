const {
  getFlowConfig,
  getPlanAmounts,
  planLabels,
  createFlowPayment,
} = require("../_lib/flow");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  const billing = (process.env.FLOW_BILLING_TYPE || "one_time").trim();
  if (billing === "subscription") {
    /* TODO: la API de suscripciones recurrentes de Flow necesita planes creados
       en la cuenta (planId). No se inventan. Usar one_time hasta confirmar. */
    return res.status(503).json({
      message: "La suscripción recurrente de Flow todavía no está configurada. Falta confirmar el tipo de plan y crear los planes en la cuenta de Flow.",
      code: "billing_not_configured",
    });
  }

  const config = getFlowConfig();
  if (!config.isConfigured) {
    return res.status(503).json({
      message: "El pago con Flow todavía no está listo: faltan FLOW_API_KEY y FLOW_SECRET_KEY en el entorno (por ahora se usa sandbox).",
      code: "not_configured",
    });
  }

  const amounts = getPlanAmounts();
  if (!Object.keys(amounts).length) {
    return res.status(503).json({
      message: "El pago con Flow todavía no está listo: falta confirmar los precios (variable FLOW_PLAN_AMOUNTS).",
      code: "amounts_not_configured",
    });
  }

  const body = readBody(req);
  const plan = String(body.plan || "").trim();
  const nombre = String(body.nombre || "").trim();
  const email = String(body.email || "").trim();
  const amount = amounts[plan];
  const labels = planLabels();

  if (!plan || !amount) {
    return res.status(400).json({
      message: "Ese plan no está disponible para el pago, o su precio no fue confirmado.",
      code: "unknown_plan",
    });
  }
  if (!nombre || nombre.length < 2) {
    return res.status(400).json({ message: "Escribe tu nombre." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Escribe un email válido." });
  }

  const commerceOrder = `fa-${plan}-${Date.now()}`.slice(0, 45);
  const subject = `Suscripción Frío Austral — ${labels[plan] || plan}`;

  try {
    const payment = await createFlowPayment({
      commerceOrder,
      subject,
      amount,
      email,
    });
    return res.status(200).json({
      redirectUrl: payment.redirectUrl,
      token: payment.token,
      commerceOrder,
    });
  } catch (err) {
    const message = err && err.code === "not_configured"
      ? err.message
      : "No se pudo crear el pago en Flow. Inténtalo de nuevo o escríbenos por WhatsApp.";
    return res.status(502).json({ message, code: err && err.code });
  }
};