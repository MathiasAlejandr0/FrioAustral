/* Pinta los precios y cupos de los planes desde FA_CONFIG.PLANS (assets/fa-config.js).
   Los planes y los cursos se pagan en Hotmart: aquí no hay ningún cobro. */
(function () {
  const PLANS = (window.FA_CONFIG || {}).PLANS || {};
  const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

  function paintPrices() {
    document.querySelectorAll("[data-fa-price]").forEach((el) => {
      const p = PLANS[el.getAttribute("data-fa-price")];
      if (p) el.textContent = clp(p.amount);
    });
    document.querySelectorAll("[data-fa-quota]").forEach((el) => {
      const p = PLANS[el.getAttribute("data-fa-quota")];
      if (p) el.textContent = p.questionsPerPeriod == null ? "Ilimitadas" : String(p.questionsPerPeriod);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintPrices);
  else paintPrices();
})();
