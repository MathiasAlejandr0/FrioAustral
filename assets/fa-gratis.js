/* Recursos gratis (gratis.html): pinta las tarjetas de los recursos publicados desde el panel del equipo.
   Datos: GET /api/account?action=free-resources (público). La tarjeta fija de YouTube está en el HTML y se mantiene siempre.
   Todas las tarjetas comparten el mismo formato (foto arriba, título, descripción y botón abajo); el CSS está en assets/fa-gratis.css. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.init(root);
})(typeof window !== "undefined" ? window : null, function () {
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; }
  function fmtSize(n) {
    if (n == null || !isFinite(n)) return "";
    return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  }
  function extOf(name) { var m = /\.([a-z0-9]{1,8})$/i.exec(String(name || "")); return m ? m[1].toUpperCase() : ""; }

  function tagOf(r) {
    if (r.kind === "video_externo") return r.youtube ? "Video en YouTube" : "Video";
    var size = fmtSize(r.size);
    if (r.kind === "video_corto") return "Video corto" + (size ? " · " + size : "");
    return [extOf(r.fileName) || "Archivo", size].filter(Boolean).join(" · ");
  }

  function downloadUrl(r) {
    var u = safeUrl(r.fileUrl);
    return u ? u + (u.indexOf("?") === -1 ? "?" : "&") + "download=" + encodeURIComponent(r.fileName || "recurso") : "";
  }

  function ctaOf(r) {
    if (r.kind === "archivo") {
      var d = downloadUrl(r);
      return d ? '<a class="btn btn-red fa-rc-cta" href="' + esc(d) + '" rel="noopener" download="' + esc(r.fileName || "") + '">Descargar</a>' : "";
    }
    if (r.kind === "video_externo") {
      var v = safeUrl(r.videoUrl);
      return v ? '<a class="btn btn-red fa-rc-cta" href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">Ver video <i>↗</i></a>' : "";
    }
    return safeUrl(r.fileUrl) ? '<button type="button" class="btn btn-red fa-rc-cta" data-play aria-pressed="false">Ver video</button>' : "";
  }

  /* Una tarjeta. Mismo formato para todos los tipos. */
  function cardHtml(r) {
    var cover = safeUrl(r.coverUrl);
    var fb = safeUrl(r.coverFallbackUrl);
    var img = cover
      ? '<img src="' + esc(cover) + '" alt="' + esc("Imagen de referencia: " + r.title) + '" loading="lazy" decoding="async"' + (fb ? ' data-fallback="' + esc(fb) + '"' : "") + ">"
      : "";
    var badge = r.kind === "archivo" ? "" : '<span class="fa-rc-badge" aria-hidden="true">▶</span>';
    return '<article class="dl glass reveal fa-rc" data-kind="' + esc(r.kind) + '" data-id="' + esc(r.id) + '"' +
      (r.kind === "video_corto" ? ' data-video="' + esc(safeUrl(r.fileUrl)) + '" data-poster="' + esc(cover) + '"' : "") + ">" +
      '<div class="fa-rc-media">' + img + badge + "</div>" +
      '<div class="fa-rc-body"><span class="fa-rc-tag mono">' + esc(tagOf(r)) + "</span>" +
      "<h4>" + esc(r.title) + "</h4>" +
      "<p>" + esc(r.description) + "</p>" + ctaOf(r) + "</div></article>";
  }

  /* Videos (externos y cortos) arriba, documentos abajo. Una categoría sin recursos no se muestra. */
  function groups(items) {
    var list = Array.isArray(items) ? items : [];
    return {
      videos: list.filter(function (r) { return r.kind === "video_externo" || r.kind === "video_corto"; }),
      docs: list.filter(function (r) { return r.kind === "archivo"; }),
    };
  }
  function render(items) { return (Array.isArray(items) ? items : []).map(cardHtml).join(""); }

  function bindCards(host) {
    Array.prototype.forEach.call(host.querySelectorAll("img[data-fallback]"), function (img) {
      img.addEventListener("error", function () {
        var fb = img.getAttribute("data-fallback");
        if (fb) { img.removeAttribute("data-fallback"); img.src = fb; } else { img.style.visibility = "hidden"; }
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-play]"), function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".fa-rc"), box = card.querySelector(".fa-rc-media");
        var playing = box.querySelector("video");
        if (playing) {
          playing.pause(); playing.remove();
          Array.prototype.forEach.call(box.children, function (c) { c.hidden = false; });
          btn.textContent = "Ver video"; btn.setAttribute("aria-pressed", "false");
          return;
        }
        var v = document.createElement("video");
        v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = "metadata";
        v.setAttribute("playsinline", ""); v.src = card.getAttribute("data-video");
        if (card.getAttribute("data-poster")) v.poster = card.getAttribute("data-poster");
        v.setAttribute("aria-label", "Video: " + (card.querySelector("h4") || {}).textContent);
        Array.prototype.forEach.call(box.children, function (c) { c.hidden = true; });
        box.appendChild(v);
        btn.textContent = "Cerrar video"; btn.setAttribute("aria-pressed", "true");
      });
    });
  }

  function reveal(host) {
    var cards = host.querySelectorAll(".reveal:not(.in)");
    Array.prototype.forEach.call(cards, function (el, i) {
      el.style.transitionDelay = (i % 3) * 80 + "ms";
      (window.requestAnimationFrame || setTimeout)(function () { setTimeout(function () { el.classList.add("in"); }, 30); });
    });
  }

  function init(win) {
    var doc = win.document;
    function go() {
      var vids = doc.getElementById("faFreeVideos"), docsGrid = doc.getElementById("faFreeDocs"), docsSec = doc.getElementById("documentos-gratis");
      if (!vids) return;
      fetch("/api/account?action=free-resources", { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : { items: [] }; })
        .catch(function () { return { items: [] }; })
        .then(function (d) {
          var g = groups(d && d.items);
          vids.insertAdjacentHTML("beforeend", render(g.videos));
          if (docsGrid && docsSec && g.docs.length) { docsGrid.innerHTML = render(g.docs); docsSec.hidden = false; }
          [vids, docsGrid].forEach(function (h) { if (h) { h.setAttribute("aria-busy", "false"); bindCards(h); reveal(h); } });
          if (docsSec && !docsSec.hidden) reveal(docsSec);
        });
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go); else go();
  }

  return { esc: esc, safeUrl: safeUrl, fmtSize: fmtSize, cardHtml: cardHtml, render: render, tagOf: tagOf, groups: groups, init: init };
});
