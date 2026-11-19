/* Panel del equipo · «Páginas del sitio»: una página a la vez, con su mapa y sus fotos y videos (tarjetas iguales).
   Cambiar foto en 3 pasos (Elegir · Revisar · Publicar), «Volver a la original» y «Volver a la versión anterior». */
(function () {
  const FAP = window.FAP, { $, $$, esc, ico } = FAP, M = window.FA_PANEL_MAPA, SL = window.FA_SLOTS;
  const MB = 1048576, err = (e) => e.friendly || FAP.friendly(e);
  const extOf = (n) => ((/\.([a-z0-9]{1,8})$/i.exec(String(n || "")) || [])[1] || "").toLowerCase();
  const num = (n) => Number(n).toLocaleString("es-CL");

  /* ---------- lista de páginas (celular y atajo) ---------- */
  const cambiosDe = (slug) => ((FAP.cache.media && FAP.cache.media.items) || []).filter((x) => x.custom && M.por(x.id) && M.por(x.id).pagina === slug).length;
  function lista(main) {
    main.innerHTML = `<div class="fap-view"><p class="fap-help">Elige la página del sitio que quieres cambiar. Verás sus fotos y videos, y dónde se ve cada uno.</p><div class="fap-pages" id="pgL">${M.PAGINAS.map((p) => `<a class="fap-card fap-pg" href="#/paginas/${p.slug}"><span class="fap-kick">Página</span><span class="big">${esc(p.nombre)}</span><span class="fap-help">${p.ids.length ? p.ids.length + (p.ids.length === 1 ? " foto o video" : " fotos y videos") : "Recursos gratis"}${p.slug === "gratis" ? " y archivos" : ""}</span><span class="fap-chip info" data-c="${p.slug}" hidden></span></a>`).join("")}</div></div>`;
    FAP.get("media").then(() => { $$("[data-c]", main).forEach((c) => { const n = cambiosDe(c.dataset.c); if (n) { c.hidden = false; c.textContent = `${n} ${n === 1 ? "cambio" : "cambios"}`; } }); }).catch(() => {});
  }

  /* ---------- tarjeta de una foto o video ---------- */
  const origUrl = (z) => "media/img/" + z.thumb;
  const vidOrig = (z) => `media/video/${z.video}-720.mp4`;
  function thumb(z, it) {
    const c = it && it.custom, v = c ? (c.url + (c.url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(c.updatedAt || "")) : null;
    if (z.video && SL.bySlot(z.id).kind === "video") return `<video src="${esc(v || vidOrig(z))}" poster="${esc(origUrl(z))}" controls muted preload="metadata" playsinline style="object-position:${z.pos}" aria-label="Video: ${esc(z.nombre)}"></video>`;
    return `<img src="${esc(v || origUrl(z))}" alt="" loading="lazy" style="object-position:${z.pos}">`;
  }
  function card(z, n, it) {
    const c = it && it.custom, esVideo = SL.bySlot(z.id).kind === "video";
    const kick = z.galeria ? `Galería · foto ${z.galeria} de 6` : z.seccion;
    return `<article class="fap-card fap-slot" id="z-${esc(z.id)}" data-z="${esc(z.id)}">
      <div class="fap-thumb">${thumb(z, it)}</div>
      <div class="body"><div class="k"><span class="fap-num" aria-label="Zona ${n}">${n}</span><span class="fap-kick">${esc(kick)}</span></div>
        <h3>${esc(z.nombre)}</h3><p class="donde">Se ve en: ${esc(z.donde)}.</p>
        <div class="tb">${z.tambien ? `<span>${esc(z.tambien)}</span>` : ""}${c && c.hasPrevious ? `<button type="button" class="fap-btn text sm" data-prev="${esc(z.id)}">Volver a la versión anterior</button>` : ""}</div>
        <div class="st"><span class="fap-chip ${c ? "info" : ""}">${c ? "Cambiada el " + esc(FAP.fechaCorta(c.updatedAt)) : "Original del sitio"}</span>${esVideo ? "" : `<button type="button" class="fap-btn text sm" data-full="${esc(z.id)}">Ver completa</button>`}</div>
        <div class="btns"><button type="button" class="fap-btn" data-cambiar="${esc(z.id)}">${esVideo ? "Cambiar video" : "Cambiar foto"}</button>
          <div class="two"><button type="button" class="fap-btn sec sm" data-mapa="${esc(z.id)}">Ver en el mapa</button>${c ? `<button type="button" class="fap-btn danger sm" data-reset="${esc(z.id)}">Volver a la original</button>` : "<span></span>"}</div></div>
      </div></article>`;
  }

  /* ---------- vista de una página ---------- */
  async function pagina(main, slug) {
    const pg = M.pagina(slug);
    if (!pg) { FAP.go("#/paginas"); return; }
    FAP.setTitle(pg.nombre);
    let alive = true, map = null, mode = "pc", items = null;
    const desktop = matchMedia("(min-width:1100px)").matches;
    main.innerHTML = `<div class="fap-page"><div class="fap-head"><nav class="fap-pgtabs" aria-label="Páginas del sitio">${M.PAGINAS.map((p) => `<a href="#/paginas/${p.slug}" ${p.slug === slug ? 'aria-current="page"' : ""}>${esc(p.nombre)}</a>`).join("")}</nav><a class="fap-btn sec sm" href="${esc(pg.href)}" target="_blank" rel="noopener">Ver esta página en el sitio ${ico("ext")}</a></div>
      <div class="fap-cols"><div class="fap-mapcol"><section class="fap-card fap-mapcard"><details id="pMapD" ${desktop ? "open" : ""}><summary>${ico("map")}&nbsp;Ver mapa de la página</summary>
        <div class="tools" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px"><span class="fap-kick" style="align-self:center">Mapa de la página</span><div class="fap-tabs chips" role="group" aria-label="Cómo se ve la página"><button type="button" data-m="pc" aria-pressed="true">Computador</button><button type="button" data-m="cel" aria-pressed="false">Celular</button></div></div><div id="pMap"></div></details></section></div>
        <div class="fap-secs" id="pSecs"><div class="fap-skel" style="height:260px"></div></div></div></div>`;
    const secs = $("#pSecs", main), det = $("#pMapD", main);
    const mountMap = () => { if (map || !alive || !det.open) return; map = FAP.vista.mount($("#pMap", main), { pagina: pg, mode, onPick: pick }); };
    det.addEventListener("toggle", mountMap);
    $$("[data-m]", main).forEach((b) => (b.onclick = () => { mode = b.dataset.m; $$("[data-m]", main).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (map) map.setMode(mode); else mountMap(); }));
    function pick(id) {
      const c = $("#z-" + id, main); if (!c) return;
      c.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
      c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 2000);
    }
    const byId = () => Object.fromEntries((items || []).map((i) => [i.id, i]));
    function paint() {
      const by = byId();
      secs.innerHTML = pg.secciones.map((s) => {
        const head = `<header><span class="fap-kick">${esc(s.recursos ? "Archivos de esta página" : "Sección")}</span><h2>${esc(s.titulo)}</h2>${s.texto ? `<p class="fap-help">${esc(s.texto)}</p>` : ""}</header>`;
        if (s.recursos) return `<section class="fap-sec" data-rec="${s.recursos}">${head}<div class="fap-rbox"></div></section>`;
        return `<section class="fap-sec">${head}<div class="fap-slots">${s.ids.map((id) => card(M.por(id), pg.ids.indexOf(id) + 1, by[id])).join("")}</div></section>`;
      }).join("");
      $$("[data-cambiar]", secs).forEach((b) => (b.onclick = () => cambiar(b.dataset.cambiar, b)));
      $$("[data-reset]", secs).forEach((b) => (b.onclick = () => volver(b.dataset.reset, b)));
      $$("[data-prev]", secs).forEach((b) => (b.onclick = () => anterior(b.dataset.prev, b)));
      $$("[data-full]", secs).forEach((b) => (b.onclick = () => completa(b.dataset.full, b)));
      $$("[data-mapa]", secs).forEach((b) => (b.onclick = () => { det.open = true; mountMap(); if (map) map.highlight(b.dataset.mapa); $(".fap-mapcard", main).scrollIntoView({ block: "nearest" }); }));
      $$("[data-rec]", secs).forEach((h) => FAP.gratis.seccion($(".fap-rbox", h), h.dataset.rec, pg));
      FAP.repaintNav();
    }
    async function load(force) {
      secs.innerHTML = `<div class="fap-skel" style="height:260px"></div>`;
      try { items = (await FAP.get("media", force)).items; if (alive) { paint(); mountMap(); } }
      catch (e) { if (!alive || e.handled) return; secs.innerHTML = `<div class="fap-card"><p><b>No se pudieron cargar las fotos y videos.</b></p><p class="fap-help">${esc(err(e))}</p><p style="margin-top:12px"><button type="button" class="fap-btn" id="pRe">Reintentar</button></p></div>`; $("#pRe", secs).onclick = () => load(true); }
    }
    async function recargar(focusId) { FAP.drop("media", "summary"); await load(true); if (focusId) { const b = $(`#z-${focusId} [data-cambiar]`, main); if (b) b.focus(); } }

    function completa(id) {
      const z = M.por(id), it = byId()[id], c = it && it.custom;
      const d = FAP.dialog({ title: z.nombre, cls: "fap-view-full" });
      d.body.innerHTML = `<img src="${esc(c ? c.url : origUrl(z))}" alt="${esc(z.nombre)}">`;
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cerrar</button>`;
      $("[data-c]", d.foot).onclick = () => d.close(null); d.focus("[data-c]");
    }
    async function volver(id) {
      const z = M.por(id), it = byId()[id], c = it && it.custom;
      const r = await FAP.confirmar({ titulo: "¿Volver a la foto original?", cuerpo: `<div class="fap-ba"><figure><div class="fap-thumb"><img src="${esc(c.url)}" alt="" style="object-position:${z.pos}"></div><figcaption class="fap-help">La que se ve ahora</figcaption></figure><figure><div class="fap-thumb"><img src="${esc(origUrl(z))}" alt="" style="object-position:${z.pos}"></div><figcaption class="fap-help">La original del sitio</figcaption></figure></div><p><b>${esc(z.nombre)}</b></p><p>Volverá la foto original del sitio. La foto que subiste se eliminará y no se puede recuperar.</p>`, ok: "Volver a la original", peligro: true });
      if (r !== "ok") return;
      try { await FAP.api("media-reset", { body: { slot: id } }); FAP.aviso("Volvió la foto original del sitio.", "ok"); await recargar(id); }
      catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
    }
    async function anterior(id) {
      const z = M.por(id);
      const r = await FAP.confirmar({ titulo: "¿Volver a la versión anterior?", cuerpo: `<p><b>${esc(z.nombre)}</b></p><p>Volverá la foto que tenías antes de este último cambio. La que se ve ahora se eliminará y no se puede recuperar.</p>`, ok: "Volver a la versión anterior", peligro: true });
      if (r !== "ok") return;
      try { await FAP.api("media-restore-previous", { body: { slot: id } }); FAP.aviso("Volvió la versión anterior.", "ok"); await recargar(id); }
      catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
    }

    /* ---------- cambiar foto o video: 1 Elegir · 2 Revisar · 3 Publicar ---------- */
    function cambiar(id) {
      const z = M.por(id), slot = SL.bySlot(id), vid = slot.kind === "video", lim = SL.LIMITS[slot.kind], it = byId()[id], cur = it && it.custom;
      const S = { prep: null, url: null, alt: "", ack: false, up: false, ctl: null }, noun = vid ? "video" : "foto";
      const d = FAP.dialog({ title: vid ? "Cambiar video" : "Cambiar foto", side: true, cls: "sheet" });
      const labels = ["Elegir", "Revisar", "Publicar"], maps = [];
      d.veto = () => (S.up ? false : (S.url && URL.revokeObjectURL(S.url), maps.forEach((m) => m.destroy()), true));
      const head = () => `<div class="fap-sum"><div class="fap-thumb">${thumb(z, it)}</div><div><span class="fap-kick">${esc(pg.nombre)} › ${esc(z.seccion)}</span><h3>${esc(z.nombre)}</h3><p class="fap-help">Se ve en: ${esc(z.donde)}.</p></div></div>`;
      const foot = (html) => { d.foot.innerHTML = html; };
      function paso1(msg) {
        d.setSteps(labels, 0); d.title(vid ? "Cambiar video" : "Cambiar foto");
        d.body.innerHTML = head() + FAP.zoneHtml({ titulo: vid ? "Arrastra el video aquí o toca para elegirlo" : "Arrastra la foto aquí o toca para elegirla", boton: vid ? "Elegir video" : "Elegir foto", accept: vid ? ".mp4,.webm,video/mp4,video/webm" : ".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif",
          ayuda: vid ? `MP4 o WebM. Hasta 50 MB. ${z.aviso || ""}` : `${z.forma}, de al menos 1600 píxeles de ancho. Formatos: JPG, PNG, WebP o AVIF. Hasta 12 MB.${z.aviso ? " " + z.aviso : ""}` }) + `<p class="fap-err" id="cErr" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
        foot(`<button type="button" class="fap-btn sec" data-c>Cancelar</button>`);
        $("[data-c]", d.foot).onclick = () => d.close(null);
        FAP.zone(d.body, { onFile: elegido });
        d.focus("[data-pick]");
      }
      async function elegido(f) {
        const er = $("#cErr", d.body); er.hidden = true;
        const t = lim.types[String(f.type).toLowerCase()], e = extOf(f.name);
        if (!t || !(e === t || (t === "jpg" && e === "jpeg"))) { er.hidden = false; er.textContent = FAP.friendly({ code: "bad_type" }, { what: vid ? "un video MP4 o WebM" : "una foto JPG, PNG, WebP o AVIF" }); return; }
        if (f.size > lim.maxBytes) { er.hidden = false; er.textContent = vid ? "Pesa más de 50 MB. Comprímelo antes de subirlo." : FAP.friendly({ code: "too_big" }, { max: 12 }); return; }
        if (!f.size) { er.hidden = false; er.textContent = FAP.friendly({ code: "bad_size" }); return; }
        d.body.innerHTML = `<p class="fap-help" role="status">${vid ? "Preparando el video…" : "Preparando la foto…"}</p><div class="fap-prog ind"><i></i></div>`;
        S.prep = vid ? { file: f, converted: false, from: f.size, to: f.size, w: 0, h: 0 } : await FAP.aWebp(f);
        if (S.url) URL.revokeObjectURL(S.url);
        S.url = URL.createObjectURL(S.prep.file);
        paso2();
      }
      function avisos() {
        const p = S.prep, o = [];
        if (!vid && p.w && p.w < 1600 && !/Panorámica|3:1/.test(z.forma) || (!vid && p.w && p.w < 1600 && /Panorámica/.test(z.forma))) o.push(`La foto es más pequeña de lo recomendado (${num(p.w)} px): podría verse borrosa.`);
        if (!vid && p.w) {
          const apaisada = p.w >= p.h, quiereV = /^Vertical|Casi cuadrada/.test(z.forma);
          if (apaisada && /^Vertical/.test(z.forma)) o.push("La foto es horizontal y aquí se espera vertical: se recortará.");
          else if (!apaisada && !quiereV) o.push("La foto es vertical y aquí se espera horizontal: se recortará.");
        }
        if (p.converted) o.push(p.from > 1.5 * MB ? `Pesaba ${FAP.fsize(p.from)}: la achicamos sin que se note. Pasó de ${FAP.fsize(p.from)} a ${FAP.fsize(p.to)}.` : `Pasó de ${FAP.fsize(p.from)} a ${FAP.fsize(p.to)}.`);
        if (vid) o.push("Se reproduce sin sonido al abrir la página.");
        return o.map((t) => `<div class="fap-strip info"><p>${esc(t)}</p></div>`).join("");
      }
      function paso2(msg) {
        maps.forEach((m) => m.destroy()); maps.length = 0;
        d.setSteps(labels, 1); d.title("Revisa cómo queda");
        d.body.innerHTML = `<div class="fap-ba"><figure><div class="fap-thumb">${thumb(z, it)}</div><figcaption class="fap-help">Antes</figcaption></figure><figure><div class="fap-thumb">${vid ? `<video src="${esc(S.url)}" controls muted playsinline preload="metadata"></video>` : `<img src="${esc(S.url)}" alt="" style="object-position:${z.pos}">`}</div><figcaption class="fap-help">Después</figcaption></figure></div>
          ${avisos()}
          <div class="fap-previews"><div><p class="fap-lbl">Así se verá en computador</p><div data-pv="pc"></div></div><div><p class="fap-lbl">Así se verá en celular</p><div data-pv="cel"></div></div></div>
          ${vid ? "" : `<div class="fap-field"><label for="cAlt">Describe la foto para personas que no pueden verla (opcional)</label><input id="cAlt" name="alt" maxlength="300" value="${esc(S.alt)}" placeholder="Ejemplo: Técnico conectando los manómetros al auto"></div>`}
          ${z.personas ? `<div class="fap-field" id="cAckF"><label class="fap-check"><input type="checkbox" id="cAck" ${S.ack ? "checked" : ""} aria-describedby="cAckE"> Revisé que la cara de la persona se ve completa y que ningún texto o botón la tapa</label><p class="fap-err" id="cAckE" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p></div>` : ""}`;
        foot(`<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn" data-n>Continuar</button>`);
        $$("[data-pv]", d.body).forEach((h) => { const m = FAP.vista.mount(h, { pagina: pg, mode: h.dataset.pv, only: id }); maps.push(m); h.addEventListener("fap-ready", () => m.preview(id, S.url, vid ? "video" : "image")); });
        $("[data-b]", d.foot).onclick = () => { S.alt = ($("#cAlt", d.body) || {}).value || ""; paso1(); };
        $("[data-n]", d.foot).onclick = () => {
          S.alt = ($("#cAlt", d.body) || {}).value || "";
          if (z.personas) { const a = $("#cAck", d.body); S.ack = a.checked; if (!a.checked) { const e = $("#cAckE", d.body); e.hidden = false; e.textContent = "Marca la casilla cuando hayas revisado la cara de la persona en la vista previa."; a.focus(); return; } }
          paso3();
        };
        d.focus("[data-n]");
      }
      function paso3(msg) {
        maps.forEach((m) => m.destroy()); maps.length = 0;
        d.setSteps(labels, 2); d.title("Publicar");
        d.body.innerHTML = `<div class="fap-card"><div class="fap-sum"><div class="fap-thumb">${vid ? `<video src="${esc(S.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(S.url)}" alt="" style="object-position:${z.pos}">`}</div><div><span class="fap-kick">${esc(pg.nombre)} › ${esc(z.seccion)}</span><h3>${esc(z.nombre)}</h3><p>Se verá en el sitio en menos de 1 minuto.</p><p class="fap-help">Podrás volver a la original cuando quieras.</p></div></div></div>
          <div id="cUp" hidden><p id="cUpT" role="status"></p><div class="fap-prog" id="cBar" role="progressbar" aria-label="Avance de la subida" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
          <p class="fap-err" id="cErr3" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
        foot(`<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-p>Publicar en el sitio</button>`);
        $("[data-b]", d.foot).onclick = () => paso2();
        $("[data-c]", d.foot).onclick = () => { URL.revokeObjectURL(S.url); d.close(null); };
        $("[data-p]", d.foot).onclick = publicar;
        d.focus("[data-p]");
      }
      async function publicar() {
        const f = S.prep.file, bar = $("#cBar", d.body), box = $("#cUp", d.body), txt = $("#cUpT", d.body), er = $("#cErr3", d.body);
        er.hidden = true; S.up = true; S.ctl = new AbortController();
        box.hidden = false; bar.classList.add("ind"); txt.textContent = `Subiendo ${f.name} (${FAP.fsize(f.size)})… No cierres esta pantalla.`;
        foot(`<button type="button" class="fap-btn sec" data-x>Cancelar subida</button>`);
        $("[data-x]", d.foot).onclick = () => S.ctl.abort();
        try {
          const ctx = { max: vid ? 50 : 12, what: vid ? "un video MP4 o WebM" : "una foto JPG, PNG, WebP o AVIF" };
          const up = await FAP.api("media-upload-url", { body: { slot: id, fileName: f.name, contentType: f.type, size: f.size }, ctx });
          await FAP.subir(up, f, { signal: S.ctl.signal, onProgress: (p) => { bar.classList.remove("ind"); const v = Math.round(p * 100); $("i", bar).style.width = v + "%"; bar.setAttribute("aria-valuenow", v); txt.textContent = `Subiendo ${f.name} (${FAP.fsize(f.size)})… ${v} %. No cierres esta pantalla.`; } });
          txt.textContent = "Publicando…"; bar.classList.add("ind");
          await FAP.api("media-save", { body: { slot: id, path: up.path, fileName: f.name, contentType: up.contentType, size: f.size, alt: vid ? "" : S.alt }, ctx });
          S.up = false; exito();
        } catch (e) {
          S.up = false; if (e.handled) return;
          box.hidden = true;
          const msg = e.code === "aborted" ? "Cancelaste la subida. No se cambió nada en el sitio." : err(e);
          paso3(msg);
          if (e.code !== "aborted") { const p = $("[data-p]", d.foot); p.textContent = "Reintentar"; }
        }
      }
      async function exito() {
        d.setSteps(labels, 2); d.title("¡Listo!");
        d.body.innerHTML = `<div class="fap-strip info" role="status"><p><b>¡Listo! La ${noun} ya está publicada.</b><br>Puede tardar hasta 1 minuto en verse en el sitio.</p></div><p class="fap-help">Podrás volver a la original cuando quieras desde la tarjeta de esta ${noun}.</p>`;
        foot(`<button type="button" class="fap-btn sec" data-o>${vid ? "Cambiar otro video" : "Cambiar otra foto"}</button><button type="button" class="fap-btn sec" data-k>Cerrar</button><a class="fap-btn" href="${esc(pg.href)}?v=${Date.now()}" target="_blank" rel="noopener">Ver en el sitio ${ico("ext")}</a>`);
        $("[data-o]", d.foot).onclick = () => { URL.revokeObjectURL(S.url); d.close("otra"); };
        $("[data-k]", d.foot).onclick = () => { URL.revokeObjectURL(S.url); d.close(null); };
        d.focus("[data-k]");
        FAP.aviso(`Listo: la ${noun} ya está publicada.`, "ok");
        d.promise.then(() => recargar(id));
        FAP.drop("media", "summary"); try { items = (await FAP.get("media", true)).items; } catch (e) { /* se vuelve a pedir al cerrar */ }
      }
      paso1();
    }

    load(false);
    return () => { alive = false; if (map) map.destroy(); };
  }

  async function render(main, cur) { if (!cur.arg) { FAP.setTitle("Páginas del sitio"); return lista(main); } return pagina(main, cur.arg); }
  FAP.views.paginas = { render };
})();
