/* Recorre el HTML del sitio (sin dependencias) para marcar y listar textos visibles.
   Un texto está cubierto si él o un ancestro tiene data-edit.
   Excepciones explícitas: data-edit-no, data-fa-price, data-fa-quota, data-horario
   y el estado abierto/cerrado (.st-t dentro de [data-open]), que pisa assets/site.js. */
"use strict";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template"]);
const DANGER = new Set(["svg", "img", "video", "iframe", "input", "textarea", "select", "canvas", "picture", "source", "object", "audio", "form"]);

function decode(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function norm(s) {
  return decode(s).replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function parse(html) {
  const root = { type: "el", tag: "#root", attr: "", children: [], parent: null, start: 0, end: html.length };
  const stack = [root];
  let i = 0;
  while (i < html.length) {
    const parent = stack[stack.length - 1];
    if (html.startsWith("<!--", i)) {
      const j = html.indexOf("-->", i + 4);
      i = j === -1 ? html.length : j + 3;
      continue;
    }
    if (html[i] === "<") {
      const close = html[i + 1] === "/";
      const m = /^<\s*(\/?)\s*([a-zA-Z][\w:-]*)([^>]*?)(\/?)\s*>/.exec(html.slice(i));
      if (!m) { i++; continue; }
      const tag = m[2].toLowerCase();
      const raw = m[0];
      if (close) {
        for (let s = stack.length - 1; s > 0; s--) {
          if (stack[s].tag === tag) {
            stack[s].innerEnd = i;
            stack[s].end = i + raw.length;
            stack.splice(s);
            break;
          }
        }
        i += raw.length;
        continue;
      }
      const el = { type: "el", tag, attr: m[3] || "", children: [], parent, start: i, openEnd: i + raw.length, self: m[4] === "/" || VOID.has(tag) };
      parent.children.push(el);
      i += raw.length;
      if (tag === "script" || tag === "style") {
        const re = new RegExp(`</${tag}\\s*>`, "i");
        const c = re.exec(html.slice(i));
        const end = c ? i + c.index + c[0].length : html.length;
        el.innerEnd = c ? i + c.index : html.length;
        el.end = end;
        el.self = true;
        i = end;
        continue;
      }
      if (!el.self) stack.push(el);
      else el.end = el.openEnd;
      continue;
    }
    const j = html.indexOf("<", i);
    const end = j === -1 ? html.length : j;
    parent.children.push({ type: "text", text: html.slice(i, end), start: i, end, parent });
    i = end;
  }
  return root;
}

function attrHas(el, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`).test(el.attr || "");
}
function classHas(el, name) {
  const m = /class\s*=\s*"([^"]*)"/.exec(el.attr || "");
  return m ? m[1].split(/\s+/).includes(name) : false;
}
function attrVal(el, name) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`).exec(el.attr || "");
  return m ? decode(m[1]) : "";
}

function ancestor(el, pred) {
  for (let p = el; p; p = p.parent) if (pred(p)) return p;
  return null;
}

const SOLO_ICONO = /^[\s→▶◀✳↗↘·.•\-\u2013\u2014]+$/;

function excluded(el) {
  if (!el || el.type !== "el") return false;
  if (attrHas(el, "data-edit-no") || attrHas(el, "data-fa-price") || attrHas(el, "data-fa-quota") || attrHas(el, "data-horario")) return true;
  if (classHas(el, "st-t") && ancestor(el, (p) => p.type === "el" && attrHas(p, "data-open"))) return true;
  return false;
}

function esIcono(texto) { return SOLO_ICONO.test(texto); }

function skipTag(el) {
  return el.type === "el" && SKIP.has(el.tag);
}

function isGlue(el, parent) {
  if (!el || el.type !== "el") return false;
  if (el.tag === "br" || el.tag === "wbr") return true;
  if (el.tag === "span" && (classHas(el, "ice-text") || classHas(el, "hot-text") || classHas(el, "btn-arr"))) return true;
  if (["em", "i", "s"].includes(el.tag)) return true;
  if (["b", "strong", "small"].includes(el.tag)) {
    return parent && ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "td", "th", "summary", "label", "figcaption"].includes(parent.tag);
  }
  return false;
}

function childDanger(el) {
  if (!el || el.type !== "el") return false;
  if (DANGER.has(el.tag) || el.tag === "a" || el.tag === "button") return true;
  if (excluded(el)) return true;
  for (const c of el.children) if (c.type === "el" && childDanger(c)) return true;
  return false;
}

