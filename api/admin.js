/**
 * API del panel del equipo. Requiere sesión de Supabase de un admin
 * (email en ADMIN_EMAILS o fila en la tabla admins).
 *   GET  /api/admin?action=list
 *   GET  /api/admin?action=thread&user=<uuid>[&mark=0]      mark=0: abrir sin marcar como leído (cambio de API aprobado, aditivo)
 *   POST /api/admin?action=mark-read    {user}                marca como atendida una conversación sin responder (aditivo)
 *   GET  /api/admin?action=summary                            resumen del panel en una sola llamada (aditivo)
 *   POST /api/admin?action=reply        {user, body}
 *   GET  /api/admin?action=videos                     solicitudes de videollamada
 *   POST /api/admin?action=video-confirm  {id}
 *   POST /api/admin?action=video-propose  {id, when, note}
 *   POST /api/admin?action=video-cancel   {id}
 *
 * Accesos por plan (los activa solo el webhook de Hotmart, /api/hotmart/webhook; el admin los ve y puede ajustarlos):
 *   GET  /api/admin?action=access-list                           accesos por correo + últimos eventos de Hotmart
 *   POST /api/admin?action=access-grant   {email, plan, until}   respaldo: dar acceso a mano a un correo
 *   POST /api/admin?action=access-revoke  {id}                   respaldo: quitar un acceso
 * Material por plan (bucket privado plan-material):
 *   GET  /api/admin?action=materials
 *   POST /api/admin?action=material-upload-url {fileName, contentType, size}  -> {path, token} para subir directo a Storage
 *   POST /api/admin?action=material-save   {path, title, description, category, plans, fileName, contentType, size, published}
 *   POST /api/admin?action=material-update {id, title, description, category, plans, published}
 *   POST /api/admin?action=material-delete {id}
 *   POST /api/admin?action=material-preview-url {id}          URL firmada de 2 minutos solo para el equipo, para «Ver archivo» (aditivo)
 * Recursos gratis de gratis.html (bucket público free-resources, máx. 50 MB por archivo; foto de referencia obligatoria):
 *   GET  /api/admin?action=free-list
 *   POST /api/admin?action=free-upload-url {id?, role: cover|file, kind: archivo|video_externo|video_corto, fileName, contentType, size}
 *   POST /api/admin?action=free-save   {id, kind, title, description, published, coverPath, coverName, coverType, coverSize,
 *                                       filePath, fileName, contentType, size, videoUrl}
 *   POST /api/admin?action=free-update {id, title, description, published, videoUrl?, coverPath?, removeCover?, filePath?, ...}
 *   POST /api/admin?action=free-delete {id}                         borra la fila y sus archivos del Storage
 * Fotos y videos del sitio (bucket público site-media):
 *   GET  /api/admin?action=media
 *   POST /api/admin?action=media-upload-url {slot, fileName, contentType, size}
 *   POST /api/admin?action=media-save      {slot, path, contentType, size, alt}
 *   POST /api/admin?action=media-reset     {slot}               vuelve al archivo original del sitio (borra también la versión anterior guardada)
 *   POST /api/admin?action=media-restore-previous {slot}        vuelve a la última versión subida antes de la actual (aditivo)
 *   media-save conserva la versión anterior inmediata de cada espacio (una sola); /api/admin?action=media devuelve hasPrevious.
 */
