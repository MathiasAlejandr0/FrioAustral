/* Cambios de API aprobados para el panel del equipo (aditivos): summary, mark=0 / mark-read en thread,
   material-preview-url y la versión anterior de cada foto (media-save conserva una, media-restore-previous, media-reset borra todo).
   Supabase (rest y storage) simulado, sin red. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.ADMIN_EMAILS = "equipo@test.cl";

const U = {
  admin: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "equipo@test.cl" },
  apr: { id: "11111111-1111-4111-8111-111111111111", email: "apr@test.cl" },
  prem: { id: "22222222-2222-4222-8222-222222222222", email: "prem@test.cl" },
  vig: { id: "33333333-3333-4333-8333-333333333333", email: "mora@test.cl" },
};
const MAT = "99999999-9999-4999-8999-999999999991";
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
let db, objects, removed, listCalls;

function reset() {
  db = {
    admins: [],
    subscribers: [
      { user_id: U.apr.id, email: U.apr.email, nombre: "Ana", plan: "basico", status: "activa", period_end: day(20), created_at: day(-5) },
      { user_id: U.prem.id, email: U.prem.email, nombre: "Pablo", plan: "premium", status: "activa", period_end: day(20), created_at: day(-4) },
      { user_id: U.vig.id, email: U.vig.email, nombre: "Mora", plan: "pro", status: "morosa", period_end: day(-40), created_at: day(-30) },
    ],
    messages: [
      { id: "m1", user_id: U.apr.id, sender: "cliente", body: "Hola", read_by_team: false, created_at: day(-1) },
      { id: "m2", user_id: U.apr.id, sender: "cliente", body: "¿Sigue?", read_by_team: false, created_at: day(-0.5) },
      { id: "m3", user_id: U.prem.id, sender: "cliente", body: "Consulta", read_by_team: false, created_at: day(-0.2) },
      { id: "m4", user_id: U.prem.id, sender: "cliente", body: "Vieja", read_by_team: true, created_at: day(-9) },
    ],
    videocalls: [
      { id: "v1", user_id: U.prem.id, status: "solicitada", scheduled_at: day(3), room: "r" },
      { id: "v2", user_id: U.prem.id, status: "confirmada", scheduled_at: day(5), room: "r" },
    ],
    plan_access: [
      { id: "a1", email: "x@test.cl", plan: "pro", status: "activa", period_end: day(3) },
      { id: "a2", email: "y@test.cl", plan: "pro", status: "activa", period_end: day(30) },
      { id: "a3", email: "z@test.cl", plan: "pro", status: "cancelada", period_end: day(2) },
    ],
    plan_materials: [
      { id: MAT, title: "Ebook", description: "", category: "ebook", storage_path: `${MAT}/ebook.pdf`, file_name: "ebook.pdf", content_type: "application/pdf", size_bytes: 10, plans: ["premium"], published: true, created_at: "2026-11-19T00:00:00Z" },
      { id: "99999999-9999-4999-8999-999999999992", title: "Guía", description: "", category: "guia", storage_path: "x/guia.pdf", file_name: "guia.pdf", content_type: "application/pdf", size_bytes: 10, plans: ["basico", "premium"], published: false, created_at: "2026-11-18T00:00:00Z" },
    ],
    free_resources: [{ id: "r1", title: "Video gratis", kind: "video_externo", published: true, created_at: "2026-11-17T00:00:00Z" }, { id: "r2", title: "Doc", kind: "archivo", published: false, created_at: "2026-11-16T00:00:00Z" }],
    site_media: [],
  };
  objects = new Set([`plan-material/${MAT}/ebook.pdf`]);
  removed = []; listCalls = 0;
}

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, data) => ({ ok: status < 400, status, statusText: "", headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.pathname === "/auth/v1/user") {
    const who = Object.values(U).find((x) => init.headers.Authorization === `Bearer t-${x.id}`);
    return who ? json(200, who) : json(401, {});
  }
  if (u.pathname.startsWith("/storage/v1/")) {
    const s = u.pathname.replace("/storage/v1/", "");
    let m;
    if ((m = /^object\/sign\/(.+)$/.exec(s))) return objects.has(decodeURIComponent(m[1])) ? json(200, { signedURL: `/object/sign/${m[1]}?token=SIG` }) : json(400, {});
    if ((m = /^object\/list\/([^/]+)$/.exec(s))) {
      listCalls++;
      const { prefix } = JSON.parse(init.body);
      return json(200, [...objects].filter((o) => o.startsWith(`${m[1]}/${prefix}/`)).map((o) => ({ name: o.slice(`${m[1]}/${prefix}/`.length), id: "x" })).sort((a, b) => (a.name < b.name ? 1 : -1)));
    }
    if (/^object\/[^/]+$/.test(s) && init.method === "DELETE") {
      const bucket = s.split("/")[1];
      for (const p of JSON.parse(init.body).prefixes) { removed.push(p); objects.delete(`${bucket}/${p}`); }
      return json(200, []);
    }
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const rows = db[u.pathname.split("/").pop()];
    const method = init.method || "GET";
    const sel = () => rows.filter((r) => [...u.searchParams].every(([k, v]) => {
      if (["select", "order", "limit", "on_conflict"].includes(k)) return true;
      const [op, val] = [v.split(".")[0], v.split(".").slice(1).join(".")];
      if (op === "eq") return String(r[k]) === val;
      if (op === "neq") return String(r[k]) !== val;
      return true;
    }));
    if (method === "GET") return json(200, sel());
    if (method === "POST") return json(201, JSON.parse(init.body).map((r) => { const ex = rows.find((x) => x.slot && x.slot === r.slot); if (ex) { Object.assign(ex, r); return ex; } rows.push({ id: "n" + rows.length, ...r }); return r; }));
    if (method === "PATCH") { const out = sel(); out.forEach((r) => Object.assign(r, JSON.parse(init.body))); return json(200, out); }
    if (method === "DELETE") { sel().forEach((r) => rows.splice(rows.indexOf(r), 1)); return json(204, null); }
  }
  return json(404, { message: "sin mock " + url });
};

const admin = require("../api/admin");
function call({ method = "GET", url, body, as = "admin" }) {
  return new Promise((resolve) => {
    const req = { method, url, headers: { authorization: as ? `Bearer t-${U[as].id}` : "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, query: Object.fromEntries(new URL(url, "http://x").searchParams) };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(d) { resolve({ status: this.statusCode, body: d ? JSON.parse(d) : null }); } };
    admin(req, res);
  });
}
beforeEach(reset);

test("summary: todo el panel en una llamada, solo con datos reales", async () => {
  const r = await call({ url: "/api/admin?action=summary" });
  assert.equal(r.status, 200);
  const b = r.body;
  assert.deepEqual(b.messages, { people: 2, messages: 3 });
  assert.deepEqual(b.videos, { pending: 1, nextAt: db.videocalls[0].scheduled_at });
  assert.deepEqual(b.subscribers.byPlan, { basico: 1, pro: 0, premium: 1 });
  assert.equal(b.subscribers.problems, 1);
  assert.equal(b.subscribers.mrr, 25000);
  assert.equal(b.expiring, 1, "solo el acceso activo que vence en 7 días");
  assert.deepEqual(b.material.premium, { total: 2, hidden: 1 });
  assert.deepEqual(b.material.basico, { total: 1, hidden: 1 });
  assert.deepEqual(b.free, { published: 1, hidden: 1 });
  assert.deepEqual(b.media, { changed: 0, total: 34 });
  assert.deepEqual(b.recent.map((x) => x.title), ["Ebook", "Guía", "Video gratis", "Doc"]);
  assert.ok(Object.values(b.limits).every((v) => v === false));
  assert.equal((await call({ url: "/api/admin?action=summary", as: "apr" })).status, 403, "solo el equipo");
  assert.equal((await call({ url: "/api/admin?action=summary", as: null })).status, 401);
});

test("thread: por defecto marca como leído; mark=0 no; mark-read lo marca a mano; responder también", async () => {
  const unread = (id) => db.messages.filter((m) => m.user_id === id && m.sender === "cliente" && !m.read_by_team).length;
  await call({ url: `/api/admin?action=thread&user=${U.apr.id}&mark=0` });
  assert.equal(unread(U.apr.id), 2, "mark=0 no toca nada");
  assert.equal((await call({ method: "POST", url: "/api/admin?action=mark-read", body: { user: "no-es-uuid" } })).status, 400);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=mark-read", body: { user: U.apr.id }, as: "apr" })).status, 403);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=mark-read", body: { user: U.apr.id } })).status, 200);
  assert.equal(unread(U.apr.id), 0);
  await call({ url: `/api/admin?action=thread&user=${U.prem.id}` });
  assert.equal(unread(U.prem.id), 0, "sin mark el comportamiento anterior se mantiene");
});

test("material-preview-url: URL firmada de 2 minutos solo para el equipo", async () => {
  const ok = await call({ method: "POST", url: "/api/admin?action=material-preview-url", body: { id: MAT } });
  assert.equal(ok.status, 200);
  assert.match(ok.body.url, /^https:\/\/db\.test\/storage\/v1\/object\/sign\/plan-material\/.+token=SIG$/);
  assert.equal(ok.body.fileName, "ebook.pdf");
  assert.equal((await call({ method: "POST", url: "/api/admin?action=material-preview-url", body: { id: MAT }, as: "prem" })).status, 403);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=material-preview-url", body: { id: "no" } })).status, 400);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=material-preview-url", body: { id: "99999999-9999-4999-8999-999999999992" } })).status, 404, "el archivo no está en el almacenamiento");
  assert.equal((await call({ url: "/api/admin?action=material-preview-url" })).status, 405);
});

test("fotos: se conserva la versión anterior; restaurarla; volver al original borra todo", async () => {
  const slot = "inicio-curso";
  const put = async (ts) => {
    const path = `${slot}/${ts}-foto.webp`;
    objects.add(`site-media/${path}`);
    const r = await call({ method: "POST", url: "/api/admin?action=media-save", body: { slot, path, fileName: "foto.webp", contentType: "image/webp", size: 100, alt: "x" } });
    assert.equal(r.status, 200);
    return path;
  };
  const get = async () => (await call({ url: "/api/admin?action=media" })).body.items.find((i) => i.id === slot);
  assert.equal((await get()).custom, null);
  const p1 = await put(1795100000001);
  assert.equal((await get()).custom.hasPrevious, false, "la primera subida no tiene anterior");
  const p2 = await put(1795100000002);
  assert.deepEqual(removed, [], "la anterior se conserva");
  assert.equal((await get()).custom.hasPrevious, true);
  const p3 = await put(1795100000003);
  assert.deepEqual(removed, [p1], "solo se conserva una versión anterior: se borra la más vieja");
  assert.ok(objects.has(`site-media/${p2}`) && objects.has(`site-media/${p3}`));
  assert.equal((await call({ method: "POST", url: "/api/admin?action=media-restore-previous", body: { slot: "nada" } })).status, 400);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=media-restore-previous", body: { slot }, as: "apr" })).status, 403);
  const rs = await call({ method: "POST", url: "/api/admin?action=media-restore-previous", body: { slot } });
  assert.equal(rs.status, 200);
  assert.match(rs.body.url, new RegExp(p2.replace(/[.]/g, "\\.")));
  assert.equal(db.site_media[0].storage_path, p2);
  assert.equal(db.site_media[0].content_type, "image/webp");
  assert.ok(!objects.has(`site-media/${p3}`), "la versión que se deja se borra");
  assert.equal((await get()).custom.hasPrevious, false);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=media-restore-previous", body: { slot } })).status, 404, "ya no hay anterior");
  await put(1795100000004);
  assert.equal((await call({ method: "POST", url: "/api/admin?action=media-reset", body: { slot } })).status, 200);
  assert.equal(db.site_media.length, 0);
  assert.deepEqual([...objects].filter((o) => o.startsWith("site-media/")), [], "volver al original borra el archivo actual y el anterior");
  assert.equal((await call({ method: "POST", url: "/api/admin?action=media-restore-previous", body: { slot } })).status, 404, "sin archivo nuevo");
});

test("fotos: si el listado del almacenamiento falla, nada se borra y todo sigue funcionando", async () => {
  const realFetch = global.fetch;
  global.fetch = async (url, init) => (/\/object\/list\//.test(String(url)) ? { ok: false, status: 500, json: async () => ({}), text: async () => "{}" } : realFetch(url, init));
  try {
    const slot = "inicio-curso", path = `${slot}/1795100000009-a.webp`;
    objects.add(`site-media/${path}`);
    assert.equal((await call({ method: "POST", url: "/api/admin?action=media-save", body: { slot, path, fileName: "a.webp", contentType: "image/webp", size: 5 } })).status, 200);
    assert.deepEqual(removed, []);
    assert.equal((await call({ url: "/api/admin?action=media" })).body.items.find((i) => i.id === slot).custom.hasPrevious, false);
  } finally { global.fetch = realFetch; }
});