function descendantsDanger(el) {
  for (const c of el.children || []) if (c.type === "el" && childDanger(c)) return true;
  return false;
}

function textOf(el) {
  let out = "";
  for (const c of el.children || []) {
    if (c.type === "text") out += c.text;
    else if (c.tag === "br") out += "\n";
    else if (excluded(c) || skipTag(c)) continue;
    else out += textOf(c);
  }
  return norm(out);
}

function atomic(el) {
  if (el.type !== "el" || el.self || skipTag(el) || excluded(el)) return false;
  if (el.tag === "#root" || el.tag === "html" || el.tag === "body" || el.tag === "head" || el.tag === "main") return false;
  if (descendantsDanger(el)) return false;
  for (const c of el.children) {
    if (c.type === "el" && !isGlue(c, el) && !excluded(c) && !skipTag(c) && c.tag !== "br") return false;
  }
  return textOf(el).length > 0;
}

const ETIQUETA = { h1: "Título", h2: "Título", h3: "Subtítulo", h4: "Subtítulo", h5: "Subtítulo", h6: "Subtítulo", p: "Párrafo", li: "Ítem de lista", a: "Enlace o botón", button: "Botón", summary: "Pregunta", td: "Celda", th: "Encabezado", label: "Etiqueta", figcaption: "Pie de foto", blockquote: "Cita" };

function etiqueta(tag) { return ETIQUETA[tag] || "Texto"; }

function maxDe(tag, len) {
  const base = { h1: 180, h2: 220, h3: 200, h4: 180, a: 140, button: 140, summary: 300, li: 400, p: 900, td: 240, th: 160 }[tag] || 280;
  return Math.min(2000, Math.max(base, len + 60));
}

const PAGINAS = [
  ["index.html", "inicio"],
  ["cursos.html", "cursos"],
  ["gratis.html", "gratis"],
  ["taller.html", "taller"],
  ["comunidad.html", "comunidad"],
  ["planes.html", "suscripcion"],
  ["tienda.html", "tienda"],
];

const SEC_ID = {
  top: ["portada", "Portada"],
  modalidades: ["modalidades", "Dos modalidades"],
  cursos: ["cursos", "Cursos"],
  suscripciones: ["suscripcion", "Suscripción"],
  taller: ["taller", "Taller"],
  equipo: ["equipo", "Nuestro equipo"],
  ubicacion: ["ubicacion", "Cómo llegar"],
  ebooks: ["ebooks", "Ebooks"],
  "videos-gratis": ["videos", "Videos gratis"],
  "documentos-gratis": ["documentos", "Documentos gratis"],
};

