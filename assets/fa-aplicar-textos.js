/* Aplica en el navegador los textos publicados desde el panel del equipo.
   Pide /api/account?action=site-texts y cambia SOLO los elementos con data-edit que tienen un texto nuevo.
   Si no hay cambio, la respuesta falla o tarda, queda el HTML original (no se oculta nada: sin parpadeo en blanco).
   El texto nuevo es texto plano: se pinta con textContent. La negrita (**así**) y el salto de línea se arman
   con nodos strong y br. Nunca se usa innerHTML. */
(function (root) {
  var MAX = 2000;

  function limpiar(valor) {
    return String(valor == null ? "" : valor).replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  }

  /* Partes seguras: texto o negrita. No interpreta HTML. */
  function partes(valor) {
    var lineas = limpiar(valor).split("\n");
    return lineas.map(function (linea) {
      var out = [], re = /\*\*([^*]+)\*\*/g, last = 0, m;
      while ((m = re.exec(linea))) {
        if (m.index > last) out.push({ t: "texto", v: linea.slice(last, m.index) });
        out.push({ t: "negrita", v: m[1] });
        last = m.index + m[0].length;
      }
      if (last < linea.length) out.push({ t: "texto", v: linea.slice(last) });
      return out;
    });
  }

  function aplicar(el, valor, doc) {
    if (!el) return false;
    var v = limpiar(valor);
    var plano = v.indexOf("\n") === -1 && v.indexOf("**") === -1;
    if (plano) { el.textContent = v; return true; }
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) { el.textContent = v; return true; }
    if (el.replaceChildren) el.replaceChildren();
    else el.textContent = "";
    partes(v).forEach(function (linea, i) {
      if (i) el.appendChild(d.createElement("br"));
      linea.forEach(function (p) {
        if (p.t === "negrita") {
          var s = d.createElement("strong");
          s.textContent = p.v;
          el.appendChild(s);
        } else if (p.v) el.appendChild(d.createTextNode(p.v));
      });
    });
    return true;
  }

  function mapa(items) {
    if (!items || typeof items !== "object" || Array.isArray(items)) return {};
    return items;
  }

  function aplicarTodos(doc, items) {
    var data = mapa(items), tocados = 0;
    if (!doc || !doc.querySelectorAll) return tocados;
    doc.querySelectorAll("[data-edit]").forEach(function (el) {
      var id = el.getAttribute("data-edit");
      var o = id && data[id];
      if (!o || typeof o.body !== "string" || !o.body) return;
      aplicar(el, o.body, doc);
      tocados++;
    });
    return tocados;
  }

  var api = { MAX: MAX, limpiar: limpiar, partes: partes, aplicar: aplicar, aplicarTodos: aplicarTodos };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FA_APLICAR_TEXTOS = api;

  if (typeof document === "undefined" || typeof location === "undefined") return;
  var archivo = (location.pathname.split("/").pop() || "index.html").split("?")[0].toLowerCase() || "index.html";
  if (archivo === "equipo.html") { root.FA_TEXTOS_READY = Promise.resolve({}); return; }

  var listo = fetch("/api/account?action=site-texts", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : { items: {} }; })
    .then(function (d) { return mapa(d && d.items); })
    .catch(function () { return {}; });
  root.FA_TEXTOS_READY = Promise.race([listo, new Promise(function (ok) { setTimeout(function () { ok({}); }, 2500); })]);

  function go() { root.FA_TEXTOS_READY.then(function (items) { aplicarTodos(document, items); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})(typeof window !== "undefined" ? window : globalThis);
