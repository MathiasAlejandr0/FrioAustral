/* Sesión de Supabase (email + contraseña) y llamadas a /api con el token.
   Carga supabase-js desde CDN. La URL y la anon key salen de /api/public-config (son públicas). */
(function () {
  const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js";
  let clientP = null;
  function loadScript(src) {
    return new Promise((ok, ko) => {
      if (window.supabase && window.supabase.createClient) return ok();
      const s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = ok; s.onerror = () => ko(new Error("No se pudo cargar el inicio de sesión."));
      document.head.appendChild(s);
    });
  }
  async function client() {
    if (!clientP) {
      clientP = (async () => {
        const r = await fetch("/api/public-config", { headers: { Accept: "application/json" } });
        const cfg = await r.json().catch(() => ({}));
        if (!r.ok || !cfg.ready) {
          const e = new Error("El panel todavía no está configurado (falta conectar la base de datos).");
          e.code = "not_ready"; throw e;
        }
        await loadScript(SDK);
        return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "fa-auth" }
        });
      })();
      clientP.catch(() => { clientP = null; });
    }
    return clientP;
  }
  async function session() {
    const c = await client();
    const { data } = await c.auth.getSession();
    return data.session || null;
  }
  async function api(path, opts) {
    opts = opts || {};
    const s = await session().catch(() => null);
    const headers = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (s) headers.Authorization = "Bearer " + s.access_token;
    const r = await fetch(path, { method: opts.method || (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.ok === false) {
      const e = new Error(out.message || "No pudimos completar la acción. Intenta de nuevo.");
      e.code = out.code; e.status = r.status; throw e;
    }
    return out;
  }
  async function signIn(email, password) {
    const c = await client();
    const { error } = await c.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
    if (error) {
      const e = new Error(/invalid/i.test(error.message) ? "Email o contraseña incorrectos." : "No pudimos iniciar sesión. Intenta de nuevo.");
      e.code = "login"; throw e;
    }
  }
  async function signOut() { const c = await client(); await c.auth.signOut(); }
  async function resetPassword(email) {
    const c = await client();
    const { error } = await c.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo: location.origin + "/mi-cuenta.html?recuperar=1" });
    if (error) throw new Error("No pudimos enviar el correo. Intenta en unos minutos.");
  }
  async function updatePassword(password) {
    const c = await client();
    const { error } = await c.auth.updateUser({ password });
    if (error) throw new Error("No pudimos cambiar la contraseña (mínimo 8 caracteres).");
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
  const fdate = (iso, withTime) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return withTime
      ? d.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "long", year: "numeric" });
  };
  window.FAAuth = { client, session, api, signIn, signOut, resetPassword, updatePassword, esc, clp, fdate };
})();
