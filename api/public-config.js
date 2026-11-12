/** Configuración pública para el navegador (URL de Supabase y anon key: ambas son públicas por diseño). */
const { supaConfig } = require("./_lib/supa");
const { getFlowConfig } = require("./_lib/flow");

module.exports = (req, res) => {
  const c = supaConfig();
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(JSON.stringify({
    supabaseUrl: c.url || null,
    supabaseAnonKey: c.anonKey || null,
    ready: c.isConfigured,
    flowReady: getFlowConfig().isConfigured,
    flowEnv: getFlowConfig().env,
  }));
};
