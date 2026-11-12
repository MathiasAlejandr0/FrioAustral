const { HttpError } = require("./supa");

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return parseText(req.body, req.headers["content-type"]);
    if (Buffer.isBuffer(req.body)) return parseText(req.body.toString("utf8"), req.headers["content-type"]);
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, "Solicitud demasiado grande.", "too_large");
    chunks.push(chunk);
  }
  return parseText(Buffer.concat(chunks).toString("utf8"), req.headers["content-type"]);
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
      const known = err instanceof HttpError || err.name === "FlowError";
      if (!known || status >= 500) console.error("[api]", err && err.code, err && err.message);
      let message = known ? err.message : "Error inesperado. Intenta de nuevo.";
      if (err.name === "FlowError" && err.code !== "not_configured") message = "Flow rechazó la operación. Intenta de nuevo o escríbenos.";
      send(res, status >= 400 && status < 600 ? status : 500, { ok: false, code: err.code || "error", message });
    }
  };
}

module.exports = { readBody, send, redirect, bearer, queryOf, handle };
