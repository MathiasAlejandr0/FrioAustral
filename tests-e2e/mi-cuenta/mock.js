/* API simulada de «Mi cuenta» (Playwright page.route). NADA llega a Supabase ni a producción: la vista previa comparte base con producción. */
const CFG = require("../../assets/fa-config.js");
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString();

const STUB = `window.__calls=[];window.supabase={createClient:()=>({auth:{
  getSession:async()=>({data:{session:localStorage.getItem('__sess')?{access_token:'t'}:null}}),
  signOut:async()=>{localStorage.removeItem('__sess')},
  signInWithPassword:async(o)=>{window.__calls.push(['signIn',o.email]);if(o.password==='mala')return{error:{message:'Invalid login credentials'}};localStorage.setItem('__sess','1');return{error:null}},
  resetPasswordForEmail:async(e,o)=>{window.__calls.push(['reset',e,o&&o.redirectTo]);return{error:null}},
  updateUser:async(o)=>{window.__calls.push(['update',o.password]);localStorage.setItem('__sess','1');return{error:null}},
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};`;

function features(plan) {
  const p = CFG.PLANS[plan] || {};
  return { calls: !!p.calls, community: !!p.community, videollamada: !!p.videollamada, ver_preguntas_otros: !!p.ver_preguntas_otros, ebooks_gratis: !!p.ebooks_gratis, biblioteca: !!p.biblioteca };
}

/* kind: aprendiz | tecnico | premium | verificando | vencido | cancelado | sincupo */
function scenario(kind, over = {}) {
  const now = Date.now();
  const plan = { aprendiz: "basico", tecnico: "pro", premium: "premium", cancelado: "pro", sincupo: "basico", vencido: "pro", verificando: null }[kind];
  const sub = {
    email: "carlos@taller.cl", nombre: "carlos andrade", plan, planName: plan ? CFG.PLANS[plan].name : null, amount: plan ? CFG.PLANS[plan].amount : null,
    pendingPlan: null, status: { vencido: "cancelada", cancelado: "cancelada_fin_periodo", verificando: "sin_suscripcion" }[kind] || "activa",
    periodStart: iso(now - 18 * DAY), periodEnd: kind === "vencido" ? iso(now - 6 * DAY) : iso(now + 12 * DAY), hasSubscription: !!plan,
  };
  if (kind === "verificando") { sub.periodStart = null; sub.periodEnd = null; }
  const canAsk = ["aprendiz", "tecnico", "premium", "cancelado", "sincupo"].includes(kind);
  const unlimited = plan !== "basico";
  const used = kind === "sincupo" ? 3 : unlimited ? 4 : 1;
  const msgs = [
    { id: 1, sender: "cliente", body: "Hola, tengo una Hilux 2018 y el aire sale tibio.", created_at: iso(now - 3 * DAY), read: true },
    { id: 2, sender: "equipo", body: "Hola Carlos. Revisa primero la presión de gas con manómetros y si el compresor engancha.", created_at: iso(now - 3 * DAY + 3600000), read: true },
    { id: 3, sender: "cliente", body: "El compresor engancha pero la baja queda en 60 psi.", created_at: iso(now - 1 * DAY), read: true },
  ];
  const s = {
    kind, calls: [], fail: {}, session: true,
    me: { ok: true, subscriber: sub, canAsk, quota: { limit: unlimited ? null : 3, used: kind === "verificando" ? 0 : used, left: unlimited ? null : Math.max(0, 3 - used), unlimited, periodFrom: sub.periodStart, periodTo: sub.periodEnd }, features: features(plan), messages: msgs },
    materials: canAsk ? [
      { id: "11111111-1111-1111-1111-111111111111", title: "Guía de diagnóstico del aire automotriz", description: "Pasos para medir presiones y encontrar fugas.", category: "guia", fileName: "guia-diagnostico.pdf", contentType: "application/pdf", size: 2400000, createdAt: iso(now - 4 * DAY) },
      { id: "22222222-2222-2222-2222-222222222222", title: "Ebook: gases refrigerantes R134a y R1234yf", description: "", category: "ebook", fileName: "gases.epub", contentType: "application/epub+zip", size: 5200000, createdAt: iso(now - 40 * DAY) },
      { id: "33333333-3333-3333-3333-333333333333", title: "Tabla de presiones por temperatura", description: "Referencia rápida para el taller.", category: "recurso", fileName: "presiones.png", contentType: "image/png", size: 400000, createdAt: iso(now - 60 * DAY) },
    ] : [],
    videos: [], community: [{ pregunta: "¿Cuánto gas lleva una Hilux 2018?", respuesta: "Revisa la etiqueta bajo el capó: lleva 550 g de R134a.", fecha: iso(now - 5 * DAY) }],
  };
  if (kind === "premium") {
    s.videos = [{ id: "44444444-4444-4444-4444-444444444444", status: "confirmada", scheduledAt: iso(now + 2 * DAY), canJoin: false, joinFrom: iso(now + 2 * DAY - 600000), url: "https://meet.jit.si/frioaustral-44444444-4444-4444-4444-444444444444", note: "Compresor en Hilux" }];
  }
  return Object.assign(s, over);
}

