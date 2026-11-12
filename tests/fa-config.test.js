const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const HOTMART = "https://pay.hotmart.com/M101158236T?hotfeature=51&_hi=eyJjaWQiOiIxNzg1MzgyMDM2NDM2Mzg2MzI4NTI3NDY1NzU1NjUwIiwiYmlkIjoiMTc4NTM4MjAzNjQzNjM4NjMyODUyNzQ2NTc1NTY1MCIsInNpZCI6Ijg3Mjg1YTEyOGI4MDRkNDRiNTQ0MmYzYjMwZjRkOGM1In0=.1794072662815";

test("fa-config.js deja la Academia apagada y usa la URL exacta de Hotmart", () => {
  const cfg = require("../assets/fa-config.js");
  assert.equal(cfg.ACADEMIA_ENABLED, false);
  assert.equal(cfg.HOTMART_CHECKOUT_URL, HOTMART);
});

test("precios de la suscripción en un solo lugar", () => {
  const cfg = require("../assets/fa-config.js");
  assert.deepEqual(Object.fromEntries(Object.entries(cfg.PLANS).map(([k, p]) => [k, p.amount])), { basico: 5000, pro: 10000, premium: 20000 });
  assert.deepEqual(cfg.PLAN_LABELS, { basico: "Consulta", pro: "Ilimitado", premium: "Taller Pro" });
});

test("el código de la Academia se mantiene en el proyecto", () => {
  for (const file of ["academia.html", "ingresar.html", "mi-academia.html", "leccion.html", "certificado.html", "assets/academia.js", "assets/academia-data.js", "assets/academia-nav.js"]) {
    assert.ok(fs.existsSync(path.join(root, file)), `falta ${file}`);
  }
});

test("todas las páginas cargan fa-config, fa-gate y fa-flow", () => {
  for (const f of fs.readdirSync(root).filter((x) => x.endsWith(".html") && x !== "admin.html")) {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    assert.match(html, /assets\/fa-config\.js/, f);
    assert.match(html, /assets\/fa-gate\.js/, f);
    assert.match(html, /assets\/fa-flow\.js/, f);
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
  for (const k of ["FLOW_API_KEY", "FLOW_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"]) {
    assert.match(env, new RegExp(`^${k}=$`, "m"), k);
  }
});
