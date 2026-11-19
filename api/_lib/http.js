const { HttpError } = require("./supa");

const MAX_BODY_BYTES = 64 * 1024;

/** Las APIs esperan un objeto, no null, arrays ni valores JSON escalares. */
function bodyObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Envía los datos como un objeto.", "bad_body");
  return body;
}

async function readBody(req) {
  const contentType = (req.headers || {})["content-type"];
  /* null = Vercel no parseó nada (petición sin cuerpo): se lee el stream como siempre. */
  if (req.body !== undefined && req.body !== null) {
    let body = req.body;
    /* Vercel puede entregar el body ya parseado; también ahí se aplica el límite (antes solo al stream). */
    const text = Buffer.isBuffer(body) ? body.toString("utf8") : typeof body === "string" ? body : JSON.stringify(body);
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new HttpError(413, "Solicitud demasiado grande.", "too_large");
    if (typeof body === "string" || Buffer.isBuffer(body)) body = parseText(text, contentType);
    return bodyObject(body);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Solicitud demasiado grande.", "too_large");
    chunks.push(buf);
  }
  return bodyObject(parseText(Buffer.concat(chunks).toString("utf8"), contentType));
}

function parseText(text, contentType) {
  if (!text) return {};
  if (String(contentType || "").includes("application/json")) {
    try { return JSON.parse(text); } catch (e) { throw new HttpError(400, "JSON inválido.", "bad_json"); }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function queryOf(req) {
  if (req.query && typeof req.query === "object") return req.query;
  const u = new URL(req.url || "/", "http://x");
  return Object.fromEntries(u.searchParams);
}

/** Envuelve un handler: errores controlados con mensaje en español y sin filtrar detalles internos. */
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.status || err.httpStatus || 500;
      const known = err instanceof HttpError;
      if (!known || status >= 500) console.error("[api]", err && err.code, err && err.message);
      let message = known ? err.message : "Error inesperado. Intenta de nuevo.";
      send(res, status >= 400 && status < 600 ? status : 500, { ok: false, code: err.code || "error", message });
    }
  };
}

module.exports = { readBody, send, redirect, bearer, queryOf, handle };
