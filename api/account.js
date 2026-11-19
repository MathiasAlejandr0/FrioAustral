/**
 * API del panel "Mi cuenta" (suscriptor).
 *   POST /api/account?action=signup        {nombre, email, password}   crea la cuenta (sin sesión)
 *   GET  /api/account?action=me                                         estado, cupo y chat
 *   POST /api/account?action=message       {body}                       envía una pregunta (respeta cupo)
 *   GET  /api/account?action=videos                                     videollamadas (Plan Premium)
 *   POST /api/account?action=video-request {when, note}                 pide una videollamada
 *   POST /api/account?action=video-accept  {id}                         acepta la hora que propuso el equipo
 *   POST /api/account?action=video-cancel  {id}                         cancela la solicitud
 *   GET  /api/account?action=community&q=                               preguntas de otros usuarios (Plan Premium, anonimizadas)
 *   GET  /api/account?action=materials                                  material asignado a MI plan (suscripción vigente)
 *   POST /api/account?action=material-url  {id}                         URL firmada (2 min) para descargar un material de mi plan
 *   GET  /api/account?action=free-resources                             (público) recursos gratis publicados (gratis.html)
 *   GET  /api/account?action=site-media                                 (público) fotos y videos del sitio cambiados desde el panel
 */
const plans = require("./_lib/plans");
const { getUserFromToken, rest, enc, adminCreateUser, HttpError } = require("./_lib/supa");
const S = require("./_lib/subs");
const ACC = require("./_lib/access");
const V = require("./_lib/video");
const C = require("./_lib/content");
const ST = require("./_lib/storage");
const F = require("./_lib/free");
const { readBody, send, bearer, queryOf, handle } = require("./_lib/http");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function needPost(req) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.", "method");
}

async function signup(req, res) {
  needPost(req);
  const b = await readBody(req);
  const nombre = String(b.nombre || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!nombre) throw new HttpError(400, "Escribe tu nombre.", "nombre");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Revisa tu email.", "email");
  if (password.length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.", "password");
  const user = await adminCreateUser({ email, password, nombre });
  await S.ensureSubscriber({ id: user.id, email, user_metadata: { nombre } }, nombre);
  await ACC.applyAccess(email).catch(() => {});
  send(res, 201, { ok: true });
}

async function me(req, res, user) {
  let sub = await S.ensureSubscriber(user);
  /* Si Hotmart ya confirmó el pago de este correo, el plan se vincula a la cuenta aquí. */
  if (await ACC.applyAccess(user.email).catch((e) => { console.error("[access]", e.code); return false; })) sub = await S.getSubscriber(user.id);
  const [quota, messages] = await Promise.all([
    S.quotaFor(sub),
    rest(`messages?select=id,sender,body,created_at&user_id=eq.${enc(user.id)}&order=created_at.desc&limit=200`),
  ]);
  await rest(`messages?user_id=eq.${enc(user.id)}&sender=eq.equipo&read_by_client=eq.false`, {
    method: "PATCH", prefer: "return=minimal", body: { read_by_client: true },
  }).catch(() => {});
  const plan = sub.plan ? plans.getPlan(sub.plan) : null;
  send(res, 200, {
    ok: true,
    subscriber: S.publicSub(sub),
    canAsk: S.canAsk(sub),
    quota,
    features: plan ? {
      calls: !!plan.calls,
      community: !!plan.community,
      videollamada: !!plan.videollamada,
      ver_preguntas_otros: !!plan.ver_preguntas_otros,
      ebooks_gratis: !!plan.ebooks_gratis,
      biblioteca: !!plan.biblioteca,
    } : { calls: false, community: false, videollamada: false, ver_preguntas_otros: false, ebooks_gratis: false, biblioteca: false },
    messages: (messages || []).reverse(),
  });
}

async function message(req, res, user) {
  needPost(req);
  const b = await readBody(req);
  const text = S.cleanMessage(b.body);
  let sub = await S.getSubscriber(user.id);
  if (!S.canAsk(sub)) throw new HttpError(403, "Tu suscripción no está activa. Renueva o regulariza el pago para seguir preguntando.", "inactive");
  const q = await S.quotaFor(sub);
  if (!q.unlimited && q.left <= 0) {
    throw new HttpError(403, `Usaste tus ${q.limit} preguntas de este período. Para seguir preguntando, escríbele al equipo para pasarte al Plan Técnico.`, "quota");
  }
  const rows = await rest("messages", {
    method: "POST", prefer: "return=representation",
    body: [{ user_id: user.id, sender: "cliente", body: text }],
  });
  send(res, 201, { ok: true, message: rows[0], quota: await S.quotaFor(sub) });
}

async function community(req, res, user) {
  const sub = await await S.getSubscriber(user.id);
  const plan = sub && sub.plan ? plans.getPlan(sub.plan) : null;
  if (!plan || !(plan.community || plan.ver_preguntas_otros) || !S.canAsk(sub)) throw new HttpError(403, "El historial de preguntas de otros usuarios es parte del Plan Premium.", "not_premium");
  const q = String(queryOf(req).q || "").trim().toLowerCase().slice(0, 80);
  const rows = await rest("messages?select=user_id,sender,body,created_at&order=user_id.asc,created_at.asc&limit=3000");
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if (m.sender !== "cliente") continue;
    const reply = rows.slice(i + 1).find((x) => x.user_id === m.user_id && x.sender === "equipo");
    const nextQ = rows.slice(i + 1).find((x) => x.user_id === m.user_id && x.sender === "cliente");
    if (!reply || (nextQ && new Date(nextQ.created_at) < new Date(reply.created_at))) continue;
    if (q && !(m.body.toLowerCase().includes(q) || reply.body.toLowerCase().includes(q))) continue;
    items.push({ pregunta: String(m.body || ""), respuesta: String(reply.body || ""), fecha: reply.created_at });
  }
  items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  send(res, 200, { ok: true, items: items.slice(0, 60) });
}

