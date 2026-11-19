const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/* El sitio no nombra al procesador de pagos: solo se permiten los links de pago (pay.hotmart.com/...),
   los nombres internos (hotmartCheckoutUrl, clases CSS, variables) y los comentarios. */
const root = path.join(__dirname, "..");
const PAGO_URL = /https:\/\/pay\.hotmart\.com\/[A-Za-z0-9]+(?:\?[^"'\s)]*)?/g;

const htmlFiles = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
const jsFiles = fs.readdirSync(path.join(root, "assets")).filter((f) => f.endsWith(".js")).map((f) => path.join("assets", f));
const cssFiles = fs.readdirSync(path.join(root, "assets")).filter((f) => f.endsWith(".css")).map((f) => path.join("assets", f));

function visibleHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(PAGO_URL, "")
    .replace(/\s(?:class|id|data-[\w-]+)="[^"]*"/g, "");
}

function jsStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
    .replace(PAGO_URL, "")
    .replace(/hotmartCheckoutUrl|HOTMART_[A-Z_]+|\/api\/hotmart\/\w+/g, "");
}

test("ninguna página pública nombra al procesador de pagos (texto, atributos, meta, title, alt, aria)", () => {
  assert.ok(htmlFiles.length >= 15);
  for (const f of htmlFiles) {
    const t = visibleHtml(fs.readFileSync(path.join(root, f), "utf8"));
    assert.ok(!/hotmart/i.test(t), f + " muestra «Hotmart»: " + (t.match(/.{0,60}hotmart.{0,60}/i) || [""])[0]);
  }
});

test("el JS del navegador no muestra «Hotmart» en mensajes, botones ni plantillas", () => {
  for (const f of jsFiles) {
    const t = jsStrings(fs.readFileSync(path.join(root, f), "utf8"));
    assert.ok(!/hotmart/i.test(t), f + " muestra «Hotmart»: " + (t.match(/.{0,60}hotmart.{0,60}/i) || [""])[0]);
  }
});

test("el CSS no inyecta «Hotmart» con content:", () => {
  for (const f of cssFiles) {
    const css = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of css.matchAll(/content\s*:\s*([^;}]*)/g)) assert.ok(!/hotmart/i.test(m[1]), f + ": " + m[0]);
  }
});

test("el botón del hero dice «Comprar curso» y conserva el link de pago", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const botones = [...index.matchAll(/<a [^>]*data-course="aire-acondicionado-automotriz"[^>]*>([^<]*(?:<i>[^<]*<\/i>)?)<\/a>/g)];
  assert.ok(botones.length >= 2);
  for (const b of botones) {
    assert.match(b[0], /href="https:\/\/pay\.hotmart\.com\/M101158236T"/);
    assert.match(b[1].trim(), /^Comprar curso/);
  }
  assert.ok(!/Comprar en/i.test(index));
});
