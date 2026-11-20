/** Reglas del material por plan y de las fotos/videos del sitio (lógica pura, sin red). */
const { HttpError } = require("./supa");
const FA_SLOTS = require("../../assets/fa-slots.js");
const FA_TEXTOS = require("../../assets/fa-textos.js");

const PLAN_KEYS = ["basico", "pro", "premium"];
const CATEGORIES = ["ebook", "biblioteca", "guia", "video", "recurso"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

/* tipo MIME -> extensión permitida para el material (privado). */
const MATERIAL_TYPES = {
  "application/pdf": ["pdf"],
  "application/epub+zip": ["epub"],
  "application/zip": ["zip"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "text/plain": ["txt"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
};

function ext(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

/** Nombre seguro para la ruta de Storage (sin tildes, espacios ni símbolos). */
function safeFileName(name) {
  const e = ext(name);
  const base = String(name || "archivo").replace(/\.[a-z0-9]{1,8}$/i, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "archivo";
  return e ? `${base}.${e}` : base;
}

function cleanText(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

function cleanPlans(v) {
  const list = Array.isArray(v) ? v : [];
  const out = [...new Set(list.map(String))].filter((p) => PLAN_KEYS.includes(p));
  if (!out.length || out.length !== new Set(list.map(String)).size) throw new HttpError(400, "Elige al menos un plan válido para este material.", "bad_plans");
  return PLAN_KEYS.filter((p) => out.includes(p));
}

function checkMaterialFile({ fileName, contentType, size }) {
  const type = String(contentType || "").toLowerCase();
  const allowed = MATERIAL_TYPES[type];
  if (!allowed || !allowed.includes(ext(fileName))) {
    throw new HttpError(400, "Tipo de archivo no permitido. Sube PDF, EPUB, ZIP, Word, Excel, PowerPoint, texto, imagen JPG/PNG/WebP o video MP4/WebM.", "bad_type");
  }
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "No pudimos leer el tamaño del archivo.", "bad_size");
  if (n > MATERIAL_MAX_BYTES) throw new HttpError(413, "El archivo pesa más de 50 MB. Comprímelo o divídelo.", "too_big");
  return { contentType: type, size: n };
}

function checkSlotFile(slotId, { fileName, contentType, size }) {
  const slot = FA_SLOTS.bySlot(String(slotId || ""));
  if (!slot) throw new HttpError(400, "Ese espacio de la página no existe.", "bad_slot");
  const lim = FA_SLOTS.LIMITS[slot.kind];
  const type = String(contentType || "").toLowerCase();
  const e = lim.types[type];
  const fe = ext(fileName);
  if (!e || !(fe === e || (e === "jpg" && fe === "jpeg"))) throw new HttpError(400, `Para este espacio sube ${lim.label}.`, "bad_type");
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "No pudimos leer el tamaño del archivo.", "bad_size");
  if (n > lim.maxBytes) throw new HttpError(413, `El archivo es muy pesado. Sube ${lim.label}.`, "too_big");
  return { slot, contentType: type, size: n };
}

function newId() {
  return require("node:crypto").randomUUID();
}

/** Ruta de un material nuevo: <uuid>/<nombre-seguro>. */
function materialPath(id, fileName) { return `${id}/${safeFileName(fileName)}`; }
function slotPath(slotId, fileName) { return `${slotId}/${Date.now()}-${safeFileName(fileName)}`; }

const MATERIAL_PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/;
const SLOT_PATH_RE = /^[a-z0-9-]{3,60}\/\d{10,16}-[A-Za-z0-9._-]{1,80}$/;

function publicMaterial(m, { admin } = {}) {
  const base = {
    id: m.id, title: m.title, description: m.description || "", category: m.category,
    fileName: m.file_name, contentType: m.content_type, size: m.size_bytes == null ? null : Number(m.size_bytes), createdAt: m.created_at,
  };
  return admin ? { ...base, plans: m.plans, published: !!m.published } : base;
}

const TEXT_ID_RE = /^[a-z][a-z0-9]{0,24}\.[a-z][a-z0-9]{0,24}\.[0-9]{1,4}$/;
const PAGO_NOMBRE = /hotmart/i;

/** Texto publicado desde el panel. Vacío = volver al HTML original. Rechaza HTML y el nombre del servicio de pago. */
function checkSiteText(id, body) {
  const item = FA_TEXTOS.byId(String(id || ""));
  if (!item || !TEXT_ID_RE.test(item.id)) throw new HttpError(400, "Ese texto no está en el sitio.", "bad_id");
  const text = String(body == null ? "" : body).replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  if (!text.trim()) return { item, text: "", reset: true };
  if (/[<>]/.test(text)) throw new HttpError(400, "Solo se puede escribir texto, sin código.", "bad_html");
  if (PAGO_NOMBRE.test(text)) throw new HttpError(400, "Ese texto no puede nombrar al servicio de pago.", "bad_text");
  if ([...text].length > item.max || [...text].length > 2000) throw new HttpError(400, "El texto es muy largo. Acórtalo un poco.", "too_long");
  const mismo = text.trim() === String(item.texto || "").trim();
  return { item, text, reset: mismo };
}

module.exports = {
  PLAN_KEYS, CATEGORIES, UUID_RE, MATERIAL_PATH_RE, SLOT_PATH_RE, MATERIAL_TYPES, TEXT_ID_RE,
  safeFileName, cleanText, cleanPlans, checkMaterialFile, checkSlotFile, checkSiteText, newId, materialPath, slotPath, publicMaterial,
};
