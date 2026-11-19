const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/* El texto del hero debe empezar en la misma x que el logo del nav en todos los anchos.
   El logo usa el padding lateral de .nav (site.css: 16px; 40px desde 1024px).
   Antes .h-grid tenía un ancho máximo centrado y en Chrome a 1920px el título quedaba ~200px a la derecha. */
const css = (f) => fs.readFileSync(path.join(__dirname, "..", "assets", f), "utf8");

test("hero: .h-grid sin ancho máximo centrado y con el mismo padding lateral que .nav", () => {
  const site = css("site.css"), media = css("media.css");
  assert.match(site, /\.nav\{[^}]*padding:12px 16px/, "nav móvil: padding lateral 16px");
  assert.match(site, /@media \(min-width:1024px\)\{[\s\S]*?\.nav\{padding:16px 40px\}/, "nav escritorio: padding lateral 40px");
  assert.match(media, /section\.hero \.h-grid\{width:auto!important;max-width:none!important;margin-inline:0!important;padding-inline:16px/);
  assert.match(media, /@media\(min-width:1024px\)\{section\.hero \.h-grid\{padding-inline:40px\}\}/);
  // media.css es la última hoja del index, así que esta regla gana sobre fa-app.css/site.css
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const order = [...html.matchAll(/href="assets\/([a-z0-9-]+\.css)"/g)].map((m) => m[1]);
  assert.equal(order[order.length - 1], "media.css");
});
