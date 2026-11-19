/* Panel del equipo · mapa visual de una página del sitio.
   Carga la página real en un iframe del mismo origen (escalado, sin clics), mide dónde está cada foto o video editable con
   getBoundingClientRect y dibuja encima, en una capa del panel, un marco celeste con un número. El número va FUERA de la foto.
   También muestra cómo quedaría una foto nueva, en computador y en celular, sin subir nada. */
(function () {
  const FAP = window.FAP, { $, $$, esc } = FAP, M = window.FA_PANEL_MAPA, SL = window.FA_SLOTS;
  const W = { pc: 1280, cel: 390 }, VH = { pc: 800, cel: 844 }, GUT = 34;
  const CSS = (vh) => `*,*::before,*::after{animation:none!important;transition:none!important}.reveal,.reveal *{opacity:1!important;transform:none!important}.mbar,.drawer,.fa-cookie{display:none!important}html body .hero,html body section.hero{min-height:${vh}px!important}html{scroll-behavior:auto!important}`;

  function findEls(doc, slot) {
    const out = [];
    (slot.bases || []).forEach((b) => {
      $$(`img[src*="media/img/${b}-"],img[srcset*="media/img/${b}-"],img[data-fa-orig*="media/img/${b}-"],video[poster*="media/img/${b}-"],video[data-fa-poster]`, doc).forEach((e) => {
        if (e.tagName === "VIDEO" && e.hasAttribute("data-fa-poster") && !(e.getAttribute("poster") || "").includes("media/img/" + b + "-") && !(slot.id === "cursos-video-poster")) return;
        out.push(e);
      });
    });
    $$(`[data-fap-id="${slot.id}"]`, doc).forEach((e) => out.push(e));
    if (slot.video) $$(`video[data-media="${slot.video}"]`, doc).forEach((e) => out.push(e));
    if (slot.css) $$(slot.css, doc).forEach((e) => out.push(e));
    return out;
  }
  const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 20 ? r : null; };

  function mount(host, o) {
    const pg = o.pagina, ids = pg.ids;
    let mode = o.mode || "pc", scale = 1, H = VH[mode], alive = true, ifr = null, on = o.only || null, restore = [], ro = null, loaded = false, timer = null;
    host.classList.add("fap-map");
    host.innerHTML = `<div class="view" tabindex="0" role="region" aria-label="Vista de la página ${esc(pg.nombre)} con las zonas que se pueden cambiar"><div class="stage"><div class="layer"></div></div></div><div class="nomk" hidden></div><p class="fap-help" data-note aria-live="polite">Cargando la página…</p>`;
    const view = $(".view", host), stage = $(".stage", host), layer = $(".layer", host), nomk = $(".nomk", host), note = $("[data-note]", host);

    function size() {
      const avail = Math.max(240, view.clientWidth - GUT);
      scale = Math.min(1, avail / W[mode]);
      stage.style.width = GUT + W[mode] * scale + "px"; stage.style.height = H * scale + "px";
      if (ifr) { ifr.style.cssText = `left:${GUT}px;max-width:none;width:${W[mode]}px;height:${H}px;transform:scale(${scale});transform-origin:0 0`; }
    }
    function pill(id, n, x, y, cls) {
      const z = M.por(id), b = document.createElement("button");
      b.type = "button"; b.className = "pill fap-num fap-mk" + (cls || ""); b.textContent = n;
      b.setAttribute("aria-label", `Zona ${n}: ${z.nombre}`); b.title = z.nombre;
      b.style.left = x + "px"; b.style.top = y + "px"; b.onclick = () => o.onPick && o.onPick(id);
      return b;
    }
    function draw() {
      if (!alive || !ifr || !ifr.contentDocument) return;
      const doc = ifr.contentDocument; H = Math.max(VH[mode], doc.documentElement.scrollHeight); size();
      layer.innerHTML = ""; nomk.innerHTML = ""; nomk.hidden = true;
      const all = $$("img,video", doc).map(seen).filter(Boolean).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }));
      const hit = (x, y, w, h, own) => all.some((a) => x < a.r && x + w > a.l && y < a.b && y + h > a.t && !(a.l === own.l && a.t === own.t && a.r === own.r));
      const hidden = [], placed = [], gut = []; let found = 0;
      ids.forEach((id, i) => {
        if (o.only && id !== o.only) return;
        const slot = SL.bySlot(id), el = findEls(doc, slot).map((e) => [e, seen(e)]).find((p) => p[1]);
        if (!el) { hidden.push([id, i + 1]); return; }
        found++;
        const r = el[1], pad = 3, mk = document.createElement("div");
        mk.className = "mk" + (id === on ? " on" : ""); mk.dataset.z = id;
        mk.style.cssText = `left:${GUT + (r.left - pad) * scale}px;top:${(r.top - pad) * scale}px;width:${(r.width + pad * 2) * scale}px;height:${(r.height + pad * 2) * scale}px`;
        layer.appendChild(mk);
        /* el número va fuera de la foto y sin tapar otra: arriba, abajo o en el margen izquierdo */
        const S = 28, own = { l: r.left, t: r.top, r: r.right, b: r.bottom }, sz = S / scale;
        const free = (x, y) => x >= 0 && y >= 0 && !hit(x, y, sz, sz, own) && !placed.some((q) => x < q.x + sz && x + sz > q.x && y < q.y + sz && y + sz > q.y);
        let pos = null;
        for (const base of [[r.left, r.top - pad - sz], [r.left, r.bottom + pad]]) {
          for (let k = 0; k < 8 && !pos; k++) { const c = [base[0] + k * (sz + 4 / scale), base[1]]; if (free(c[0], c[1])) pos = c; }
          if (pos) break;
        }
        if (pos) placed.push({ x: pos[0], y: pos[1] });
        let gy = r.top * scale; if (!pos) { while (gut.some((y) => Math.abs(y - gy) < 30)) gy += 30; gut.push(gy); }
        const px = pos ? GUT + pos[0] * scale : 3, py = pos ? pos[1] * scale : gy;
        const p = pill(id, i + 1, px, py); p.style.position = "absolute"; layer.appendChild(p);
      });
      if (hidden.length) {
        nomk.hidden = false;
        nomk.innerHTML = `<span>${found ? "Zonas que no se ven en esta vista:" : "No pudimos mostrar la página real. Estas son sus zonas:"}</span>`;
        hidden.forEach(([id, n]) => nomk.appendChild(pill(id, n, 0, 0, " static")));
        $$(".static", nomk).forEach((b) => { b.style.position = "static"; });
      }
      note.textContent = found ? "Cada número es una foto o video que puedes cambiar." : "No se pudo cargar la vista de la página; usa la lista de la derecha.";
      if (!found) schema();
      if (on) highlight(on, true);
    }
    function schema() {
      layer.innerHTML = ""; stage.style.height = "auto"; stage.style.width = "100%"; if (ifr) ifr.remove(); ifr = null;
      layer.className = "layer fap-schema"; layer.style.position = "static";
      layer.innerHTML = pg.secciones.map((s) => `<div>${esc(s.titulo)}${s.ids.length ? " · " + s.ids.map((id) => `<button type="button" class="fap-num fap-mk" data-s="${esc(id)}" aria-label="Zona ${ids.indexOf(id) + 1}: ${esc(M.por(id).nombre)}">${ids.indexOf(id) + 1}</button>`).join(" ") : ""}</div>`).join("");
      $$("[data-s]", layer).forEach((b) => (b.onclick = () => o.onPick && o.onPick(b.dataset.s)));
      note.textContent = "Esquema simple de la página: no pudimos mostrar la página real.";
    }
    function highlight(id, noPick) {
      on = id; $$(".mk", layer).forEach((m) => m.classList.toggle("on", m.dataset.z === id));
      const m = $(`.mk[data-z="${id}"]`, layer);
      if (m) view.scrollTop = Math.max(0, m.offsetTop - 50);
    }
    function load() {
      loaded = false; if (ifr) ifr.remove(); restore = [];
      ifr = document.createElement("iframe"); ifr.title = "Vista de " + pg.nombre; ifr.setAttribute("aria-hidden", "true"); ifr.tabIndex = -1;
      stage.insertBefore(ifr, layer); size();
      note.textContent = "Cargando la página…";
      const fin = async () => {
        if (!alive || loaded || !ifr) return; loaded = true;
        try {
          const w = ifr.contentWindow, doc = ifr.contentDocument, st = doc.createElement("style");
          st.textContent = CSS(VH[mode]); doc.head.appendChild(st);
          $$("img[loading=lazy]", doc).forEach((i) => { i.loading = "eager"; });
          await Promise.race([Promise.resolve(w.FA_MEDIA_READY).catch(() => 0), new Promise((r) => setTimeout(r, 3000))]);
          await Promise.race([Promise.all($$("img", doc).map((i) => (i.complete ? 0 : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); })))), new Promise((r) => setTimeout(r, 3500))]);
          draw();
          if (w.ResizeObserver) { let t = null; ro = new w.ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 150); }); ro.observe(doc.documentElement); }
          host.dispatchEvent(new CustomEvent("fap-ready"));
        } catch (e) { console.debug("[mapa]", e); schema(); }
      };
      ifr.addEventListener("load", fin);
      timer = setTimeout(() => { if (!loaded) { loaded = true; schema(); } }, 12000);
      ifr.src = pg.href;
    }

    /* Cómo quedaría una foto nueva: cambia temporalmente el archivo de esa zona dentro de la página cargada. */
    function undo() { restore.forEach((f) => f()); restore = []; const s = ifr && ifr.contentDocument && $("#fap-prev", ifr.contentDocument); if (s) s.remove(); }
    function preview(id, url, kind) {
      if (!ifr || !ifr.contentDocument) return;
      undo();
      if (!url) { draw(); return; }
      const doc = ifr.contentDocument, slot = SL.bySlot(id);
      findEls(doc, slot).forEach((e) => {
        e.dataset.fapId = id; restore.push(() => { delete e.dataset.fapId; });
        if (e.tagName === "IMG") {
          const pic = e.parentElement && e.parentElement.tagName === "PICTURE" ? e.parentElement : null;
          const o = { src: e.getAttribute("src"), srcset: e.getAttribute("srcset"), sizes: e.getAttribute("sizes") }, srcs = pic ? $$("source", pic) : [];
          srcs.forEach((s) => s.remove()); e.removeAttribute("srcset"); e.removeAttribute("sizes"); e.src = url; e.addEventListener("load", draw, { once: true });
          restore.push(() => { if (o.srcset) e.setAttribute("srcset", o.srcset); if (o.sizes) e.setAttribute("sizes", o.sizes); e.setAttribute("src", o.src); srcs.forEach((s) => pic.insertBefore(s, e)); });
        } else if (e.tagName === "VIDEO") {
          const o = { poster: e.getAttribute("poster"), src: e.currentSrc };
          if (kind === "video") { e.pause(); $$("source", e).forEach((s) => { s.dataset.fapSrc = s.src; s.removeAttribute("src"); }); e.src = url; e.muted = true; e.load(); restore.push(() => { e.removeAttribute("src"); $$("source", e).forEach((s) => { s.src = s.dataset.fapSrc; }); e.load(); }); }
          else { e.setAttribute("poster", url); restore.push(() => { if (o.poster) e.setAttribute("poster", o.poster); }); }
        }
      });
      if (slot.css) { const s = doc.createElement("style"); s.id = "fap-prev"; s.textContent = `${slot.css}{background-image:url("${url}")!important}`; doc.head.appendChild(s); }
      setTimeout(draw, 250);
    }
    function setMode(m) { mode = m; H = VH[m]; if (ro) { try { ro.disconnect(); } catch (e) { /* nada */ } ro = null; } layer.className = "layer"; layer.style.position = ""; load(); }
    function destroy() { alive = false; clearTimeout(timer); if (ro) try { ro.disconnect(); } catch (e) { /* nada */ } host.innerHTML = ""; }
    const onResize = () => { if (alive && ifr) draw(); };
    window.addEventListener("resize", onResize);
    load();
    return { highlight, setMode, preview, destroy: () => { window.removeEventListener("resize", onResize); destroy(); }, get mode() { return mode; }, draw };
  }
  FAP.vista = { mount };
})();