async function requireVideoPlan(user) {
  const sub = await await S.getSubscriber(user.id);
  const plan = sub && sub.plan ? plans.getPlan(sub.plan) : null;
  if (!plan || !plan.videollamada || !S.canAsk(sub)) throw new HttpError(403, "Las videollamadas de asesoría son parte del Plan Premium.", "not_premium");
  return sub;
}

async function ownCall(user, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) throw new HttpError(400, "Solicitud no válida.", "bad_id");
  const rows = await rest(`videocalls?select=*&id=eq.${enc(id)}&user_id=eq.${enc(user.id)}&limit=1`);
  if (!rows || !rows[0]) throw new HttpError(404, "No encontramos esa videollamada.", "not_found");
  return rows[0];
}

async function videos(req, res, user) {
  await requireVideoPlan(user);
  const rows = await rest(`videocalls?select=*&user_id=eq.${enc(user.id)}&order=scheduled_at.desc&limit=20`);
  send(res, 200, { ok: true, items: (rows || []).map((v) => V.publicCall(v)) });
}

async function videoRequest(req, res, user) {
  needPost(req);
  await requireVideoPlan(user);
  const b = await readBody(req);
  const when = V.parseWhen(b.when);
  const open = await rest(`videocalls?select=id&user_id=eq.${enc(user.id)}&status=in.(solicitada,propuesta)&limit=5`);
  if (open && open.length >= 2) throw new HttpError(409, "Ya tienes solicitudes pendientes. Espera la respuesta del equipo.", "too_many");
  const rows = await rest("videocalls", {
    method: "POST", prefer: "return=representation",
    body: [{ user_id: user.id, scheduled_at: when, status: "solicitada", proposed_by: "cliente", room: V.newRoom(), note: V.cleanNote(b.note) }],
  });
  send(res, 201, { ok: true, item: V.publicCall(rows[0]) });
}

async function videoAccept(req, res, user) {
  needPost(req);
  await requireVideoPlan(user);
  const v = await ownCall(user, (await readBody(req)).id);
  if (v.status !== "propuesta") throw new HttpError(400, "No hay una hora propuesta por el equipo para aceptar.", "bad_state");
  const rows = await rest(`videocalls?id=eq.${enc(v.id)}&user_id=eq.${enc(user.id)}`, { method: "PATCH", prefer: "return=representation", body: { status: "confirmada", updated_at: new Date().toISOString() } });
  send(res, 200, { ok: true, item: V.publicCall(rows[0]) });
}

