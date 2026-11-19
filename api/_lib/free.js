/** Recursos gratis (gratis.html): reglas de validación y forma pública (lógica pura, sin red). */
const { HttpError } = require("./supa");
const C = require("./content");
const ST = require("./storage");

const KINDS = ["archivo", "video_externo", "video_corto"];
const MB = 1024 * 1024;
const FILE_MAX = 50 * MB;    /* máximo de Supabase Free por archivo */
const VIDEO_MAX = 50 * MB;
const COVER_MAX = 5 * MB;

const COVER_TYPES = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/avif": ["avif"] };
const VIDEO_TYPES = { "video/mp4": ["mp4"], "video/webm": ["webm"] };
/* Documentos descargables: los mismos del material por plan, sin imágenes ni videos. */
const DOC_TYPES = Object.fromEntries(Object.entries(C.MATERIAL_TYPES).filter(([t]) => !/^(image|video)\//.test(t)));

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be", "www.youtu.be"]);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const EXT = (name) => { const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };

const TOO_BIG_VIDEO = "El video pesa más de 50 MB (el máximo que permite el sitio). Súbelo a YouTube y pega aquí el link, o comprímelo y vuelve a intentarlo.";

/**
 * Valida un archivo antes de subirlo.
 * role "cover": foto de referencia (JPG, PNG, WebP o AVIF, hasta 5 MB).
 * role "file": documento (kind archivo) o video corto mp4/webm (kind video_corto), hasta 50 MB.
 */
function checkFreeFile(role, kind, { fileName, contentType, size }) {
  const type = String(contentType || "").toLowerCase();
  const n = Number(size);
  let table, max, label, bigMsg;
  if (role === "cover") {
    table = COVER_TYPES; max = COVER_MAX; label = "una foto JPG, PNG, WebP o AVIF"; bigMsg = "La foto pesa más de 5 MB. Redúcela o comprímela e inténtalo de nuevo.";
  } else if (role === "file" && kind === "video_corto") {
    table = VIDEO_TYPES; max = VIDEO_MAX; label = "un video MP4 o WebM"; bigMsg = TOO_BIG_VIDEO;
  } else if (role === "file" && kind === "archivo") {
    table = DOC_TYPES; max = FILE_MAX; label = "un PDF u otro documento (EPUB, ZIP, Word, Excel, PowerPoint o texto)"; bigMsg = "El archivo pesa más de 50 MB. Comprímelo o divídelo en partes.";
  } else {
    throw new HttpError(400, "Este tipo de recurso no lleva un archivo para subir.", "bad_role");
  }
  const allowed = table[type];
  if (!allowed || !allowed.includes(EXT(fileName))) throw new HttpError(400, `Tipo de archivo no permitido: sube ${label}.`, "bad_type");
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "No pudimos leer el tamaño del archivo.", "bad_size");
  if (n > max) throw new HttpError(413, bigMsg, "too_big");
  return { contentType: type, size: n };
}

/** Extrae el id de un link de YouTube; null si no lo es. */
function youtubeId(u) {
  let url;
  try { url = new URL(u); } catch (e) { return null; }
  if (url.protocol !== "https:" || !YT_HOSTS.has(url.hostname.toLowerCase())) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (url.pathname === "/watch") id = url.searchParams.get("v");
  else { const m = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname); id = m && m[1]; }
  return id && YT_ID.test(id) ? id : null;
}

/** Valida y normaliza el link de un video externo. YouTube se guarda en su forma canónica. */
function parseVideoUrl(raw) {
  const text = String(raw == null ? "" : raw).trim();
  const bad = () => new HttpError(400, "Pega un link válido que empiece con https:// (por ejemplo, el de YouTube).", "bad_video_url");
  if (!text || text.length > 500) throw bad();
  let url;
  try { url = new URL(text); } catch (e) { throw bad(); }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) throw bad();
  const yt = youtubeId(text);
  if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(url.hostname) && !yt) {
    throw new HttpError(400, "Ese link de YouTube no es de un video. Copia el link del video completo.", "bad_video_url");
  }
  return yt ? { url: `https://www.youtube.com/watch?v=${yt}`, youtubeId: yt } : { url: url.toString(), youtubeId: null };
}

const FREE_PATH_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(cover|file)-\d{10,16}-[A-Za-z0-9._-]{1,80}$/;

function freePath(id, role, fileName) { return `${id}/${role}-${Date.now()}-${C.safeFileName(fileName)}`; }

/** La ruta debe ser de este recurso y del rol esperado (evita apuntar a archivos de otro recurso). */
function ownPath(id, role, path) {
  const m = FREE_PATH_RE.exec(String(path || ""));
  if (!m || m[1] !== id || m[2] !== role) throw new HttpError(400, "Archivo no válido.", "bad_path");
  return path;
}

function ytThumbs(id) {
  return { cover: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, fallback: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
}

/** Forma que ve el navegador (el sitio público y el panel). Nunca expone rutas internas de Storage. */
function publicFree(r, { admin } = {}) {
  const yt = r.kind === "video_externo" && r.video_url ? youtubeId(r.video_url) : null;
  const thumbs = yt ? ytThumbs(yt) : null;
  const own = r.cover_path ? ST.publicUrl(ST.BUCKET_FREE, r.cover_path) : null;
  const item = {
    id: r.id, title: r.title, description: r.description || "", kind: r.kind,
    coverUrl: own || (thumbs && thumbs.cover) || null,
    coverFallbackUrl: own ? null : (thumbs && thumbs.fallback) || null,
    fileUrl: r.file_path ? ST.publicUrl(ST.BUCKET_FREE, r.file_path) : null,
    fileName: r.file_name || null,
    contentType: r.content_type || null,
    size: r.size_bytes == null ? null : Number(r.size_bytes),
    videoUrl: r.kind === "video_externo" ? r.video_url : null,
    youtube: !!yt,
    hasOwnCover: !!own,
    createdAt: r.created_at,
  };
  return admin ? { ...item, published: !!r.published } : item;
}

module.exports = { KINDS, FILE_MAX, VIDEO_MAX, COVER_MAX, COVER_TYPES, VIDEO_TYPES, DOC_TYPES, TOO_BIG_VIDEO, FREE_PATH_RE,
  checkFreeFile, youtubeId, parseVideoUrl, freePath, ownPath, publicFree };