async function install(page, s) {
  /* supabase-js se carga con SRI: el stub se instala antes de los scripts de la página (fa-auth.js no pide el CDN si window.supabase ya existe). */
  await page.addInitScript({ content: STUB });
  await page.addInitScript(() => { if (!window.__noSess) localStorage.setItem("__sess", "1"); });
  await page.route("**/api/public-config", (r) => r.fulfill({ json: { ready: true, supabaseUrl: "https://x.test", supabaseAnonKey: "x" } }));
  await page.route("**/supabase.js", (r) => r.fulfill({ body: STUB, contentType: "application/javascript" }));
  await page.context().route("https://files.test/**", (r) => r.fulfill({ body: "archivo de prueba", contentType: "text/html" }));
  await page.route("**/api/account?**", async (route) => {
    const req = route.request(), u = new URL(req.url()), action = u.searchParams.get("action");
    let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) { /* sin cuerpo */ }
    s.calls.push({ action, method: req.method(), body });
    const json = (status, o) => route.fulfill({ status, json: o });
    const err = (status, code, message) => json(status, { ok: false, code, message });
    const f = s.fail[action];
    if (f) { if (!f.always) delete s.fail[action]; if (f.abort) return route.abort(); return err(f.status, f.code, f.message || "Error"); }
    if (!s.session) return err(401, "bad_session", "Tu sesión expiró. Vuelve a ingresar.");
    const m = s.me;
    const out = () => ({ ...m, unreadReplies: m.messages.filter((x) => x.sender === "equipo" && !x.read).length });
    switch (action) {
      case "me": return json(200, out());
      case "read": m.messages.forEach((x) => { if (x.sender === "equipo") x.read = true; }); return json(200, { ok: true });
      case "message": {
        if (!body.body || !String(body.body).trim()) return err(400, "empty", "Escribe tu pregunta.");
        if (!m.canAsk) return err(403, "inactive", "Tu suscripción no está activa.");
        if (!m.quota.unlimited && m.quota.left <= 0) return err(403, "quota", "Usaste tus preguntas.");
        await new Promise((r) => setTimeout(r, s.delay || 0));
        const msg = { id: 100 + m.messages.length, sender: "cliente", body: String(body.body).trim(), created_at: iso(Date.now()), read: true };
        m.messages.push(msg); m.quota.used += 1; if (!m.quota.unlimited) m.quota.left = Math.max(0, m.quota.left - 1);
        return json(201, { ok: true, message: { id: msg.id, sender: msg.sender, body: msg.body, created_at: msg.created_at }, quota: m.quota });
      }
      case "materials": return m.canAsk ? json(200, { ok: true, plan: m.subscriber.plan, items: s.materials }) : err(403, "inactive", "Tu suscripción no está activa.");
      case "material-url": return json(200, { ok: true, url: "https://files.test/sign/" + body.id + "?token=SIG", fileName: "x", expiresIn: 120 });
      case "videos": return json(200, { ok: true, items: s.videos });
      case "video-request": {
        if (s.videos.filter((v) => ["solicitada", "propuesta"].includes(v.status)).length >= 2) return err(409, "too_many", "x");
        const v = { id: "5555555" + s.videos.length + "-5555-5555-5555-555555555555", status: "solicitada", scheduledAt: body.when, canJoin: false, url: "", note: body.note || "" };
        s.videos.push(v); return json(201, { ok: true, item: v });
      }
      case "video-accept": { const v = s.videos.find((x) => x.id === body.id); if (v) v.status = "confirmada"; return json(200, { ok: true, item: v }); }
      case "video-cancel": { const v = s.videos.find((x) => x.id === body.id); if (v) v.status = "cancelada"; return json(200, { ok: true, item: v }); }
      case "community": return json(200, { ok: true, items: s.community.filter((i) => !u.searchParams.get("q") || (i.pregunta + i.respuesta).toLowerCase().includes(u.searchParams.get("q").toLowerCase())) });
      case "signup": return json(201, { ok: true });
      default: return err(404, "not_found", "Acción no encontrada.");
    }
  });
}

module.exports = { scenario, install, DAY, iso };