function slug(s) {
  return decode(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "seccion";
}

function headingsIn(root) {
  const out = [];
  (function walk(el) {
    if (!el || el.type !== "el" || skipTag(el)) return;
    if (/^h[1-3]$/.test(el.tag)) out.push(el);
    for (const c of el.children) walk(c);
  })(root);
  return out;
}

function tituloCorto(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim().replace(/[.:]+$/, "");
  return t.length > 52 ? t.slice(0, 49).replace(/\s+\S*$/, "") + "…" : t;
}

function sectionOf(el, page, headings) {
  const nav = ancestor(el, (p) => p.tag === "header" && classHas(p, "nav"));
  const drawer = ancestor(el, (p) => p.tag === "div" && classHas(p, "drawer"));
  if (nav || drawer) return { grupo: "menu", clave: "menu", titulo: "Menú", prefix: "comun" };
  if (ancestor(el, (p) => classHas(p, "mbar"))) return { grupo: "barra", clave: "barra", titulo: "Barra inferior", prefix: "comun" };
  if (ancestor(el, (p) => p.tag === "footer")) return { grupo: "pie", clave: "pie", titulo: "Pie de página", prefix: "comun" };
  if (ancestor(el, (p) => classHas(p, "ticker"))) return { grupo: "pagina", clave: "cinta", titulo: "Cinta de especialidades", prefix: page };
  let h = el.type === "el" && /^h[1-3]$/.test(el.tag) ? el : ancestor(el, (p) => /^h[1-3]$/.test(p.tag));
  if (!h && headings) {
    for (const cand of headings) if (cand.start <= el.start) h = cand;
  }
  if (h) {
    const crudo = textOf(h).replace(/\s+/g, " ").trim();
    const sec = ancestor(h, (p) => p.tag === "section");
    const id = sec && attrVal(sec, "id");
    if (h.tag === "h1" && (id === "top" || (sec && classHas(sec, "phead")))) return { grupo: "pagina", clave: "portada", titulo: "Portada", prefix: page };
    if (sec && (classHas(sec, "v5-cta") || classHas(sec, "fa-cta-media"))) return { grupo: "pagina", clave: "cierre", titulo: "Cierre", prefix: page };
    const clave = slug(crudo).slice(0, 18) || "seccion";
    return { grupo: "pagina", clave, titulo: tituloCorto(crudo) || "Sección", prefix: page };
  }
  const sec = ancestor(el, (p) => p.tag === "section");
  if (sec) {
    const id = attrVal(sec, "id");
    if (SEC_ID[id]) return { grupo: "pagina", clave: SEC_ID[id][0], titulo: SEC_ID[id][1], prefix: page };
    if (classHas(sec, "phead")) return { grupo: "pagina", clave: "portada", titulo: "Portada", prefix: page };
    if (classHas(sec, "v5-cta") || classHas(sec, "fa-cta-media")) return { grupo: "pagina", clave: "cierre", titulo: "Cierre", prefix: page };
  }
  return { grupo: "pagina", clave: "cuerpo", titulo: "Página", prefix: page };
}

function collect(root) {
  const units = [];
  const wraps = [];
  function walk(el) {
    if (el.type !== "el") return;
    if (skipTag(el)) return;
    if (excluded(el)) { el.excluded = true; return; }
    if (atomic(el)) {
      if (!esIcono(textOf(el))) { el.unit = true; units.push(el); }
      return;
    }
    for (const c of el.children) {
      if (c.type === "el") walk(c);
    }
    for (const c of el.children) {
      if (c.type === "text" && norm(c.text) && !esIcono(norm(c.text))) wraps.push(c);
    }
  }
  const body = (function find(el) {
    if (el.tag === "body") return el;
    for (const c of el.children || []) if (c.type === "el") { const b = find(c); if (b) return b; }
    return null;
  })(root);
  if (body) walk(body);
  return { units, wraps };
}

function hrefOf(el) {
  return attrVal(el, "href") || (el.parent && el.parent.type === "el" ? hrefOf(el.parent) : "");
}

const GRUPO_BASE = { menu: 0, pagina: 1000, pie: 800000, barra: 900000 };

function asignar(paginasHtml) {
  /* paginasHtml: [{ file, page, html }] en orden canónico (inicio primero). */
  const shared = new Map();
  const counters = {};
  const textos = [];
  const edits = [];
  function take(prefix, clave) {
    const k = prefix + "." + clave;
    counters[k] = (counters[k] || 0) + 1;
    return `${prefix}.${clave}.${counters[k]}`;
  }
  for (const pg of paginasHtml) {
    const root = parse(pg.html);
    const headings = headingsIn(root);
    const { units, wraps } = collect(root);
    const visto = new Map();
    const nodes = [
      ...units.map((el) => ({ kind: "el", el, texto: textOf(el) })),
      ...wraps.map((tx) => ({ kind: "tx", el: tx, texto: norm(tx.text) })),
    ].sort((a, b) => a.el.start - b.el.start);
    const localN = {};
    for (const node of nodes) {
      const nodo = node.el.type === "text" ? node.el.parent : node.el;
      const sec = sectionOf(nodo, pg.page, headings);
      if (sec.prefix !== "comun" && sec.clave !== "cinta") {
        const k = sec.clave;
        const prev = visto.get(k);
        if (prev && prev !== sec.titulo) {
          let n = 2;
          while (visto.get(sec.clave + n) && visto.get(sec.clave + n) !== sec.titulo) n++;
          sec.clave = (sec.clave + n).slice(0, 18);
        }
        visto.set(sec.clave, sec.titulo);
      }
      const region = sec.prefix === "comun" ? sec.clave : "";
      let id;
      if (region) {
        const sig = region + "|" + node.texto + "|" + (node.el.type === "el" ? hrefOf(node.el) : hrefOf(node.el.parent));
        if (!shared.has(sig)) shared.set(sig, take(sec.prefix, sec.clave));
        id = shared.get(sig);
      } else if (sec.clave === "cinta") {
        const sig = pg.page + "|cinta|" + node.texto;
        if (!shared.has(sig)) shared.set(sig, take(pg.page, "cinta"));
        id = shared.get(sig);
      } else {
        id = take(sec.prefix, sec.clave);
      }
      const tag = node.kind === "el" ? node.el.tag : "span";
      const ya = textos.find((t) => t.id === id);
      const repetido = ya && ya.pos && ya.pos[pg.page] != null;
      if (!repetido) {
        const ordenKey = sec.grupo + ":" + sec.clave;
        localN[ordenKey] = (localN[ordenKey] || 0) + 1;
        const orden = GRUPO_BASE[sec.grupo] + localN[ordenKey];
        if (ya) {
          if (!ya.paginas.includes(pg.page)) ya.paginas.push(pg.page);
          ya.orden[pg.page] = orden;
          ya.pos[pg.page] = node.el.start;
        } else {
          textos.push({
            id, grupo: sec.grupo, clave: sec.clave, seccion: sec.titulo, etiqueta: etiqueta(tag),
            texto: node.texto, max: maxDe(tag, node.texto.length),
            paginas: [pg.page], orden: { [pg.page]: orden }, pos: { [pg.page]: node.el.start }, tag,
          });
        }
      }
      edits.push({ file: pg.file, kind: node.kind, start: node.el.start, end: node.el.end, openEnd: node.el.openEnd, id });
    }
    /* marcas de excepción, para que el listado quede en cero */
    (function walkEx(el) {
      if (!el || el.type !== "el") return;
      if (skipTag(el)) return;
      const no = attrHas(el, "data-fa-price") || attrHas(el, "data-fa-quota") ? "precio"
        : attrHas(el, "data-horario") || (classHas(el, "st-t") && ancestor(el, (p) => attrHas(p, "data-open"))) ? "estado" : "";
      if (no && !attrHas(el, "data-edit-no")) edits.push({ file: pg.file, kind: "no", start: el.start, openEnd: el.openEnd, id: no });
      for (const c of el.children) walkEx(c);
    })(root);
  }
  return { textos, edits };
}

function aplicarEdits(html, edits) {
  const list = edits.slice().sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of list) {
    if (e.kind === "el") {
      const head = out.slice(e.start, e.openEnd);
      if (/data-edit\s*=/.test(head)) continue;
      const gt = head.lastIndexOf(">");
      out = out.slice(0, e.start) + head.slice(0, gt) + ` data-edit="${e.id}"` + head.slice(gt) + out.slice(e.openEnd);
    } else if (e.kind === "tx") {
      const slice = out.slice(e.start, e.end);
      if (!norm(slice)) continue;
      out = out.slice(0, e.start) + `<span data-edit="${e.id}">` + slice + `</span>` + out.slice(e.end);
    } else if (e.kind === "no") {
      const head = out.slice(e.start, e.openEnd);
      if (/data-edit-no\s*=/.test(head)) continue;
      const gt = head.lastIndexOf(">");
      out = out.slice(0, e.start) + head.slice(0, gt) + ` data-edit-no="${e.id}"` + head.slice(gt) + out.slice(e.openEnd);
    }
  }
  return out;
}

