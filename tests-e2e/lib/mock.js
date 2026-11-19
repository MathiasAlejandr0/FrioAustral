/* API simulada del panel (page.route). Nada sale a internet ni toca la base real. */
const FA = require("../../assets/fa-slots.js");
const { png } = require("./png");
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SB = "https://sb.test/storage/v1";
const PNG1 = png(2, 2, [30, 60, 90]);

function estado() {
  const S = {
    session: false, calls: [], uploads: [], fail: {}, delay: {}, admin: true,
    subs: [
      { user_id: uid(1), email: "ana@correo.cl", nombre: "Ana Rojas", plan: "pro", status: "activa", period_start: iso(-10), period_end: iso(20), cancel_at_period_end: false, created_at: iso(-40) },
      { user_id: uid(2), email: "luis@correo.cl", nombre: "Luis Soto", plan: "basico", status: "activa", period_start: iso(-5), period_end: iso(25), cancel_at_period_end: false, created_at: iso(-30) },
      { user_id: uid(3), email: "marta@correo.cl", nombre: "Marta Díaz", plan: "premium", status: "activa", period_start: iso(-2), period_end: iso(28), cancel_at_period_end: false, created_at: iso(-20) },
    ],
    msgs: { [uid(1)]: [{ id: "m1", sender: "cliente", body: "Hola, mi A/C no enfría y el manómetro marca 30 psi en baja. ¿Qué reviso primero?", created_at: iso(-0.2), read: false }, { id: "m1b", sender: "equipo", body: "Hola Ana, revisa primero la carga.", created_at: iso(-3), read: true }],
      [uid(2)]: [{ id: "m2", sender: "cliente", body: "¿Sirve el gas R134a en un auto 2019?", created_at: iso(-1), read: false }], [uid(3)]: [] },
    videos: [
      { id: uid(11), scheduledAt: iso(2), status: "solicitada", proposedBy: "cliente", note: "Quiero revisar un compresor.", user_id: uid(1), nombre: "Ana Rojas", email: "ana@correo.cl" },
      { id: uid(12), scheduledAt: iso(5), status: "confirmada", proposedBy: "equipo", note: null, user_id: uid(3), nombre: "Marta Díaz", email: "marta@correo.cl", room: "fa-x", url: "https://meet.example/fa-x" },
    ],
    access: [
      { id: uid(21), email: "ana@correo.cl", plan: "pro", planName: "Plan Técnico", status: "activa", periodEnd: iso(5), source: "hotmart", lastEvent: "PURCHASE_APPROVED", lastEventAt: iso(-25), buyerName: "Ana Rojas", hasAccount: true, active: true },
      { id: uid(22), email: "pedro@correo.cl", plan: "premium", planName: "Plan Premium", status: "activa", periodEnd: iso(60), source: "manual", lastEvent: "MANUAL_GRANT", lastEventAt: iso(-3), buyerName: null, hasAccount: false, active: true },
      { id: uid(23), email: "vieja@correo.cl", plan: "basico", planName: "Plan Aprendiz", status: "cancelada", periodEnd: iso(-30), source: "hotmart", lastEvent: "PURCHASE_CANCELED", lastEventAt: iso(-30), buyerName: "Vieja Cuenta", hasAccount: true, active: false },
    ],
    events: [{ event: "PURCHASE_APPROVED", email: "ana@correo.cl", plan: "pro", outcome: "applied", detail: null, received_at: iso(-25) }, { event: "PURCHASE_X", email: null, plan: null, outcome: "no_email", detail: null, received_at: iso(-10) }],
    hottokConfigured: true,
    materials: [
      { id: uid(31), title: "Ebook de gases refrigerantes", description: "Guía completa", category: "ebook", fileName: "gases.pdf", contentType: "application/pdf", size: 2400000, createdAt: iso(-12), plans: ["premium"], published: true },
      { id: uid(32), title: "Plantilla de diagnóstico", description: "", category: "recurso", fileName: "plantilla.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 90000, createdAt: iso(-6), plans: ["basico", "pro", "premium"], published: false },
    ],
    free: [
      { id: uid(41), title: "Cómo leer un manifold", description: "Aprende a leer las presiones.", kind: "video_externo", coverUrl: "https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg", coverFallbackUrl: "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg", fileUrl: null, fileName: null, contentType: null, size: null, videoUrl: "https://www.youtube.com/watch?v=abcdefghijk", youtube: true, hasOwnCover: false, createdAt: iso(-9), published: true },
      { id: uid(42), title: "Tabla de presiones R134a", description: "PDF para imprimir.", kind: "archivo", coverUrl: SB + "/object/public/free-resources/x/cover.png", coverFallbackUrl: null, fileUrl: SB + "/object/public/free-resources/x/tabla.pdf", fileName: "tabla.pdf", contentType: "application/pdf", size: 300000, videoUrl: null, youtube: false, hasOwnCover: true, createdAt: iso(-4), published: false },
    ],
    media: {},
    paths: {},
  };
  S.media["inicio-curso"] = { url: SB + "/object/public/site-media/inicio-curso/1700000000000-foto.png", alt: "", updatedAt: iso(-2), size: 400000, contentType: "image/webp", hasPrevious: true };
  S.media["taller-equipo"] = { url: SB + "/object/public/site-media/taller-equipo/1700000000001-eq.png", alt: "", updatedAt: iso(-1), size: 300000, contentType: "image/webp", hasPrevious: false };
  return S;
}

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const STUB = `window.supabase={createClient:function(u,k){var K='fa-mock-session';var cb=[];
 var sess=function(){return localStorage.getItem(K)?{access_token:'tok',user:{email:'equipo@frioaustral.cl'}}:null};
 return{supabaseKey:k,auth:{getSession:function(){return Promise.resolve({data:{session:sess()}})},
  signInWithPassword:function(o){return new Promise(function(ok){setTimeout(function(){if(o.password==='clave-ok'){localStorage.setItem(K,'1');ok({error:null})}else ok({error:{message:'Invalid login credentials'}})},40)})},
  signOut:function(){localStorage.removeItem(K);return Promise.resolve({error:null})},
  resetPasswordForEmail:function(){window.__reset=(window.__reset||0)+1;return Promise.resolve({error:null})},
  updateUser:function(){return Promise.resolve({error:null})}},
 storage:{from:function(b){return{url:'${SB}',headers:{apikey:k},uploadToSignedUrl:function(){return Promise.resolve({data:{},error:null})}}}}}}};`;

/* instala la API simulada en la página; devuelve el estado para consultar y ajustar desde la prueba */
async function instalar(page, opts) {
  opts = opts || {};
  const S = estado();
  if (opts.session !== false) await page.addInitScript(() => { try { if (!sessionStorage.getItem("__noauto")) localStorage.setItem("fa-mock-session", "1"); } catch (e) {} });
  await page.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === "127.0.0.1" && !u.pathname.startsWith("/api/")) return route.fallback();
    if (u.hostname === "cdn.jsdelivr.net") return route.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (u.hostname === "i.ytimg.com") return route.fulfill({ status: 200, contentType: "image/png", body: PNG1 });
    if (u.hostname === "sb.test") {
      if (req.method() === "PUT" && /\/object\/upload\/sign\//.test(u.pathname)) {
        const d = S.delay.upload; if (d) await new Promise((r) => setTimeout(r, d));
        if (S.fail.upload) return json(route, 500, { message: "boom" });
        S.uploads.push({ path: u.pathname, size: (req.postDataBuffer() || Buffer.alloc(0)).length, headers: req.headers() });
        return json(route, 200, { Key: u.pathname });
      }
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG1 });
    }
    if (u.hostname === "127.0.0.1" && u.pathname.startsWith("/api/")) return api(route, req, u);
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  async function api(route, req, u) {
    const action = u.searchParams.get("action") || u.pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    if (u.pathname === "/api/public-config") return json(route, 200, { ready: true, supabaseUrl: "https://sb.test", supabaseAnonKey: "anon" });
    if (u.pathname !== "/api/admin") return json(route, 200, { ok: true, items: [] });
    S.calls.push({ action, method: req.method(), body, query: Object.fromEntries(u.searchParams) });
    const dl = S.delay[action]; if (dl) await new Promise((r) => setTimeout(r, dl));
    if (!S.session && !(await page.evaluate(() => !!localStorage.getItem("fa-mock-session")).catch(() => true))) return json(route, 401, { ok: false, message: "Tu sesión expiró.", code: "no_session" });
    if (S.expire) return json(route, 401, { ok: false, message: "Tu sesión expiró.", code: "bad_session" });
    if (!S.admin) return json(route, 403, { ok: false, message: "No.", code: "not_admin" });
    const f = S.fail[action]; if (f) { if (!f.times || --f.times <= 0) delete S.fail[action]; return json(route, f.status || 400, { ok: false, message: f.message || "Falló.", code: f.code }); }
    const r = handler(action, body, u.searchParams);
    if (r instanceof Error) return json(route, r.status || 400, { ok: false, message: r.message, code: r.code });
    return json(route, r.__status || 200, r);
  }
  const E = (status, code, message) => Object.assign(new Error(message || code), { status, code });
  const sub = (id) => S.subs.find((s) => s.user_id === id);
  function handler(a, b, q) {
    switch (a) {
      case "whoami": return { ok: true, email: "equipo@frioaustral.cl" };
      case "summary": {
        const unread = Object.values(S.msgs).flat().filter((m) => m.sender === "cliente" && !m.read);
        const byPlan = { basico: 0, pro: 0, premium: 0 }; S.subs.forEach((s) => (byPlan[s.plan]++));
        const mat = Object.fromEntries(["basico", "pro", "premium"].map((k) => { const o = S.materials.filter((m) => m.plans.includes(k)); return [k, { total: o.length, hidden: o.filter((m) => !m.published).length }]; }));
        const asked = S.videos.filter((v) => v.status === "solicitada");
        return { ok: true, messages: { people: new Set(unread.map((m) => m.u)).size || unread.length, messages: unread.length }, videos: { pending: asked.length, nextAt: asked[0] ? asked[0].scheduledAt : null },
          subscribers: { byPlan, problems: 0, total: S.subs.length, mrr: 5000 + 10000 + 20000 }, expiring: S.access.filter((x) => x.active && new Date(x.periodEnd) - Date.now() < 7 * 864e5).length, material: mat,
          free: { published: S.free.filter((x) => x.published).length, hidden: S.free.filter((x) => !x.published).length }, media: { changed: Object.keys(S.media).length, total: FA.SLOTS.length },
          recent: [{ type: "material", title: "Ebook de gases refrigerantes", at: iso(-12) }, { type: "foto", slot: "taller-equipo", at: iso(-1) }], limits: { subscribers: false, unread: false, access: false, videos: false } };
      }
      case "list": {
        const items = S.subs.map((s) => { const un = (S.msgs[s.user_id] || []).filter((m) => m.sender === "cliente" && !m.read); return { ...s, planName: ({ basico: "Plan Aprendiz", pro: "Plan Técnico", premium: "Plan Premium" })[s.plan], unread: un.length, lastUnreadAt: un.length ? un[0].created_at : null, canAsk: true }; });
        return { ok: true, items, stats: { total: items.length, active: items.length, unread: items.reduce((a2, x) => a2 + x.unread, 0), mrr: 35000 } };
      }
      case "thread": {
        const s = sub(q.get("user")); if (!s) return E(404, "not_found");
        const ms = S.msgs[s.user_id] || [];
        const out = { ok: true, subscriber: { user_id: s.user_id, email: s.email, nombre: s.nombre, plan: s.plan, planName: s.plan, status: s.status, period_end: s.period_end }, canAsk: true, quota: { limit: 3, used: 1, remaining: 2, unlimited: false }, messages: ms.map((m) => ({ id: m.id, sender: m.sender, body: m.body, created_at: m.created_at })) };
        if (q.get("mark") !== "0") ms.forEach((m) => (m.read = true));
        return out;
      }
      case "mark-read": (S.msgs[b.user] || []).forEach((m) => (m.read = true)); return { ok: true };
      case "reply": { const m = { id: "n" + Date.now(), sender: "equipo", body: b.body, created_at: new Date().toISOString(), read: true }; (S.msgs[b.user] = S.msgs[b.user] || []).push(m); (S.msgs[b.user] || []).forEach((x) => (x.read = true)); return { ok: true, message: m, __status: 201 }; }
      case "videos": return { ok: true, items: S.videos.filter((v) => v.status !== "cancelada") };
      case "video-confirm": { const v = S.videos.find((x) => x.id === b.id); v.status = "confirmada"; v.room = "fa-r"; v.url = "https://meet.example/fa-r"; return { ok: true, item: v }; }
      case "video-propose": { const v = S.videos.find((x) => x.id === b.id); v.status = "propuesta"; v.proposedBy = "equipo"; v.scheduledAt = b.when; v.note = b.note || null; return { ok: true, item: v }; }
      case "video-cancel": { const v = S.videos.find((x) => x.id === b.id); v.status = "cancelada"; return { ok: true, item: v }; }
      case "access-list": return { ok: true, items: S.access, events: S.events, hottokConfigured: S.hottokConfigured };
      case "access-grant": { if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email)) return E(400, "bad_email"); S.access.unshift({ id: uid(60 + S.access.length), email: b.email, plan: b.plan, planName: b.plan, status: "activa", periodEnd: b.until + "T23:59:59-03:00", source: "manual", lastEvent: "MANUAL_GRANT", lastEventAt: iso(0), buyerName: null, hasAccount: false, active: true }); return { ok: true, id: "x" }; }
      case "access-revoke": { const x = S.access.find((y) => y.id === b.id); x.status = "cancelada"; x.active = false; return { ok: true }; }
      case "materials": return { ok: true, items: S.materials, plans: ["basico", "pro", "premium"], categories: ["ebook", "biblioteca", "guia", "video", "recurso"] };
      case "material-upload-url": { const p = `${uid(70)}/${Date.now()}-${b.fileName}`; return { ok: true, bucket: "plan-material", path: p, token: "tok", contentType: b.contentType }; }
      case "material-save": { const m = { id: uid(80 + S.materials.length), title: b.title, description: b.description || "", category: b.category, fileName: b.fileName, contentType: b.contentType, size: b.size, createdAt: iso(0), plans: b.plans, published: b.published !== false }; S.materials.unshift(m); return { ok: true, item: m, __status: 201 }; }
      case "material-update": { const m = S.materials.find((x) => x.id === b.id); Object.assign(m, { title: b.title, description: b.description, category: b.category, plans: b.plans, published: b.published }); return { ok: true, item: m }; }
      case "material-delete": S.materials = S.materials.filter((x) => x.id !== b.id); return { ok: true };
      case "material-preview-url": return { ok: true, url: SB + "/object/sign/plan-material/x.pdf?token=t", fileName: "x.pdf", contentType: "application/pdf", size: 1000 };
      case "free-list": return { ok: true, items: S.free };
      case "free-upload-url": { const id = b.id || uid(90 + S.free.length); return { ok: true, id, bucket: "free-resources", path: `${id}/${b.role}-${Date.now()}-${b.fileName}`, token: "tok", contentType: b.contentType }; }
      case "free-save": { const r = { id: b.id, title: b.title, description: b.description || "", kind: b.kind, coverUrl: b.coverPath ? SB + "/object/public/free-resources/" + b.coverPath : null, coverFallbackUrl: null, fileUrl: b.filePath ? SB + "/object/public/free-resources/" + b.filePath : null, fileName: b.fileName || null, contentType: b.contentType || null, size: b.size || null, videoUrl: b.videoUrl || null, youtube: /youtu/.test(b.videoUrl || ""), hasOwnCover: !!b.coverPath, createdAt: iso(0), published: b.published !== false }; S.free.unshift(r); return { ok: true, item: r, __status: 201 }; }
      case "free-update": { const r = S.free.find((x) => x.id === b.id); Object.assign(r, { title: b.title, description: b.description, published: b.published }); return { ok: true, item: r }; }
      case "free-delete": S.free = S.free.filter((x) => x.id !== b.id); return { ok: true };
      case "media": return { ok: true, items: FA.SLOTS.map((s) => ({ id: s.id, kind: s.kind, page: s.page, label: s.label, hint: s.hint || "", bases: s.bases || [], limits: FA.LIMITS[s.kind].label, custom: S.media[s.id] || null })) };
      case "media-upload-url": { const p = `${b.slot}/${Date.now()}-${b.fileName}`; S.paths[b.slot] = p; return { ok: true, bucket: "site-media", path: p, token: "tok", contentType: b.contentType }; }
      case "media-save": { const prev = S.media[b.slot]; S.media[b.slot] = { url: SB + "/object/public/site-media/" + b.path, alt: b.alt || "", updatedAt: iso(0), size: b.size, contentType: b.contentType, hasPrevious: !!prev }; return { ok: true, __status: 200 }; }
      case "media-reset": delete S.media[b.slot]; return { ok: true };
      case "media-restore-previous": { const m = S.media[b.slot]; if (!m || !m.hasPrevious) return E(404, "not_found"); m.hasPrevious = false; m.updatedAt = iso(-3); return { ok: true }; }
      default: return E(404, "not_found", "Acción no encontrada.");
    }
  }
  S.api = (a) => S.calls.filter((c) => c.action === a);
  return S;
}
module.exports = { instalar, uid, SB, PNG1 };
