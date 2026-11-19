const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const HOTMART_CURSO = "https://pay.hotmart.com/M101158236T";

test("fa-config.js deja la Academia apagada y cada curso lleva su hotmartCheckoutUrl", () => {
  const cfg = require("../assets/fa-config.js");
  assert.equal(cfg.ACADEMIA_ENABLED, false);
  assert.equal(cfg.HOTMART_CHECKOUT_URL, undefined, "ya no hay un link global para todos los cursos");
  assert.equal(cfg.DEFAULT_COURSE, "aire-acondicionado-automotriz");
  assert.equal(cfg.COURSES["aire-acondicionado-automotriz"].hotmartCheckoutUrl, HOTMART_CURSO);
  assert.equal(cfg.COURSES["parte-2-profesional"].hotmartCheckoutUrl, "", "sin link todavía: queda «Próximamente»");
  assert.ok(!/hotfeature|_hi=/.test(JSON.stringify(cfg)), "sin parámetros de tracking");
});

test("los botones de compra de curso abren el pago en pestaña nueva y el curso sin link queda en «Próximamente»", () => {
  for (const f of fs.readdirSync(root).filter((x) => x.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of html.matchAll(/<a [^>]*data-course="aire-acondicionado-automotriz"[^>]*>/g)) {
      assert.ok(m[0].includes(`href="${HOTMART_CURSO}"`) && m[0].includes('target="_blank"') && m[0].includes('rel="noopener"'), `${f}: ${m[0]}`);
    }
    assert.ok(!/academia\.html\?c=/.test(html), `${f}: aún enlaza a la academia para comprar`);
  }
  const cursos = fs.readFileSync(path.join(root, "cursos.html"), "utf8");
  assert.match(cursos, /data-course="parte-2-profesional"/);
});

test("precios de la suscripción en un solo lugar", () => {
  const cfg = require("../assets/fa-config.js");
  assert.deepEqual(Object.fromEntries(Object.entries(cfg.PLANS).map(([k, p]) => [k, p.amount])), { basico: 5000, pro: 10000, premium: 20000 });
  assert.deepEqual(cfg.PLAN_LABELS, { basico: "Plan Aprendiz", pro: "Plan Técnico", premium: "Plan Premium" });
  assert.equal(cfg.PLANS.basico.label, "Inicial");
  assert.equal(cfg.PLANS.pro.label, "Intermedio");
  assert.equal(cfg.PLANS.premium.label, "Premium");
  assert.equal(cfg.PLANS.basico.questionsPerPeriod, 3);
  assert.equal(cfg.PLANS.pro.questionsPerPeriod, null);
  assert.equal(cfg.PLANS.premium.questionsPerPeriod, null);
  assert.equal(cfg.PLANS.basico.ver_preguntas_otros, false);
  assert.equal(cfg.PLANS.pro.ver_preguntas_otros, false);
  for (const p of Object.values(cfg.PLANS)) assert.equal(p.whatsapp, undefined, "ningún plan incluye WhatsApp");
  assert.equal(cfg.CALLS_WHATSAPP_URL, undefined);
  assert.equal(cfg.PLANS.premium.videollamada, true);
  assert.equal(cfg.PLANS.premium.ver_preguntas_otros, true);
  assert.equal(cfg.PLANS.premium.ebooks_gratis, true);
  assert.equal(cfg.PLANS.premium.biblioteca, true);
  assert.equal(cfg.PLANS.premium.community, true);
  assert.equal(cfg.PLANS.premium.calls, true);
  assert.equal(cfg.PLANS.basico.hotmartCheckoutUrl, "https://pay.hotmart.com/D108538114T");
  assert.equal(cfg.PLANS.pro.hotmartCheckoutUrl, "https://pay.hotmart.com/F108559411V");
  assert.equal(cfg.PLANS.premium.hotmartCheckoutUrl, "https://pay.hotmart.com/W108559868U");
});

test("los botones de suscripción de planes.html y de la portada abren el link de Hotmart de su plan en pestaña nueva", () => {
  const fs = require("node:fs");
  const cfg = require("../assets/fa-config.js");
  const planes = fs.readFileSync(require("node:path").join(__dirname, "..", "planes.html"), "utf8");
  const index = fs.readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  for (const [k, p] of Object.entries(cfg.PLANS)) {
    const a = new RegExp(`<a [^>]*data-plan="${k}"[^>]*href="${p.hotmartCheckoutUrl}"[^>]*target="_blank"[^>]*rel="noopener"`);
    assert.ok(a.test(planes), `planes.html: botón de ${p.name} sin su link de Hotmart`);
    const b = new RegExp(`<a [^>]*href="${p.hotmartCheckoutUrl}" target="_blank" rel="noopener">Suscribirme para preguntar`);
    assert.ok(b.test(index), `index.html: botón de ${p.name} sin su link de Hotmart`);
  }
  assert.ok(!/Plan Profesional/.test(planes + index), "ya no debe quedar el nombre Plan Profesional");
});