const plans = require("./_lib/plans");
const { getUserFromToken, rest, enc, HttpError } = require("./_lib/supa");
const S = require("./_lib/subs");
const ACC = require("./_lib/access");
const V = require("./_lib/video");
const C = require("./_lib/content");
const ST = require("./_lib/storage");
const F = require("./_lib/free");
const FA_SLOTS = require("../assets/fa-slots.js");
const { readBody, send, bearer, queryOf, handle } = require("./_lib/http");

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function list(req, res) {
  const [subs, unread] = await Promise.all([
    rest("subscribers?select=user_id,email,nombre,plan,status,period_start,period_end,cancel_at_period_end,created_at&order=created_at.desc&limit=1000"),
    rest("messages?select=user_id,created_at&sender=eq.cliente&read_by_team=eq.false&limit=5000"),
  ]);
  const byUser = {};
  for (const m of unread || []) {
    const u = (byUser[m.user_id] = byUser[m.user_id] || { n: 0, last: null });
    u.n++;
    if (!u.last || m.created_at > u.last) u.last = m.created_at;
  }
  const items = (subs || []).map((s) => ({
    ...s,
    planName: s.plan ? (plans.getPlan(s.plan) || {}).name : null,
    unread: (byUser[s.user_id] || {}).n || 0,
    lastUnreadAt: (byUser[s.user_id] || {}).last || null,
    canAsk: S.canAsk(s),
  }));
  const active = items.filter((s) => s.canAsk);
  const mrr = active.reduce((acc, s) => acc + ((plans.getPlan(s.plan) || {}).amount || 0), 0);
  send(res, 200, { ok: true, items, stats: { total: items.length, active: active.length, unread: Object.values(byUser).reduce((a, b) => a + b.n, 0), mrr } });
}

function userParam(v) {
  const id = String(v || "");
  if (!UUID_RE.test(id)) throw new HttpError(400, "Suscriptor no válido.", "bad_user");
  return id;
}

async function thread(req, res) {
  const id = userParam(queryOf(req).user);
  const sub = await S.getSubscriber(id);
  if (!sub) throw new HttpError(404, "Suscriptor no encontrado.", "not_found");
  const [messages, quota] = await Promise.all([
    rest(`messages?select=id,sender,body,created_at&user_id=eq.${enc(id)}&order=created_at.asc&limit=500`),
    S.quotaFor(sub),
  ]);
  /* mark=0 (cambio de API aprobado): abre la conversación sin marcarla como leída; se marca al responder o con mark-read. */
  if (String(queryOf(req).mark) !== "0") await markRead(id);
  send(res, 200, { ok: true, subscriber: { user_id: id, ...S.publicSub(sub) }, canAsk: S.canAsk(sub), quota, messages });
}

async function markRead(id) {
  await rest(`messages?user_id=eq.${enc(id)}&sender=eq.cliente&read_by_team=eq.false`, {
    method: "PATCH", prefer: "return=minimal", body: { read_by_team: true },
  });
}

async function markReadAction(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  await markRead(userParam((await readBody(req)).user));
  send(res, 200, { ok: true });
}

async function reply(req, res, admin) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const id = userParam(b.user);
  const text = S.cleanMessage(b.body);
  const sub = await S.getSubscriber(id);
  if (!sub) throw new HttpError(404, "Suscriptor no encontrado.", "not_found");
  const rows = await rest("messages", {
    method: "POST", prefer: "return=representation",
    body: [{ user_id: id, sender: "equipo", body: text, author_id: admin.id, read_by_team: true }],
  });
  await rest(`messages?user_id=eq.${enc(id)}&sender=eq.cliente&read_by_team=eq.false`, {
    method: "PATCH", prefer: "return=minimal", body: { read_by_team: true },
  });
  send(res, 201, { ok: true, message: rows[0] });
}

async function whoami(req, res, admin) {
  send(res, 200, { ok: true, email: admin.email });
}