async function videoCancel(req, res, user) {
  needPost(req);
  const v = await ownCall(user, (await readBody(req)).id);
  if (v.status === "cancelada") return send(res, 200, { ok: true, item: V.publicCall(v) });
  const rows = await rest(`videocalls?id=eq.${enc(v.id)}&user_id=eq.${enc(user.id)}`, { method: "PATCH", prefer: "return=representation", body: { status: "cancelada", updated_at: new Date().toISOString() } });
  send(res, 200, { ok: true, item: V.publicCall(rows[0]) });
}

/* ---------- material por plan: solo lo ve y lo descarga quien tiene su plan vigente ---------- */
async function accessiblePlan(user) {
  let sub = await S.getSubscriber(user.id);
  if (!S.canAsk(sub)) throw new HttpError(403, "Tu suscripción no está activa. Renueva tu plan para ver el material.", "inactive");
  return sub.plan;
}

async function materials(req, res, user) {
  const plan = await accessiblePlan(user);
  const rows = await rest(`plan_materials?select=id,title,description,category,file_name,content_type,size_bytes,created_at&published=eq.true&plans=cs.${enc(`{${plan}}`)}&order=created_at.desc&limit=500`);
  send(res, 200, { ok: true, plan, items: (rows || []).map((m) => C.publicMaterial(m)) });
}

async function materialUrl(req, res, user) {
  needPost(req);
  const plan = await accessiblePlan(user);
  const id = String((await readBody(req)).id || "");
  if (!C.UUID_RE.test(id)) throw new HttpError(400, "Material no válido.", "bad_id");
  const rows = await rest(`plan_materials?select=storage_path,file_name,plans,published&id=eq.${enc(id)}`);
  const m = rows && rows[0];
  if (!m || !m.published || !(m.plans || []).includes(plan)) throw new HttpError(404, "Ese material no está disponible en tu plan.", "not_found");
  const url = await ST.createSignedDownload(ST.BUCKET_MATERIAL, m.storage_path, { expiresIn: 120, downloadName: m.file_name });
  if (!url) throw new HttpError(404, "El archivo no está disponible por ahora. Avísanos por el chat.", "file_missing");
  send(res, 200, { ok: true, url, fileName: m.file_name, expiresIn: 120 });
}

/* ---------- fotos y videos del sitio (público, sin sesión) ---------- */
async function siteMedia(req, res) {
  let items = {};
  try {
    const rows = await rest("site_media?select=slot,kind,storage_path,alt,updated_at&limit=200");
    for (const r of rows || []) items[r.slot] = { kind: r.kind, url: ST.publicUrl(ST.BUCKET_MEDIA, r.storage_path), alt: r.alt || "", v: r.updated_at };
  } catch (e) { items = {}; /* sin base de datos: el sitio usa sus archivos de siempre */ }
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, items }));
}

/* Recursos gratis publicados (público, sin sesión). Si la base de datos no responde, la lista queda vacía. */
async function freeResources(req, res) {
  let items = [];
  try {
    const rows = await rest("free_resources?select=id,title,description,kind,cover_path,file_path,file_name,content_type,size_bytes,video_url,created_at&published=eq.true&order=created_at.desc&limit=100");
    items = (rows || []).map((r) => F.publicFree(r));
  } catch (e) { items = []; }
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, items }));
}

const ROUTES = { me, message, community, videos, "video-request": videoRequest, "video-accept": videoAccept, "video-cancel": videoCancel, materials, "material-url": materialUrl };

module.exports = handle(async (req, res) => {
  const action = String(queryOf(req).action || "");
  if (action === "signup") return signup(req, res);
  if (action === "site-media") return siteMedia(req, res);
  if (action === "free-resources") return freeResources(req, res);
  const fn = ROUTES[action];
  if (!fn) throw new HttpError(404, "Acción no encontrada.", "not_found");
  const user = await getUserFromToken(bearer(req));
  return fn(req, res, user);
});