test("los textos de los planes coinciden con lo publicado", () => {
  const cfg = require("../assets/fa-config.js");
  assert.equal(cfg.PLANS.basico.tagline, "Ideal para quienes están comenzando en el mundo del aire acondicionado automotriz.");
  assert.deepEqual(cfg.PLANS.basico.benefits, ["3 preguntas mensuales.", "Acceso a tu panel de suscriptor.", "Resolución de dudas técnicas."]);
  assert.equal(cfg.PLANS.pro.tagline, "Ideal para quienes quieren aprender constantemente y resolver todas sus dudas.");
  assert.deepEqual(cfg.PLANS.pro.benefits, ["Preguntas ilimitadas.", "Acceso a tu panel de suscriptor.", "Resolución de consultas técnicas."]);
  assert.equal(cfg.PLANS.premium.tagline, "Para quienes buscan capacitación continua y acompañamiento personalizado.");
  assert.deepEqual(cfg.PLANS.premium.benefits, [
    "Preguntas ilimitadas.",
    "Videollamadas de asesoría.",
    "Acceso a todas las preguntas realizadas por otros usuarios.",
    "Acceso gratuito a todos los ebooks disponibles.",
    "Biblioteca de conocimientos para estudiar y profundizar.",
  ]);
});

test("el código de la Academia se mantiene en el proyecto", () => {
  for (const file of ["academia.html", "ingresar.html", "mi-academia.html", "leccion.html", "certificado.html", "assets/academia.js", "assets/academia-data.js", "assets/academia-nav.js"]) {
    assert.ok(fs.existsSync(path.join(root, file)), `falta ${file}`);
  }
});

test("todas las páginas cargan fa-config, fa-gate y fa-precios", () => {
  for (const f of fs.readdirSync(root).filter((x) => x.endsWith(".html") && x !== "admin.html")) {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    assert.match(html, /assets\/fa-config\.js/, f);
    assert.match(html, /assets\/fa-gate\.js/, f);
    assert.match(html, /assets\/fa-precios\.js/, f);
  }
});

test("Mi cuenta y el panel del equipo existen y no se indexan", () => {
  for (const f of ["mi-cuenta.html", "equipo.html"]) {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    assert.match(html, /name="robots" content="noindex"/);
    assert.match(html, /assets\/fa-auth\.js/);
  }
});

test("Vercel Hobby: máximo 12 funciones en /api", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name.startsWith("_") ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") ? [e.name] : []);
  const n = walk(path.join(root, "api")).length;
  assert.ok(n <= 12, `hay ${n} funciones`);
});

test("no hay claves en el repo (.env.example vacío en secretos)", () => {
  const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "HOTMART_HOTTOK", "HOTMART_PLAN_MAP"]) {
    assert.match(env, new RegExp(`^${k}=$`, "m"), k);
  }
});

test("no queda nada de Flow en el sitio, la API ni la configuración", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if ([".git", "media", "tests", "node_modules", "supabase"].includes(e.name)) return [];
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : /\.(html|js|json|txt|md|example|py|ps1|bat)$/.test(e.name) || e.name === ".env.example" ? [p] : [];
  });
  for (const f of walk(root)) {
    const txt = fs.readFileSync(f, "utf8");
    assert.ok(!/(?<![a-z-])flow(?![a-z-])|FLOW_|flowReady|fa-flow/i.test(txt), `${path.relative(root, f)} menciona Flow`);
  }
  assert.ok(!fs.existsSync(path.join(root, "api", "flow")) && !fs.existsSync(path.join(root, "api", "cron")) && !fs.existsSync(path.join(root, "scripts")));
  assert.ok(!("crons" in JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"))));
});

test("fa-gate.js se ejecuta completo (oculta Academia y deja «Próximamente») sin ReferenceError", () => {
  const vm = require("vm");
  const mk = (attrs, text) => {
    const at = { ...attrs };
    return { _t: text, style: {}, hidden: false, classList: { add() {}, remove() {}, contains: () => false },
      getAttribute: (k) => (k in at ? at[k] : null), hasAttribute: (k) => k in at,
      setAttribute: (k, v) => { at[k] = v; }, removeAttribute: (k) => { delete at[k]; },
      addEventListener() {}, get textContent() { return this._t; }, set textContent(v) { this._t = v; }, at };
  };
  const academia = mk({ href: "academia.html" }, "Academia");
  const soon = mk({ "data-course": "parte-2-profesional" }, "Comprar curso");
  const doc = { readyState: "complete", addEventListener() {}, querySelectorAll: (sel) =>
    sel.startsWith("a[data-course") ? [soon] : sel === "a[href]" ? [academia] : [] };
  const win = { FA_CONFIG: require("../assets/fa-config.js") };
  win.window = win;
  vm.runInNewContext(fs.readFileSync(path.join(root, "assets/fa-gate.js"), "utf8"),
    { window: win, document: doc, location: { pathname: "/cursos.html", replace() {} } });
  assert.equal(academia.hidden, true);
  assert.equal(soon.textContent, "Próximamente");
  assert.equal(soon.at["aria-disabled"], "true");
});
