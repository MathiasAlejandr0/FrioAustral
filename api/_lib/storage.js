/**
 * Supabase Storage desde el servidor (service role, sin dependencias).
 * Buckets: plan-material (PRIVADO, URLs firmadas), site-media y free-resources (públicos).
 * La service role nunca llega al navegador: el navegador solo recibe un token de subida de un solo uso
 * para una ruta concreta, o una URL firmada de descarga de pocos minutos.
 */
const { supaConfig, HttpError } = require("./supa");

const BUCKET_MATERIAL = "plan-material";
const BUCKET_MEDIA = "site-media";
const BUCKET_FREE = "free-resources";   /* público: recursos gratis (documentos, fotos de referencia y videos cortos) */

function cfg() {
  const c = supaConfig();
  if (!c.isConfigured) throw new HttpError(503, "La base de datos no está configurada todavía (faltan variables de Supabase).", "supabase_not_configured");
  return c;
}

function headers(c, extra) {
  return { apikey: c.serviceKey, Authorization: `Bearer ${c.serviceKey}`, "Content-Type": "application/json", ...(extra || {}) };
}

const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");

async function call(path, init, fetchImpl = fetch) {
  const c = cfg();
  const res = await fetchImpl(`${c.url}/storage/v1/${path}`, { ...init, headers: headers(c, init && init.headers) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/** Token de subida de un solo uso para una ruta nueva (el navegador sube directo a Storage). */
async function createSignedUpload(bucket, path, fetchImpl) {
  const r = await call(`object/upload/sign/${bucket}/${encPath(path)}`, { method: "POST", body: "{}" }, fetchImpl);
  if (!r.ok || !r.data || !r.data.url) {
    console.error("[storage] upload sign", r.status, r.data && r.data.message);
    throw new HttpError(502, "No pudimos preparar la subida del archivo. Intenta de nuevo.", "storage_error");
  }
  const token = new URL(r.data.url, "http://x").searchParams.get("token");
  if (!token) throw new HttpError(502, "No pudimos preparar la subida del archivo. Intenta de nuevo.", "storage_error");
  return { bucket, path, token };
}

/** URL firmada de descarga (expira). Sirve también para comprobar que el archivo existe. */
async function createSignedDownload(bucket, path, { expiresIn = 120, downloadName } = {}, fetchImpl) {
  const r = await call(`object/sign/${bucket}/${encPath(path)}`, { method: "POST", body: JSON.stringify({ expiresIn }) }, fetchImpl);
  const rel = r.data && (r.data.signedURL || r.data.signedUrl);
  if (!r.ok || !rel) return null;
  const c = cfg();
  const url = `${c.url}/storage/v1${String(rel).startsWith("/") ? "" : "/"}${rel}`;
  return downloadName ? `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(downloadName)}` : url;
}

async function removeObjects(bucket, paths, fetchImpl) {
  if (!paths.length) return;
  const r = await call(`object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: paths }) }, fetchImpl);
  if (!r.ok) console.error("[storage] remove", r.status, r.data && r.data.message);
}

function publicUrl(bucket, path) {
  const c = cfg();
  return `${c.url}/storage/v1/object/public/${bucket}/${encPath(path)}`;
}

module.exports = { BUCKET_MATERIAL, BUCKET_MEDIA, BUCKET_FREE, createSignedUpload, createSignedDownload, removeObjects, publicUrl };
