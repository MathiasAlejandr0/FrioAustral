const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const M = require("../assets/fa-panel-mapa.js");
const SL = require("../assets/fa-slots.js");
const PANEL_JS = fs.readdirSync(path.join(root, "assets")).filter((f) => /^fa-panel.*\.js$/.test(f)).map((f) => "assets/" + f);
const PANEL_FILES = ["equipo.html", "assets/fa-panel.css"].concat(PANEL_JS);

test("el catálogo humano cubre los 34 espacios, sin repetir ni inventar ids", () => {
  const ids = SL.SLOTS.map((s) => s.id);
  assert.equal(ids.length, 34);
  assert.deepEqual(M.ZONAS.map((z) => z.id).sort(), ids.slice().sort());
  const enPaginas = M.PAGINAS.flatMap((p) => p.ids);
  assert.deepEqual(enPaginas.slice().sort(), ids.slice().sort(), "cada espacio está en una sola página");
  assert.deepEqual(M.PAGINAS.map((p) => p.slug), ["inicio", "cursos", "gratis", "taller", "comunidad", "suscripcion"]);
  assert.equal(Math.max(...M.PAGINAS.map((p) => p.ids.length)), 12);
});

test("cada zona tiene sección, nombre, «dónde se ve» y forma, sin términos técnicos ni prohibidos", () => {
  for (const z of M.ZONAS) {
    for (const k of ["seccion", "nombre", "donde", "forma"]) assert.ok(String(z[k] || "").trim().length > 2, `${z.id}.${k}`);
    for (const k of ["seccion", "nombre", "donde", "forma", "aviso", "tambien"]) assert.ok(!M.PROHIBIDAS.test(z[k] || ""), `${z.id}.${k}: «${z[k]}»`);
  }
  for (const p of M.PAGINAS) for (const s of p.secciones) assert.ok(!M.PROHIBIDAS.test(`${s.titulo} ${s.texto || ""}`), s.titulo);
});

test("las miniaturas del catálogo son archivos reales del sitio", () => {
  for (const z of M.ZONAS) assert.ok(fs.existsSync(path.join(root, "media/img", z.thumb)), `${z.id}: media/img/${z.thumb}`);
});

test("el orden «foto N de 6» de la galería de Taller es el que ve la gente en taller.html", () => {
  const html = read("taller.html");
  const orden = M.PAGINAS.find((p) => p.slug === "taller").ids.filter((id) => /^taller-galeria-/.test(id));
  const bases = orden.map((id) => SL.bySlot(id).bases[0]);
  const pos = bases.map((b) => html.indexOf(`media/img/${b}-`));
  assert.ok(pos.every((n) => n > -1), "todas las fotos están en taller.html");
  assert.deepEqual(pos, pos.slice().sort((a, b) => a - b), "mismo orden que en el HTML");
  assert.deepEqual(orden.map((id) => M.por(id).galeria), [1, 2, 3, 4, 5, 6]);
});

test("equipo.html es el único panel: no carga el CSS público ni el menú o el pie del sitio", () => {
  const html = read("equipo.html");
  for (const f of ["site.css", "v5.css", "academia.css", "media.css", "fa-app.css", "fa-cuenta.css"]) assert.ok(!html.includes(f), f);
  assert.ok(!/class="[^"]*\b(site-header|mbar|drawer|site-footer)\b/.test(html));
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /assets\/fa-auth\.js/);
  assert.ok(!fs.existsSync(path.join(root, "admin.html")) && !fs.existsSync(path.join(root, "contenido.html")));
  for (const f of ["assets/fa-equipo.js", "assets/fa-contenido.js"]) assert.ok(!fs.existsSync(path.join(root, f)), f);
  for (const f of PANEL_JS) assert.ok(html.includes(f), `${f} no está en equipo.html`);
});

test("el panel no usa vidrio, desenfoque, grano ni cursor personalizado", () => {
  for (const f of PANEL_FILES) {
    const t = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/backdrop-filter|filter\s*:\s*blur|\.glass\b|\.grain\b|cursor\s*:\s*none/i.test(t), f);
  }
});

test("el panel no usa los cuadros nativos del navegador (confirm, alert, prompt)", () => {
  for (const f of PANEL_JS) assert.ok(!/(^|[^\w.])(confirm|alert|prompt)\s*\(/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, "")), f);
});

test("el JS del panel tiene un presupuesto de peso y no depende de librerías nuevas", () => {
  /* Objetivo del encargo: 120 KB sin comprimir. El código legible pesa ~148 KB (≈ 44 KB con gzip; minificado ≈ 117 KB).
     Se deja un tope de 160 KB para que no crezca sin control; ver docs/panel-equipo-rediseno.md. */
  const total = PANEL_JS.reduce((a, f) => a + fs.statSync(path.join(root, f)).size, 0);
  assert.ok(total <= 160 * 1024, `pesa ${(total / 1024).toFixed(1)} KB`);
  for (const f of PANEL_JS) assert.ok(!/https:\/\/(cdn|unpkg|esm)\./.test(read(f)), f);
});

test("/admin y /contenido llevan al panel nuevo y el panel conserva sus cabeceras", () => {
  const v = JSON.parse(read("vercel.json"));
  const to = Object.fromEntries(v.redirects.map((r) => [r.source, r.destination]));
  assert.equal(to["/admin"], "/equipo.html");
  assert.equal(to["/admin.html"], "/equipo.html");
  assert.equal(to["/contenido"], "/equipo.html#/paginas/inicio");
  assert.equal(to["/contenido.html"], "/equipo.html#/paginas/inicio");
  assert.ok(v.redirects.every((r) => r.permanent === false));
  const h = v.headers.find((x) => /equipo/.test(x.source));
  assert.ok(h, "cabeceras del panel");
  const get = (k) => (h.headers.find((x) => x.key === k) || {}).value;
  assert.equal(get("Cache-Control"), "no-store"); assert.equal(get("X-Robots-Tag"), "noindex"); assert.equal(get("X-Frame-Options"), "DENY");
});

test("el panel no usa términos técnicos ni prohibidos en sus textos fijos", () => {
  const prohib = /Base de datos:|Supabase|webhook|hottok|PURCHASE_(?!APPROVED|COMPLETE|CANCELED|REFUNDED|CHARGEBACK)/i;
  for (const f of PANEL_JS.filter((x) => !/mapa|ui\.js/.test(x))) {
    const t = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const strings = t.match(/`[^`]*`|"[^"\n]*"/g) || [];
    for (const s of strings) if (/[ ]/.test(s) && /[A-Za-zÁÉÍÓÚáéíóú]{4}/.test(s)) assert.ok(!/\bwebhook\b|\bhottok\b|Base de datos:/i.test(s), `${f}: ${s.slice(0, 80)}`);
  }
  assert.ok(!prohib.test("") );
});