/* Resumen del panel en una sola llamada (antes eran 6). Solo cuenta lo que ya existe en la base; no inventa nada. */
async function summary(req, res) {
  const [subs, unread, calls, acc, mats, free, media] = await Promise.all([
    rest("subscribers?select=user_id,plan,status,period_end&limit=1000"),
    rest("messages?select=user_id&sender=eq.cliente&read_by_team=eq.false&limit=5000"),
    rest("videocalls?select=status,scheduled_at&status=neq.cancelada&order=scheduled_at.asc&limit=200"),
    rest("plan_access?select=status,period_end&limit=500"),
    rest("plan_materials?select=title,plans,published,created_at&order=created_at.desc&limit=500"),
    rest("free_resources?select=title,published,created_at&order=created_at.desc&limit=500"),
    rest("site_media?select=slot,updated_at&order=updated_at.desc&limit=200"),
  ]);
  const now = Date.now();
  const byPlan = Object.fromEntries(C.PLAN_KEYS.map((k) => [k, 0]));
  let mrr = 0, problems = 0;
  for (const s of subs || []) {
    if (S.canAsk(s)) { byPlan[s.plan] = (byPlan[s.plan] || 0) + 1; mrr += (plans.getPlan(s.plan) || {}).amount || 0; }
    if (["morosa", "pago_pendiente", "pendiente_tarjeta"].includes(s.status)) problems++;
  }
  const people = new Set((unread || []).map((m) => m.user_id));
  const asked = (calls || []).filter((v) => v.status === "solicitada");
  const next = asked.find((v) => new Date(v.scheduled_at).getTime() >= now);
  const expiring = (acc || []).filter((r) => (r.status === "activa" || r.status === "cancelada_fin_periodo") && r.period_end
    && new Date(r.period_end).getTime() + 86400000 >= now && new Date(r.period_end).getTime() <= now + 7 * 86400000).length;
  const material = Object.fromEntries(C.PLAN_KEYS.map((k) => {
    const own = (mats || []).filter((m) => (m.plans || []).includes(k));
    return [k, { total: own.length, hidden: own.filter((m) => !m.published).length }];
  }));
  const recent = [
    ...(mats || []).map((m) => ({ type: "material", title: m.title, at: m.created_at })),
    ...(free || []).map((r) => ({ type: "gratis", title: r.title, at: r.created_at })),
    ...(media || []).map((m) => ({ type: "foto", slot: m.slot, at: m.updated_at })),
  ].filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  send(res, 200, { ok: true,
    messages: { people: people.size, messages: (unread || []).length },
    videos: { pending: asked.length, nextAt: next ? next.scheduled_at : null },
    subscribers: { byPlan, problems, total: (subs || []).length, mrr },
    expiring,
    material,
    free: { published: (free || []).filter((r) => r.published).length, hidden: (free || []).filter((r) => !r.published).length },
    media: { changed: (media || []).length, total: FA_SLOTS.SLOTS.length },
    recent,
    limits: { subscribers: (subs || []).length >= 1000, unread: (unread || []).length >= 5000, access: (acc || []).length >= 500, videos: (calls || []).length >= 200 } });
}

async function getCall(id) {
  if (!UUID_RE.test(String(id || ""))) throw new HttpError(400, "Solicitud no válida.", "bad_id");
  const rows = await rest(`videocalls?select=*&id=eq.${enc(id)}&limit=1`);
  if (!rows || !rows[0]) throw new HttpError(404, "No encontramos esa videollamada.", "not_found");
  return rows[0];
}

async function patchCall(id, body) {
  const rows = await rest(`videocalls?id=eq.${enc(id)}`, { method: "PATCH", prefer: "return=representation", body: { ...body, updated_at: new Date().toISOString() } });
  return rows[0];
}

async function videos(req, res) {
  const [rows, subs] = await Promise.all([
    rest("videocalls?select=*&status=neq.cancelada&order=scheduled_at.asc&limit=200"),
    rest("subscribers?select=user_id,nombre,email&limit=1000"),
  ]);
  const who = Object.fromEntries((subs || []).map((s) => [s.user_id, s]));
  const items = (rows || []).filter((v) => v.status !== "cancelada").map((v) => ({
    ...V.publicCall(v), user_id: v.user_id, nombre: (who[v.user_id] || {}).nombre || "", email: (who[v.user_id] || {}).email || "",
  }));
  send(res, 200, { ok: true, items });
}

async function videoConfirm(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const v = await getCall((await readBody(req)).id);
  if (v.status !== "solicitada") throw new HttpError(400, "Solo se puede confirmar una hora que propuso el cliente.", "bad_state");
  send(res, 200, { ok: true, item: V.publicCall(await patchCall(v.id, { status: "confirmada" })) });
}

async function videoPropose(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const v = await getCall(b.id);
  if (v.status === "cancelada") throw new HttpError(400, "Esa videollamada está cancelada.", "bad_state");
  const item = await patchCall(v.id, { status: "propuesta", proposed_by: "equipo", scheduled_at: V.parseWhen(b.when), note: V.cleanNote(b.note) });
  send(res, 200, { ok: true, item: V.publicCall(item) });
}

async function videoCancel(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const v = await getCall((await readBody(req)).id);
  send(res, 200, { ok: true, item: V.publicCall(await patchCall(v.id, { status: "cancelada" })) });
}

