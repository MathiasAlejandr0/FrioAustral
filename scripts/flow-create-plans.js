#!/usr/bin/env node
/**
 * Crea en Flow los 3 planes mensuales con los precios de assets/fa-config.js (idempotente:
 * si el plan ya existe no hace nada). Usa FLOW_API_KEY / FLOW_SECRET_KEY / FLOW_API_URL / SITE_URL del entorno.
 *   node --env-file=.env.local scripts/flow-create-plans.js
 * También se puede hacer desde equipo.html → "Verificar planes en Flow".
 */
const flow = require("../api/_lib/flow");

(async () => {
  const cfg = flow.getFlowConfig();
  if (!cfg.isConfigured) {
    console.error("Faltan FLOW_API_KEY y FLOW_SECRET_KEY en el entorno.");
    process.exit(1);
  }
  console.log(`Flow: ${cfg.env} (${cfg.baseUrl}) · webhook: ${flow.siteUrl()}/api/flow/webhook`);
  const out = await flow.ensureAllFlowPlans();
  for (const p of out) console.log(`${p.planId}: ${p.created ? "creado" : "ya existía"} (${p.amount} CLP/mes)`);
})().catch((err) => {
  console.error("Error:", err.code || "", err.message);
  process.exit(1);
});
