/**
 * Acceso mínimo a Supabase desde las funciones (sin dependencias).
 * - Verifica el token del usuario con /auth/v1/user.
 * - Lee/escribe tablas con la service role (solo en el servidor; nunca va al navegador).
 */
function supaConfig() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, anonKey, serviceKey, isConfigured: Boolean(url && anonKey && serviceKey) };
}

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireConfig() {
  const c = supaConfig();
  if (!c.isConfigured) throw new HttpError(503, "La base de datos no está configurada todavía (faltan variables de Supabase).", "supabase_not_configured");
  return c;
}

async function getUserFromToken(token, fetchImpl = fetch) {
  const c = requireConfig();
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.", "no_session");
  const res = await fetchImpl(`${c.url}/auth/v1/user`, {
    headers: { apikey: c.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new HttpError(401, "Tu sesión expiró. Vuelve a ingresar.", "bad_session");
  const user = await res.json();
  if (!user || !user.id) throw new HttpError(401, "Tu sesión expiró. Vuelve a ingresar.", "bad_session");
  return user;
}

function svcHeaders(c, extra) {
  return {
    apikey: c.serviceKey,
    Authorization: `Bearer ${c.serviceKey}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

/** PostgREST: rest(path, {method, body, prefer}) */
async function rest(path, opts = {}, fetchImpl = fetch) {
  const c = requireConfig();
  const headers = svcHeaders(c, opts.prefer ? { Prefer: opts.prefer } : null);
  const res = await fetchImpl(`${c.url}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = (data && data.message) || res.statusText || "Error de base de datos";
    throw new HttpError(500, `Base de datos: ${msg}`, "db_error");
  }
  if (opts.count) {
    const range = res.headers.get("content-range") || "";
    const total = Number(range.split("/")[1]);
    return { data, count: Number.isFinite(total) ? total : (Array.isArray(data) ? data.length : 0) };
  }
  return data;
}

const enc = encodeURIComponent;

async function adminCreateUser({ email, password, nombre }, fetchImpl = fetch) {
  const c = requireConfig();
  const res = await fetchImpl(`${c.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: svcHeaders(c),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nombre } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data.msg || data.message || data.error_description || "");
    if (res.status === 422 || /already|registered|exists/i.test(msg)) {
      throw new HttpError(409, "Ya existe una cuenta con ese correo. Ingresa con tu contraseña.", "email_exists");
    }
    if (/password/i.test(msg)) throw new HttpError(400, "La contraseña no cumple los requisitos (mínimo 8 caracteres).", "weak_password");
    throw new HttpError(400, "No pudimos crear la cuenta. Revisa los datos.", "signup_failed");
  }
  return data;
}

module.exports = { supaConfig, HttpError, getUserFromToken, rest, enc, adminCreateUser };
