/** Planes de suscripción (precios y beneficios en assets/fa-config.js). El pago se hace en Hotmart. */
const FA_CONFIG = require("../../assets/fa-config.js");

function getPlans() {
  return FA_CONFIG.PLANS;
}

function getPlan(key) {
  const p = FA_CONFIG.PLANS[key];
  return p ? { key, ...p } : null;
}

module.exports = { getPlans, getPlan };
