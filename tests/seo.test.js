const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* SEO de frioaustralspa.cl: metadatos, datos estructurados, robots.txt, sitemap.xml, 404 y Analytics.
   Las páginas "públicas" son las que no llevan noindex: el sitemap debe contener exactamente esas. */
const root = path.join(__dirname, "..");
const SITE = "https://frioaustralspa.cl";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
const noindex = (html) => /<meta name="robots" content="[^"]*noindex/i.test(html);
const publicPages = pages.filter((f) => f !== "404.html" && !noindex(read(f)));
const urlOf = (f) => (f === "index.html" ? SITE + "/" : SITE + "/" + f);
const meta = (html, attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"') : null;
};
const title = (html) => (html.match(/<title>([^<]*)<\/title>/) || [])[1];
const jsonld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const graph = (html) => jsonld(html).flatMap((d) => d["@graph"] || [d]);
const types = (html) => graph(html).map((n) => n["@type"]);

function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error("JPEG sin tamaño: " + file);
}

test("hay páginas públicas indexables y las privadas llevan noindex", () => {
  assert.deepEqual(publicPages.sort(), ["comunidad.html", "cursos.html", "gratis.html", "index.html", "taller.html", "tienda.html"]);
  for (const f of ["mi-cuenta.html", "equipo.html", "ingresar.html", "planes.html", "academia.html", "consultas.html", "mi-academia.html", "leccion.html", "certificado.html", "404.html"]) {
    assert.ok(noindex(read(f)), `${f} debe llevar noindex`);
  }
  const vercel = JSON.parse(read("vercel.json"));
  const priv = vercel.headers.find((h) => /mi-cuenta\|equipo/.test(h.source));
  assert.ok(priv.headers.some((h) => h.key === "X-Robots-Tag" && /noindex/.test(h.value)));
});

test("robots.txt permite lo público, bloquea lo privado y apunta al sitemap", () => {
  const txt = read("robots.txt");
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  assert.ok(lines.includes("User-agent: *"));
  assert.ok(lines.includes("Allow: /"));
  assert.ok(!lines.includes("Disallow: /"), "no debe bloquear todo el sitio");
  for (const p of ["/api/", "/mi-cuenta", "/mi-cuenta.html", "/equipo", "/equipo.html", "/admin", "/admin.html", "/contenido", "/contenido.html", "/ingresar", "/ingresar.html"]) {
    assert.ok(lines.includes("Disallow: " + p), "falta Disallow: " + p);
  }
  assert.ok(lines.includes("Sitemap: " + SITE + "/sitemap.xml"));
  for (const f of publicPages) {
    const p = "/" + (f === "index.html" ? "" : f);
    assert.ok(!lines.some((l) => l.startsWith("Disallow: ") && l.length > 10 && p.startsWith(l.slice(10))), `${p} no debe estar bloqueada`);
  }
});

test("sitemap.xml contiene solo las páginas públicas, existentes y sin noindex", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
  assert.equal(entries.length, (xml.match(/<url>/g) || []).length, "todas las <url> tienen loc y lastmod");
  assert.equal(new Set(entries.map((e) => e.loc)).size, entries.length, "sin URLs repetidas");
  for (const e of entries) {
    assert.ok(e.loc.startsWith(SITE + "/"), e.loc);
    assert.match(e.lastmod, /^\d{4}-\d{2}-\d{2}$/);
    const file = e.loc === SITE + "/" ? "index.html" : e.loc.slice(SITE.length + 1);
    assert.ok(fs.existsSync(path.join(root, file)), `${e.loc} no existe como archivo`);
    assert.ok(!noindex(read(file)), `${e.loc} es noindex`);
    assert.equal(meta(read(file), "property", "og:url"), e.loc);
  }
  assert.deepEqual(entries.map((e) => e.loc).sort(), publicPages.map(urlOf).sort());
});