/* ---------- accesos por plan (compra en Hotmart): el equipo asigna el plan y la vigencia ---------- */
function untilParam(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59-03:00`) : null;
  if (!d || Number.isNaN(d.getTime())) throw new HttpError(400, "Elige hasta qué día tiene acceso.", "bad_until");
  if (d.getTime() < Date.now()) throw new HttpError(400, "La fecha de término ya pasó.", "bad_until");
  if (d.getTime() > Date.now() + 400 * 86400000) throw new HttpError(400, "La vigencia máxima es de 13 meses; renuévala cuando corresponda.", "bad_until");
  return d.toISOString();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Lista de accesos (llenada por el webhook de Hotmart) y últimos eventos recibidos. */
async function accessList(req, res) {
  const [rows, events, subs] = await Promise.all([
    rest("plan_access?select=*&order=updated_at.desc&limit=500"),
    rest("hotmart_events?select=event,email,plan,product_id,offer_code,outcome,detail,received_at&order=received_at.desc&limit=30"),
    rest("subscribers?select=email&limit=2000"),
  ]);
  const registered = new Set((subs || []).map((x) => String(x.email || "").toLowerCase()));
  const items = (rows || []).map((r) => ({
    id: r.id, email: r.email, plan: r.plan, planName: (plans.getPlan(r.plan) || {}).name || r.plan, status: r.status,
    periodEnd: r.period_end, source: r.source, lastEvent: r.last_event, lastEventAt: r.last_event_at, buyerName: r.buyer_name,
    hasAccount: registered.has(r.email),
    active: (r.status === "activa" || r.status === "cancelada_fin_periodo") && !!r.period_end && new Date(r.period_end).getTime() + 86400000 >= Date.now(),
  }));
  send(res, 200, { ok: true, items, events: events || [], hottokConfigured: !!(process.env.HOTMART_HOTTOK || "").trim() });
}

/* Respaldo: dar acceso a mano a un correo (no es el flujo principal). */
async function accessGrant(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const plan = String(b.plan || "");
  if (!C.PLAN_KEYS.includes(plan)) throw new HttpError(400, "Plan no válido.", "bad_plan");
  const email = String(b.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Revisa el correo.", "bad_email");
  const until = untilParam(b.until);
  const now = new Date().toISOString();
  const row = await ACC.saveAccess(email, plan, { status: "activa", period_start: now, period_end: until, source: "manual", last_event: "MANUAL_GRANT", last_event_id: null, last_event_at: now });
  await ACC.applyAccess(email);
  send(res, 200, { ok: true, id: row.id });
}

async function accessRevoke(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const id = String((await readBody(req)).id || "");
  if (!C.UUID_RE.test(id)) throw new HttpError(400, "Acceso no válido.", "bad_id");
  const now = new Date().toISOString();
  const rows = await rest(`plan_access?id=eq.${enc(id)}`, {
    method: "PATCH", prefer: "return=representation",
    body: { status: "cancelada", period_end: now, last_event: "MANUAL_REVOKE", last_event_at: now, updated_at: now },
  });
  if (!rows || !rows[0]) throw new HttpError(404, "No encontramos ese acceso.", "not_found");
  await ACC.applyAccess(rows[0].email);
  send(res, 200, { ok: true });
}

/* ---------- material por plan ---------- */
const MAT_COLS = "id,title,description,category,storage_path,file_name,content_type,size_bytes,plans,published,created_at";

async function materialRow(id) {
  const key = String(id || "");
  if (!C.UUID_RE.test(key)) throw new HttpError(400, "Material no válido.", "bad_id");
  const rows = await rest(`plan_materials?select=${MAT_COLS}&id=eq.${enc(key)}`);
  if (!rows || !rows[0]) throw new HttpError(404, "Material no encontrado.", "not_found");
  return rows[0];
}

async function materials(req, res) {
  const rows = await rest(`plan_materials?select=${MAT_COLS}&order=created_at.desc&limit=500`);
  send(res, 200, { ok: true, items: (rows || []).map((m) => C.publicMaterial(m, { admin: true })), plans: C.PLAN_KEYS, categories: C.CATEGORIES });
}

async function materialUploadUrl(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const f = C.checkMaterialFile({ fileName: b.fileName, contentType: b.contentType, size: b.size });
  const path = C.materialPath(C.newId(), b.fileName);
  const up = await ST.createSignedUpload(ST.BUCKET_MATERIAL, path);
  send(res, 200, { ok: true, bucket: up.bucket, path: up.path, token: up.token, contentType: f.contentType });
}

function materialFields(b) {
  const title = C.cleanText(b.title, 160);
  if (!title) throw new HttpError(400, "Ponle un título al material.", "title");
  const category = String(b.category || "recurso");
  if (!C.CATEGORIES.includes(category)) throw new HttpError(400, "Categoría no válida.", "bad_category");
  return { title, description: C.cleanText(b.description, 1000), category, plans: C.cleanPlans(b.plans), published: b.published !== false };
}

async function materialSave(req, res, admin) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const path = String(b.path || "");
  if (!C.MATERIAL_PATH_RE.test(path)) throw new HttpError(400, "Archivo no válido.", "bad_path");
  const f = C.checkMaterialFile({ fileName: b.fileName, contentType: b.contentType, size: b.size });
  const fields = materialFields(b);
  const exists = await ST.createSignedDownload(ST.BUCKET_MATERIAL, path, { expiresIn: 30 });
  if (!exists) throw new HttpError(400, "El archivo no terminó de subirse. Súbelo de nuevo.", "not_uploaded");
  const rows = await rest("plan_materials", {
    method: "POST", prefer: "return=representation",
    body: [{ ...fields, storage_path: path, file_name: C.safeFileName(b.fileName), content_type: f.contentType, size_bytes: f.size, created_by: admin.id }],
  });
  send(res, 201, { ok: true, item: C.publicMaterial(rows[0], { admin: true }) });
}

async function materialUpdate(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const m = await materialRow(b.id);
  const rows = await rest(`plan_materials?id=eq.${enc(m.id)}`, {
    method: "PATCH", prefer: "return=representation", body: { ...materialFields(b), updated_at: new Date().toISOString() },
  });
  send(res, 200, { ok: true, item: C.publicMaterial(rows[0], { admin: true }) });
}

async function materialDelete(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const m = await materialRow((await readBody(req)).id);
  await rest(`plan_materials?id=eq.${enc(m.id)}`, { method: "DELETE", prefer: "return=minimal" });
  await ST.removeObjects(ST.BUCKET_MATERIAL, [m.storage_path]);
  send(res, 200, { ok: true });
}

/* «Ver archivo»: URL firmada de 2 minutos, solo para el equipo (cambio de API aprobado, aditivo). */
async function materialPreviewUrl(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const m = await materialRow((await readBody(req)).id);
  const url = await ST.createSignedDownload(ST.BUCKET_MATERIAL, m.storage_path, { expiresIn: 120 });
  if (!url) throw new HttpError(404, "No encontramos el archivo en el almacenamiento.", "not_found");
  send(res, 200, { ok: true, url, fileName: m.file_name, contentType: m.content_type, size: m.size_bytes == null ? null : Number(m.size_bytes) });
}

/* ---------- recursos gratis ---------- */
const FREE_COLS = "id,title,description,kind,cover_path,file_path,file_name,content_type,size_bytes,video_url,published,created_at";

async function freeRow(id) {
  const key = String(id || "");
  if (!C.UUID_RE.test(key)) throw new HttpError(400, "Recurso no válido.", "bad_id");
  const rows = await rest(`free_resources?select=${FREE_COLS}&id=eq.${enc(key)}`);
  if (!rows || !rows[0]) throw new HttpError(404, "Recurso no encontrado.", "not_found");
  return rows[0];
}

async function freeList(req, res) {
  const rows = await rest(`free_resources?select=${FREE_COLS}&order=created_at.desc&limit=500`);
  send(res, 200, { ok: true, items: (rows || []).map((r) => F.publicFree(r, { admin: true })) });
}

function freeKind(v) {
  const kind = String(v || "");
  if (!F.KINDS.includes(kind)) throw new HttpError(400, "Elige el tipo de recurso: archivo, video con link o video corto.", "bad_kind");
  return kind;
}

async function freeUploadUrl(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const kind = freeKind(b.kind);
  const role = String(b.role || "");
  const id = b.id ? String(b.id) : C.newId();
  if (!C.UUID_RE.test(id)) throw new HttpError(400, "Recurso no válido.", "bad_id");
  const f = F.checkFreeFile(role, kind, { fileName: b.fileName, contentType: b.contentType, size: b.size });
  const up = await ST.createSignedUpload(ST.BUCKET_FREE, F.freePath(id, role, b.fileName));
  send(res, 200, { ok: true, id, bucket: up.bucket, path: up.path, token: up.token, contentType: f.contentType });
}

/* Revisa un archivo ya subido (ruta del recurso, tipo y tamaño permitidos, existe en Storage). */
async function checkFreeUpload(id, role, kind, path, meta) {
  F.ownPath(id, role, path);
  const name = meta.name || String(path).split("/").pop();
  const f = F.checkFreeFile(role, kind, { fileName: name, contentType: meta.type, size: meta.size });
  if (!(await ST.createSignedDownload(ST.BUCKET_FREE, path, { expiresIn: 30 }))) throw new HttpError(400, "El archivo no terminó de subirse. Súbelo de nuevo.", "not_uploaded");
  return { ...f, name: C.safeFileName(name) };
}

function freeText(b) {
  const title = C.cleanText(b.title, 160);
  if (!title) throw new HttpError(400, "Ponle un título al recurso.", "title");
  return { title, description: C.cleanText(b.description, 1000), published: b.published !== false };
}

const NEEDS_COVER = "Sube la foto de referencia: es la imagen que muestra de qué se trata el recurso.";
const NEEDS_PREVIEW = "Sube una imagen de preview para este video (solo los links de YouTube pueden usar su miniatura).";

async function freeSave(req, res, admin) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const id = String(b.id || "");
  if (!C.UUID_RE.test(id)) throw new HttpError(400, "Recurso no válido.", "bad_id");
  const kind = freeKind(b.kind);
  const row = { id, kind, ...freeText(b), created_by: admin.id };
  let cover = null;
  if (b.coverPath) {
    cover = await checkFreeUpload(id, "cover", kind, b.coverPath, { name: b.coverName, type: b.coverType, size: b.coverSize });
    row.cover_path = b.coverPath;
  }
  if (kind === "video_externo") {
    const v = F.parseVideoUrl(b.videoUrl);
    if (!cover && !v.youtubeId) throw new HttpError(400, NEEDS_PREVIEW, "needs_cover");
    row.video_url = v.url;
  } else {
    if (!cover) throw new HttpError(400, NEEDS_COVER, "needs_cover");
    const f = await checkFreeUpload(id, "file", kind, b.filePath, { name: b.fileName, type: b.contentType, size: b.size });
    Object.assign(row, { file_path: b.filePath, file_name: f.name, content_type: f.contentType, size_bytes: f.size });
  }
  const rows = await rest("free_resources", { method: "POST", prefer: "return=representation", body: [row] });
  send(res, 201, { ok: true, item: F.publicFree(rows[0], { admin: true }) });
}

async function freeUpdate(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const r = await freeRow(b.id);
  const patch = { ...freeText(b), updated_at: new Date().toISOString() };
  const drop = [];
  let coverNow = r.cover_path;
  if (b.coverPath) {
    await checkFreeUpload(r.id, "cover", r.kind, b.coverPath, { name: b.coverName, type: b.coverType, size: b.coverSize });
    patch.cover_path = coverNow = b.coverPath;
    if (r.cover_path) drop.push(r.cover_path);
  } else if (b.removeCover) {
    if (r.kind !== "video_externo") throw new HttpError(400, NEEDS_COVER, "needs_cover");
    patch.cover_path = coverNow = null;
    if (r.cover_path) drop.push(r.cover_path);
  }
  if (r.kind === "video_externo") {
    const v = F.parseVideoUrl(b.videoUrl !== undefined ? b.videoUrl : r.video_url);
    if (!coverNow && !v.youtubeId) throw new HttpError(400, NEEDS_PREVIEW, "needs_cover");
    patch.video_url = v.url;
  } else if (b.filePath) {
    const f = await checkFreeUpload(r.id, "file", r.kind, b.filePath, { name: b.fileName, type: b.contentType, size: b.size });
    Object.assign(patch, { file_path: b.filePath, file_name: f.name, content_type: f.contentType, size_bytes: f.size });
    if (r.file_path) drop.push(r.file_path);
  }
  const rows = await rest(`free_resources?id=eq.${enc(r.id)}`, { method: "PATCH", prefer: "return=representation", body: patch });
  await ST.removeObjects(ST.BUCKET_FREE, drop);
  send(res, 200, { ok: true, item: F.publicFree(rows[0], { admin: true }) });
}

async function freeDelete(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const r = await freeRow((await readBody(req)).id);
  await rest(`free_resources?id=eq.${enc(r.id)}`, { method: "DELETE", prefer: "return=minimal" });
  await ST.removeObjects(ST.BUCKET_FREE, [r.cover_path, r.file_path].filter(Boolean));
  send(res, 200, { ok: true });
}

/* ---------- fotos y videos del sitio ---------- */
/* La versión anterior es el archivo inmediatamente más antiguo que el actual en la carpeta del espacio (los nombres empiezan con la hora de subida). */
function previousPath(current, listNewestFirst) {
  const older = (listNewestFirst || []).filter((p) => p < current);
  return older[0] || null;
}

async function media(req, res) {
  const rows = await rest("site_media?select=slot,kind,storage_path,content_type,size_bytes,alt,updated_at&limit=200");
  const by = Object.fromEntries((rows || []).map((r) => [r.slot, r]));
  /* hasPrevious (aditivo): ¿hay una versión subida antes de la actual? Solo se consulta para los espacios cambiados. */
  const prevOf = Object.fromEntries(await Promise.all((rows || []).map(async (r) => [r.slot, previousPath(r.storage_path, await ST.listObjects(ST.BUCKET_MEDIA, r.slot))])));
  const items = FA_SLOTS.SLOTS.map((s) => {
    const r = by[s.id];
    return { id: s.id, kind: s.kind, page: s.page, label: s.label, hint: s.hint || "", bases: s.bases || [], limits: FA_SLOTS.LIMITS[s.kind].label,
      custom: r ? { url: ST.publicUrl(ST.BUCKET_MEDIA, r.storage_path), alt: r.alt || "", updatedAt: r.updated_at, size: r.size_bytes == null ? null : Number(r.size_bytes), contentType: r.content_type || null, hasPrevious: !!prevOf[s.id] } : null };
  });
  send(res, 200, { ok: true, items });
}

async function mediaUploadUrl(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const f = C.checkSlotFile(b.slot, { fileName: b.fileName, contentType: b.contentType, size: b.size });
  const up = await ST.createSignedUpload(ST.BUCKET_MEDIA, C.slotPath(f.slot.id, b.fileName));
  send(res, 200, { ok: true, bucket: up.bucket, path: up.path, token: up.token, contentType: f.contentType });
}

async function mediaSave(req, res, admin) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const b = await readBody(req);
  const f = C.checkSlotFile(b.slot, { fileName: b.fileName || b.path, contentType: b.contentType, size: b.size });
  const path = String(b.path || "");
  if (!C.SLOT_PATH_RE.test(path) || !path.startsWith(`${f.slot.id}/`)) throw new HttpError(400, "Archivo no válido.", "bad_path");
  if (!(await ST.createSignedDownload(ST.BUCKET_MEDIA, path, { expiresIn: 30 }))) throw new HttpError(400, "El archivo no terminó de subirse. Súbelo de nuevo.", "not_uploaded");
  const prev = await rest(`site_media?select=storage_path&slot=eq.${enc(f.slot.id)}`);
  await rest("site_media?on_conflict=slot", {
    method: "POST", prefer: "return=minimal,resolution=merge-duplicates",
    body: [{ slot: f.slot.id, kind: f.slot.kind, storage_path: path, content_type: f.contentType, size_bytes: f.size, alt: C.cleanText(b.alt, 300), updated_by: admin.id, updated_at: new Date().toISOString() }],
  });
  /* Cambio aprobado: se conserva la versión anterior inmediata (para «Volver a la versión anterior») y se borran las más viejas. */
  const keep = new Set([path, prev && prev[0] && prev[0].storage_path].filter(Boolean));
  const old = (await ST.listObjects(ST.BUCKET_MEDIA, f.slot.id)).filter((p) => !keep.has(p) && p < path);
  await ST.removeObjects(ST.BUCKET_MEDIA, old);
  send(res, 200, { ok: true, url: ST.publicUrl(ST.BUCKET_MEDIA, path) });
}

async function mediaReset(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const slot = FA_SLOTS.bySlot(String((await readBody(req)).slot || ""));
  if (!slot) throw new HttpError(400, "Ese espacio de la página no existe.", "bad_slot");
  const prev = await rest(`site_media?select=storage_path&slot=eq.${enc(slot.id)}`);
  await rest(`site_media?slot=eq.${enc(slot.id)}`, { method: "DELETE", prefer: "return=minimal" });
  /* borra el archivo actual y también la versión anterior guardada */
  const all = await ST.listObjects(ST.BUCKET_MEDIA, slot.id);
  await ST.removeObjects(ST.BUCKET_MEDIA, [...new Set([...(prev && prev[0] ? [prev[0].storage_path] : []), ...all])]);
  send(res, 200, { ok: true });
}

/* «Volver a la versión anterior» (cambio aprobado, aditivo): la fila apunta otra vez al archivo anterior y se borra el que se deja. */
async function mediaRestorePrevious(req, res, admin) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const slot = FA_SLOTS.bySlot(String((await readBody(req)).slot || ""));
  if (!slot) throw new HttpError(400, "Ese espacio de la página no existe.", "bad_slot");
  const rows = await rest(`site_media?select=storage_path,content_type,size_bytes&slot=eq.${enc(slot.id)}`);
  if (!rows || !rows[0]) throw new HttpError(404, "Este espacio no tiene un archivo nuevo.", "not_found");
  const prev = previousPath(rows[0].storage_path, await ST.listObjects(ST.BUCKET_MEDIA, slot.id));
  if (!prev) throw new HttpError(404, "No hay una versión anterior guardada.", "not_found");
  const e = (/\.([a-z0-9]{1,8})$/i.exec(prev) || [])[1] || "";
  const type = Object.keys(FA_SLOTS.LIMITS[slot.kind].types).find((t) => FA_SLOTS.LIMITS[slot.kind].types[t] === e.toLowerCase() || (t === "image/jpeg" && e.toLowerCase() === "jpeg"));
  if (!type) throw new HttpError(400, "Archivo no válido.", "bad_path");
  await rest(`site_media?slot=eq.${enc(slot.id)}`, { method: "PATCH", prefer: "return=minimal", body: { storage_path: prev, content_type: type, size_bytes: null, updated_by: admin.id, updated_at: new Date().toISOString() } });
  await ST.removeObjects(ST.BUCKET_MEDIA, [rows[0].storage_path]);
  send(res, 200, { ok: true, url: ST.publicUrl(ST.BUCKET_MEDIA, prev) });
}

const ROUTES = { list, thread, reply, whoami, summary, "mark-read": markReadAction, videos, "video-confirm": videoConfirm, "video-propose": videoPropose, "video-cancel": videoCancel,
  "access-list": accessList, "access-grant": accessGrant, "access-revoke": accessRevoke,
  materials, "material-upload-url": materialUploadUrl, "material-save": materialSave, "material-update": materialUpdate, "material-delete": materialDelete, "material-preview-url": materialPreviewUrl,
  "free-list": freeList, "free-upload-url": freeUploadUrl, "free-save": freeSave, "free-update": freeUpdate, "free-delete": freeDelete,
  media, "media-upload-url": mediaUploadUrl, "media-save": mediaSave, "media-reset": mediaReset, "media-restore-previous": mediaRestorePrevious };

module.exports = handle(async (req, res) => {
  const fn = ROUTES[String(queryOf(req).action || "")];
  if (!fn) throw new HttpError(404, "Acción no encontrada.", "not_found");
  const user = await getUserFromToken(bearer(req));
  if (!(await S.isAdmin(user))) throw new HttpError(403, "Esta cuenta no tiene acceso al panel del equipo.", "not_admin");
  return fn(req, res, user);
});
