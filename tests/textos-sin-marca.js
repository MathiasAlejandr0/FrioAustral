#!/usr/bin/env node
/* Lista textos visibles que no tienen data-edit.
   Sale con código 0 si no queda ninguno en las páginas del panel.
   Excepciones (no son un error): ver FUERA y los data-edit-no (precio, estado).
   Uso: node tests/textos-sin-marca.js
        node tests/textos-sin-marca.js --marcar   (escribe data-edit y assets/fa-textos.js) */
"use strict";
const fs = require("fs");
const path = require("path");
const H = require("./lib-html-textos");

const root = path.join(__dirname, "..");
const marcar = process.argv.includes("--marcar");

function leer(f) { return fs.readFileSync(path.join(root, f), "utf8"); }

if (marcar) {
  const pags = H.PAGINAS.map(([file, page]) => ({ file, page, html: leer(file) }));
  const { textos, edits } = H.asignar(pags);
  const porArchivo = new Map();
  for (const e of edits) {
    if (!porArchivo.has(e.file)) porArchivo.set(e.file, []);
    porArchivo.get(e.file).push(e);
  }
  for (const [file, page] of H.PAGINAS) {
    let html = H.aplicarEdits(leer(file), porArchivo.get(file) || []);
    if (!html.includes("assets/fa-aplicar-textos.js")) {
      if (html.includes('src="assets/fa-medios.js"></script>')) {
        html = html.replace('src="assets/fa-medios.js"></script>', 'src="assets/fa-medios.js"></script><script src="assets/fa-aplicar-textos.js"></script>');
      } else {
        html = html.replace("</head>", '<script src="assets/fa-aplicar-textos.js"></script>\n</head>');
      }
    }
    fs.writeFileSync(path.join(root, file), html);
    process.stdout.write(file + " marcado (" + page + ")\n");
  }
  const SL = require("../assets/fa-slots.js");
  const fotos = {};
  for (const s of SL.SLOTS) {
    fotos[s.id] = {};
    for (const pg of pags) {
      let pos = -1;
      for (const b of s.bases || []) {
        const i = pg.html.indexOf("media/img/" + b + "-");
        if (i >= 0 && (pos < 0 || i < pos)) pos = i;
      }
      if (s.video) {
        const i = pg.html.indexOf('data-media="' + s.video + '"');
        if (i >= 0 && (pos < 0 || i < pos)) pos = i;
      }
      if (s.css) {
        const i = pg.html.indexOf(s.css.slice(1));
        if (i >= 0 && (pos < 0 || i < pos)) pos = i;
      }
      if (pos >= 0) fotos[s.id][pg.page] = pos;
    }
  }
  const cuerpo = textos.map((t) => "    " + JSON.stringify({
    id: t.id, grupo: t.grupo, seccion: t.seccion, etiqueta: t.etiqueta, texto: t.texto, max: t.max, paginas: t.paginas, orden: t.orden, pos: t.pos,
  })).join(",\n");
  const js = `/* Catálogo de textos visibles que el equipo puede cambiar desde el panel (equipo.html).
   El texto de cada fila es el original del HTML: si no hay un cambio publicado, el sitio muestra ese HTML.
   Lo generan tests/textos-sin-marca.js --marcar y lo usan el panel y /api. El navegador público no lo descarga:
   aplica solo los cambios (assets/fa-aplicar-textos.js) y, si no hay, deja el HTML. */
(function (root) {
  const TEXTOS = [
${cuerpo}
  ];
  const FOTOS = ${JSON.stringify(fotos)};
  const byId = (id) => TEXTOS.find((t) => t.id === id) || null;
  const de = (pagina) => TEXTOS.filter((t) => t.paginas.includes(pagina)).sort((a, b) => (a.pos[pagina] || 0) - (b.pos[pagina] || 0));
  const api = { TEXTOS, FOTOS, byId, de };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FA_TEXTOS = api;
})(typeof window !== "undefined" ? window : globalThis);
`;
  fs.writeFileSync(path.join(root, "assets/fa-textos.js"), js);
  const por = {};
  for (const [file, page] of H.PAGINAS) por[page] = textos.filter((t) => t.paginas.includes(page)).length;
  process.stdout.write("textos únicos: " + textos.length + "\n" + JSON.stringify(por) + "\n");
}

let mal = 0;
for (const [file, page] of H.PAGINAS) {
  const faltan = H.sinMarca(leer(file));
  if (faltan.length) {
    mal += faltan.length;
    process.stdout.write("\n" + file + " (" + page + ") sin data-edit: " + faltan.length + "\n");
    for (const t of faltan.slice(0, 30)) process.stdout.write("  · " + t + "\n");
  } else process.stdout.write(file + ": 0\n");
}
process.stdout.write("\nExcepciones (no se marcan):\n");
for (const [f, why] of H.FUERA) process.stdout.write("  · " + f + " — " + why + "\n");
process.stdout.write("  · Precios y cupos con data-fa-price / data-fa-quota (assets/fa-config.js) y el texto data-edit-no=\"precio\".\n");
process.stdout.write("  · Estado abierto/cerrado (.st-t en [data-open] y [data-horario]): lo escribe assets/site.js. data-edit-no=\"estado\".\n");
process.stdout.write("  · El enlace «Mi cuenta» lo inserta assets/fa-gate.js; no está en el HTML.\n");
process.stdout.write("  · Los títulos de recursos gratis los carga assets/fa-gratis.js desde el panel (no son texto fijo).\n");
process.stdout.write("  · alt y aria-label de íconos: no son párrafos. El texto alternativo de una foto cambiada se edita en su tarjeta.\n");
process.stdout.write("  · Flechas, asteriscos y triángulos decorativos (→ ▶ ✳): no son un párrafo.\n");
process.exit(mal ? 1 : 0);
