const { getFlowPaymentStatus, siteUrl } = require("../_lib/flow");

/**
 * urlReturn de Flow: la persona vuelve acá después de pagar o cancelar.
 * Redirige a pago-return.html con un estado legible (sin secretos).
 */
function tokenFrom(req) {
  const q = req.query || {};
  const b = req.body || {};
  return String(q.token || q.Token || b.token || b.Token || "").trim();
}

function statusLabel(code) {
  if (Number(code) === 2) return "paid";
  if (Number(code) === 1) return "pending";
  if (Number(code) === 3) return "rejected";
  if (Number(code) === 4) return "canceled";
  return "error";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const site = siteUrl();
  const token = tokenFrom(req);
  const to = (status) => {
    const url = new URL("/pago-return.html", site + "/");
    url.searchParams.set("status", status);
    const wa = (process.env.FLOW_SUCCESS_WHATSAPP || "").trim();
    if (wa && status === "paid") url.searchParams.set("wa", wa);
    res.statusCode = 302;
    res.setHeader("Location", url.toString());
    res.end();
  };
  if (!token) return to("error");
  try {
    const data = await getFlowPaymentStatus(token);
    return to(statusLabel(data.status));
  } catch (err) {
    return to("error");
  }
};