test("cada página pública tiene title, description, canonical, Open Graph, Twitter, un h1 y lang es", () => {
  const titles = new Set(), descs = new Set();
  for (const f of publicPages) {
    const html = read(f);
    const t = title(html), d = meta(html, "name", "description");
    assert.match(html, /<html lang="es(-[A-Z]{2})?">/, f);
    assert.ok(t && t.length >= 50 && t.length <= 60, `${f}: title de ${t && t.length} caracteres`);
    assert.ok(d && d.length >= 140 && d.length <= 160, `${f}: description de ${d && d.length} caracteres`);
    assert.ok(!titles.has(t) && !descs.has(d), `${f}: title o description repetidos`);
    titles.add(t); descs.add(d);
    assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1, f);
    assert.equal((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1], urlOf(f), `${f}: canonical`);
    assert.equal(meta(html, "property", "og:title"), t);
    assert.equal(meta(html, "property", "og:description"), d);
    assert.equal(meta(html, "property", "og:url"), urlOf(f));
    assert.equal(meta(html, "property", "og:type"), "website");
    assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
    assert.equal(meta(html, "name", "twitter:title"), t);
    assert.equal(meta(html, "name", "twitter:description"), d);
    const img = meta(html, "property", "og:image");
    assert.ok(img && img.startsWith(SITE + "/media/img/") && img.endsWith(".jpg"), `${f}: og:image absoluta`);
    assert.equal(meta(html, "name", "twitter:image"), img);
    assert.ok(meta(html, "property", "og:image:alt") && meta(html, "name", "twitter:image:alt"), `${f}: alt de la imagen social`);
    const size = jpegSize(path.join(root, img.slice(SITE.length + 1)));
    assert.deepEqual(size, { w: 1200, h: 630 }, `${f}: tamaño de la imagen social`);
    assert.equal(meta(html, "property", "og:image:width"), "1200");
    assert.equal(meta(html, "property", "og:image:height"), "630");
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${f}: debe tener un solo h1`);
  }
});

test("la jerarquía de encabezados no salta niveles (aria-level conserva el estilo)", () => {
  for (const f of publicPages) {
    let prev = 0;
    for (const m of read(f).matchAll(/<h([1-6])([^>]*)>/g)) {
      const lvl = Number((m[2].match(/aria-level="(\d)"/) || [])[1] || m[1]);
      assert.ok(lvl <= prev + 1, `${f}: salto de h${prev} a h${lvl}`);
      prev = lvl;
    }
  }
});

test("las imágenes tienen alt, tamaño y carga diferida salvo las de la parte alta", () => {
  const decorativas = { "index.html": 1, "gratis.html": 1 };
  for (const f of publicPages) {
    const html = read(f);
    const cierreHeader = html.indexOf("</header>");
    let sinAlt = 0;
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      assert.ok(/\salt="/.test(tag), `${f}: img sin alt: ${tag.slice(0, 80)}`);
      if (/\salt=""/.test(tag)) sinAlt++;
      assert.ok(/\swidth="\d+"/.test(tag) && /\sheight="\d+"/.test(tag), `${f}: img sin width/height: ${tag.slice(0, 80)}`);
      const arriba = m.index < cierreHeader || /fetchpriority="high"/.test(tag);
      if (!arriba) assert.ok(/loading="lazy"/.test(tag), `${f}: img bajo el pliegue sin loading=lazy: ${tag.slice(0, 80)}`);
    }
    assert.ok(sinAlt <= (decorativas[f] || 0), `${f}: ${sinAlt} imágenes decorativas con alt vacío`);
  }
});

test("el video del inicio no compite con la imagen principal", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="preload" as="image"[^>]*i1-hero-poster[^>]*fetchpriority="high"/, "preload del poster (LCP)");
  const video = html.match(/<video class="hero-vid"[^>]*>/)[0];
  assert.match(video, /preload="none"/);
  assert.doesNotMatch(video, /\ssrc=|autoplay/);
  assert.doesNotMatch(video, /<source/);
});

test("las páginas con foto de cabecera precargan exactamente la imagen que usa el CSS", () => {
  const css = read("assets/media.css");
  for (const [f, p] of [["cursos.html", "c1"], ["gratis.html", "g1"], ["comunidad.html", "m1"], ["taller.html", "t1"]]) {
    const html = read(f);
    const pre = [...html.matchAll(/<link rel="preload" as="image"[^>]*href="media\/img\/(\w1-phead-[^"]+)\.webp"/g)].map((m) => m[1]);
    assert.ok(pre.length >= 1, f);
    for (const name of pre) assert.ok(css.includes(`media/img/${name}.webp`), `${f}: ${name} no lo usa media.css`);
    assert.ok(pre.every((n) => n.startsWith(p + "-phead-")), f);
    assert.ok(pre.every((n) => fs.existsSync(path.join(root, "media/img", n + ".webp"))), f);
  }
});

test("datos estructurados: JSON-LD parseable y coherente con el sitio", () => {
  for (const f of publicPages) {
    const docs = jsonld(read(f));
    assert.ok(docs.length >= 1, `${f}: sin JSON-LD`);
    for (const d of docs) assert.equal(d["@context"], "https://schema.org");
    assert.ok(!/hotmart/i.test(JSON.stringify(docs)), `${f}: JSON-LD no nombra el procesador de pagos`);
  }
  const idx = graph(read("index.html"));
  assert.deepEqual(types(read("index.html")).sort(), ["AutoRepair", "Organization", "WebSite"]);
  const taller = graph(read("taller.html")).find((n) => n["@type"] === "AutoRepair");
  const tallerHtml = read("taller.html");
  assert.equal(taller.address.streetAddress, "Augusto Goecke 296");
  assert.equal(taller.address.addressLocality, "Puerto Montt");
  assert.equal(taller.telephone, "+56987785601");
  assert.ok(tallerHtml.includes("Augusto Goecke 296") && tallerHtml.includes("+56 9 8778 5601") && tallerHtml.includes("Lunes a Viernes · 9:00 – 18:00"));
  assert.ok(tallerHtml.includes(`query=${taller.geo.latitude},${taller.geo.longitude}`), "coordenadas del mapa de la página");
  const spec = taller.openingHoursSpecification[0];
  assert.deepEqual([spec.opens, spec.closes, spec.dayOfWeek.length], ["09:00", "18:00", 5]);
  assert.equal(idx.find((n) => n["@type"] === "AutoRepair")["@id"], taller["@id"]);
});

test("Course, FAQPage y BreadcrumbList de cursos.html coinciden con lo que se ve en la página", () => {
  const html = read("cursos.html");
  const g = graph(html);
  const courses = g.filter((n) => n["@type"] === "Course");
  assert.equal(courses.length, 2);
  const principal = courses[0];
  assert.ok(html.includes(principal.name));
  assert.ok(html.includes(courses[1].name));
  const precio = Number((html.match(/<p class="fa-hprice">[\s\S]*?<b>\$([\d.]+)<\/b>/) || [])[1].replace(/\./g, ""));
  assert.equal(Number(principal.offers.price), precio, "el precio del JSON-LD es el que se ve");
  assert.equal(principal.offers.priceCurrency, "CLP");
  assert.equal(courses[1].offers, undefined, "la Parte 2 no muestra precio: no se inventa");
  const faq = g.find((n) => n["@type"] === "FAQPage");
  const visibles = [...html.slice(html.indexOf('id="cp-faq"')).matchAll(/<details><summary>([^<]+)<\/summary><p>([^<]+)<\/p><\/details>/g)].map((m) => [m[1], m[2]]);
  assert.ok(visibles.length >= 5);
  assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), visibles);
  const bc = g.find((n) => n["@type"] === "BreadcrumbList");
  assert.deepEqual(bc.itemListElement.map((i) => i.item), [SITE + "/", SITE + "/cursos.html"]);
  for (const f of ["index.html", "taller.html"]) assert.ok(!types(read(f)).includes("FAQPage"), "FAQPage solo donde hay FAQ visible");
});

test("404.html: noindex, rutas absolutas, botones a Inicio, Cursos y WhatsApp, sin efectos de vidrio", () => {
  const html = read("404.html");
  assert.match(html, /<html lang="es-CL">/);
  assert.match(html, /<base href="\/">/, "con <base> los recursos cargan aunque la URL del error sea /a/b/c");
  assert.ok(noindex(html));
  assert.match(html, /<h1[^>]*>No encontramos/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<a class="btn btn-red" href="index\.html">Ir al inicio<\/a>/);
  assert.match(html, /<a class="btn btn-line" href="cursos\.html">Ver cursos<\/a>/);
  assert.match(html, /<a class="btn btn-wa" href="https:\/\/wa\.me\/56987785601[^"]*"[^>]*>WhatsApp \+56 9 8778 5601<\/a>/);
  assert.doesNotMatch(html, /\sclass="[^"]*\bglass\b/);
  assert.doesNotMatch(html, /canonical/);
  assert.match(html, /fa-analytics\.js/);
  assert.match(html, /assets\/site\.css/);
});

test("Analytics: con ID vacío no carga nada; con ID carga gtag.js async con anonymize_ip", () => {
  const src = read("assets/fa-analytics.js");
  assert.equal((src.match(/MEASUREMENT_ID = "/g) || []).length, 1, "el ID vive en una sola constante");
  assert.match(src, /var MEASUREMENT_ID = "(G-[A-Z0-9]+)?";/);

  function run(code) {
    const appended = [], listeners = [];
    const win = { dataLayer: undefined };
    const document = {
      head: { appendChild: (el) => appended.push(el) },
      createElement: () => ({}),
      addEventListener: (t, f) => listeners.push([t, f]),
    };
    const ctx = vm.createContext({ window: win, document, location: { pathname: "/cursos.html" }, encodeURIComponent, Object, Date });
    vm.runInContext(code, ctx);
    return { appended, listeners, win };
  }
  const vacio = run(src.replace(/var MEASUREMENT_ID = "[^"]*";/, 'var MEASUREMENT_ID = "";'));
  assert.equal(vacio.appended.length, 0);
  assert.equal(vacio.listeners.length, 0);
  assert.equal(vacio.win.dataLayer, undefined);
  assert.equal(vacio.win.gtag, undefined);
  const invalido = run(src.replace(/var MEASUREMENT_ID = "[^"]*";/, 'var MEASUREMENT_ID = "UA-123";'));
  assert.equal(invalido.appended.length, 0);

  const activo = run(src.replace(/var MEASUREMENT_ID = "[^"]*";/, 'var MEASUREMENT_ID = "G-TEST123456";'));
  assert.equal(activo.appended.length, 1);
  assert.equal(activo.appended[0].async, true);
  assert.equal(activo.appended[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST123456");
  const cmds = activo.win.dataLayer.map((a) => Array.from(a));
  assert.equal(cmds[0][0], "js");
  assert.equal(JSON.stringify(cmds[1]), JSON.stringify(["config", "G-TEST123456", { anonymize_ip: true }]));
  assert.equal(activo.listeners.map((l) => l[0]).join(), "click");
  /* clic en WhatsApp y en comprar curso */
  const click = activo.listeners[0][1];
  const link = (href, text, attrs = {}) => ({ closest: () => ({ getAttribute: (k) => (k === "href" ? href : attrs[k] || null), hasAttribute: (k) => k in attrs, textContent: text }) });
  click({ target: link("https://wa.me/56987785601?text=Hola", "WhatsApp taller") });
  click({ target: link("https://pay.example/x", "Comprar curso →", { "data-course": "aire-acondicionado-automotriz" }) });
  click({ target: link("cursos.html", "Ver cursos") });
  const ev = activo.win.dataLayer.map((a) => Array.from(a)).filter((a) => a[0] === "event");
  assert.equal(ev.map((e) => e[1]).join(), "whatsapp_click,comprar_curso_click");
  assert.equal(ev[1][2].course, "aire-acondicionado-automotriz");
});

test("Analytics se incluye en las páginas públicas y no en el panel ni en Mi cuenta", () => {
  for (const f of [...publicPages, "planes.html", "404.html"]) assert.match(read(f), /<script src="assets\/fa-analytics\.js" defer><\/script>/, f);
  for (const f of ["mi-cuenta.html", "equipo.html"]) assert.doesNotMatch(read(f), /fa-analytics/, f);
});

test("la CSP no restringe scripts: no hace falta autorizar los dominios de Analytics", () => {
  const vercel = JSON.parse(read("vercel.json"));
  for (const h of vercel.headers) for (const x of h.headers) {
    if (x.key === "Content-Security-Policy") assert.doesNotMatch(x.value, /script-src|connect-src|img-src|default-src/, "si se agrega script-src, sumar googletagmanager.com, google-analytics.com y *.analytics.google.com");
  }
});