function sinMarca(html) {
  const root = parse(html);
  const out = [];
  function covered(el) {
    return !!ancestor(el, (p) => p.type === "el" && (attrHas(p, "data-edit") || attrHas(p, "data-edit-no") || excluded(p)));
  }
  function walk(el) {
    if (el.type === "text") {
      const t = norm(el.text);
      if (!t || esIcono(t)) return;
      if (ancestor(el, (p) => p.type === "el" && (skipTag(p) || p.tag === "head"))) return;
      if (covered(el)) return;
      out.push(t.slice(0, 140));
      return;
    }
    if (skipTag(el)) return;
    for (const c of el.children || []) walk(c);
  }
  const body = (function find(el) {
    if (el.tag === "body") return el;
    for (const c of el.children || []) if (c.type === "el") { const b = find(c); if (b) return b; }
    return null;
  })(root);
  if (body) walk(body);
  return out;
}

/* Páginas que el listado no exige marcar, y por qué. */
const FUERA = [
  ["mi-cuenta.html", "Panel del suscriptor (pedido aparte: no se toca)."],
  ["equipo.html", "Panel del equipo: no es una página pública del sitio."],
  ["ingresar.html", "Ingreso a la academia (apagada); no está en Páginas del sitio."],
  ["academia.html", "Academia apagada: redirige a Cursos."],
  ["mi-academia.html", "Campus del suscriptor, no el sitio público."],
  ["leccion.html", "Campus del suscriptor, no el sitio público."],
  ["certificado.html", "Campus del suscriptor, no el sitio público."],
  ["consultas.html", "Preguntas del suscriptor, no el sitio público."],
  ["404.html", "Página de error. No está en el mapa del panel."],
];

module.exports = {
  parse, decode, norm, textOf, collect, asignar, aplicarEdits, sinMarca, PAGINAS, FUERA, ETIQUETA,
};
