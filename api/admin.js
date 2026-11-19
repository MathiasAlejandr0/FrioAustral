/**
 * API del panel del equipo. Requiere sesión de Supabase de un admin
 * (email en ADMIN_EMAILS o fila en la tabla admins).
 *   GET  /api/admin?action=list
 *   GET  /api/admin?action=thread&user=<uuid>
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
 * Fotos y videos del sitio (bucket público site-media):
 *   GET  /api/admin?action=media
 *   POST /api/admin?action=media-upload-url {slot, fileName, contentType, size}
 *   POST /api/admin?action=media-save      {slot, path, contentType, size, alt}
 *   POST /api/admin?action=media-reset     {slot}               vuelve al archivo original del sitio
 */
const plans = require("./_lib/plans");
const { getUserFromToken, rest, enc, HttpError } = require("./_lib/supa");
const S = require("./_lib/subs");
const ACC = require("./_lib/access");
const V = require("./_lib/video");
const C = require("./_lib/content");
const ST = require("./_lib/storage");
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
  await rest(`messages?user_id=eq.${enc(id)}&sender=eq.cliente&read_by_team=eq.false`, {
    method: "PATCH", prefer: "return=minimal", body: { read_by_team: true },
  });
  send(res, 200, { ok: true, subscriber: { user_id: id, ...S.publicSub(sub) }, canAsk: S.canAsk(sub), quota, messages });
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

/* ---------- fotos y videos del sitio ---------- */
async function media(req, res) {
  const rows = await rest("site_media?select=slot,kind,storage_path,content_type,size_bytes,alt,updated_at&limit=200");
  const by = Object.fromEntries((rows || []).map((r) => [r.slot, r]));
  const items = FA_SLOTS.SLOTS.map((s) => {
    const r = by[s.id];
    return { id: s.id, kind: s.kind, page: s.page, label: s.label, hint: s.hint || "", bases: s.bases || [], limits: FA_SLOTS.LIMITS[s.kind].label,
      custom: r ? { url: ST.publicUrl(ST.BUCKET_MEDIA, r.storage_path), alt: r.alt || "", updatedAt: r.updated_at, size: r.size_bytes == null ? null : Number(r.size_bytes) } : null };
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
  if (prev && prev[0] && prev[0].storage_path !== path) await ST.removeObjects(ST.BUCKET_MEDIA, [prev[0].storage_path]);
  send(res, 200, { ok: true, url: ST.publicUrl(ST.BUCKET_MEDIA, path) });
}

async function mediaReset(req, res) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
  const slot = FA_SLOTS.bySlot(String((await readBody(req)).slot || ""));
  if (!slot) throw new HttpError(400, "Ese espacio de la página no existe.", "bad_slot");
  const prev = await rest(`site_media?select=storage_path&slot=eq.${enc(slot.id)}`);
  await rest(`site_media?slot=eq.${enc(slot.id)}`, { method: "DELETE", prefer: "return=minimal" });
  if (prev && prev[0]) await ST.removeObjects(ST.BUCKET_MEDIA, [prev[0].storage_path]);
  send(res, 200, { ok: true });
}

const ROUTES = { list, thread, reply, whoami, videos, "video-confirm": videoConfirm, "video-propose": videoPropose, "video-cancel": videoCancel,
  "access-list": accessList, "access-grant": accessGrant, "access-revoke": accessRevoke,
  materials, "material-upload-url": materialUploadUrl, "material-save": materialSave, "material-update": materialUpdate, "material-delete": materialDelete,
  media, "media-upload-url": mediaUploadUrl, "media-save": mediaSave, "media-reset": mediaReset };

module.exports = handle(async (req, res) => {
  const fn = ROUTES[String(queryOf(req).action || "")];
  if (!fn) throw new HttpError(404, "Acción no encontrada.", "not_found");
  const user = await getUserFromToken(bearer(req));
  if (!(await S.isAdmin(user))) throw new HttpError(403, "Esta cuenta no tiene acceso al panel del equipo.", "not_admin");
  return fn(req, res, user);
});
