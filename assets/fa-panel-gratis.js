/* Panel del equipo · recursos gratis (videos y documentos de la página «Gratis») y el selector de archivos que comparten los flujos de subida. */
(function () {
  const FAP = window.FAP, { $, $$, esc, ico } = FAP, MB = 1048576;
  const err = (e, ctx) => FAP.friendly(e, ctx);
  const extOf = (n) => ((/\.([a-z0-9]{1,8})$/i.exec(String(n || "")) || [])[1] || "").toLowerCase();

  /* ---------- selector de archivo con vista del archivo elegido ---------- */
  const COVER = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/avif": ["avif"] };
  const VIDEO = { "video/mp4": ["mp4"], "video/webm": ["webm"] };
  const DOC = { "application/pdf": ["pdf"], "application/epub+zip": ["epub"], "application/zip": ["zip"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"], "text/plain": ["txt"] };
  const accept = (t) => Object.values(t).flat().map((x) => "." + x).concat(Object.keys(t)).join(",");
  /* Revisa un archivo contra una tabla de tipos permitidos; devuelve el mensaje de error o null. */
  function revisar(f, tabla, maxMb, que, grande) {
    const t = tabla[String(f.type).toLowerCase()];
    if (!t || !t.includes(extOf(f.name))) return FAP.friendly({ code: "bad_type" }, { what: que });
    if (!f.size) return FAP.friendly({ code: "bad_size" });
    if (f.size > maxMb * MB) return grande || FAP.friendly({ code: "too_big" }, { max: maxMb });
    return null;
  }
  /* host: contenedor; o: {label, titulo, boton, accept, ayuda, check(file) -> mensaje|null, prep(file) -> {file, note}, img (mostrar miniatura), actual (texto del archivo ya guardado)} */
  function picker(host, o) {
    const S = { file: null, note: "", url: null, pending: null };
    if (o.init && o.init.file) { S.file = o.init.file; S.note = o.init.note || ""; if (o.img) S.url = URL.createObjectURL(S.file); }
    const paint = () => {
      host.innerHTML = `<div class="fap-field"><span class="fap-lbl" id="${esc(o.id)}L">${esc(o.label)}</span>
        ${S.file ? `<div class="fap-strip" role="status">${o.img && S.url ? `<div class="fap-thumb" style="width:96px;flex:none"><img src="${esc(S.url)}" alt=""></div>` : ""}<p style="flex:1;min-width:0;overflow-wrap:anywhere"><b>${esc(S.file.name)}</b><br><span class="fap-help">${FAP.fsize(S.file.size)}${S.note ? " · " + esc(S.note) : ""}</span></p><button type="button" class="fap-btn sec sm" data-ch>Cambiar</button></div>`
          : `${o.actual ? `<p class="fap-help">Ahora: ${esc(o.actual)}. Elige uno nuevo solo si quieres reemplazarlo.</p>` : ""}${FAP.zoneHtml({ titulo: o.titulo, boton: o.boton, accept: o.accept, ayuda: o.ayuda })}`}
        <p class="fap-err" role="alert" data-e hidden></p></div>`;
      if (S.file) $("[data-ch]", host).onclick = () => { S.file = null; if (S.url) URL.revokeObjectURL(S.url); S.url = null; paint(); o.onChange && o.onChange(null); $("[data-pick]", host).focus(); };
      else FAP.zone(host, { onFile: take });
    };
    const fail = (m) => { const e = $("[data-e]", host); e.hidden = !m; e.textContent = m || ""; };
    async function take(f) {
      S.pending = tomar(f); await S.pending; S.pending = null;
    }
    async function tomar(f) {
      fail("");
      const m = o.check && o.check(f); if (m) return fail(m);
      let r = { file: f, note: "" };
      if (o.prep) { $("[data-pick]", host).disabled = true; $("[data-pick]", host).textContent = "Preparando…"; r = await o.prep(f); }
      S.file = r.file; S.note = r.note || ""; if (o.img) S.url = URL.createObjectURL(r.file);
      paint(); const ch = $("[data-ch]", host); if (ch) ch.focus(); o.onChange && o.onChange(S.file);
    }
    paint();
    return { get ready() { return S.pending || Promise.resolve(); }, get file() { return S.file; }, get note() { return S.note; }, get url() { return S.url; }, fail, destroy() { if (S.url) URL.revokeObjectURL(S.url); } };
  }
  const prepCover = async (f) => { const r = await FAP.aWebp(f, { max: 1600 }); if (r.file.size > 5 * MB) return { file: f, note: "" }; return { file: r.file, note: r.converted ? `La achicamos: pasó de ${FAP.fsize(r.from)} a ${FAP.fsize(r.to)}.` : "" }; };
  const checkCover = (f) => revisar(f, COVER, 5, "una foto JPG, PNG, WebP o AVIF de hasta 5 MB");

  /* ---------- subida de varios archivos con una sola barra ---------- */
  function barra(d, texto) {
    d.body.insertAdjacentHTML("beforeend", `<div id="gUp"><p id="gUpT" role="status"></p><div class="fap-prog ind" id="gBar" role="progressbar" aria-label="Avance de la subida" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>`);
    const bar = $("#gBar", d.body), t = $("#gUpT", d.body);
    const set = (p) => { bar.classList.remove("ind"); const v = Math.round(p * 100); $("i", bar).style.width = v + "%"; bar.setAttribute("aria-valuenow", v); t.textContent = `${texto} ${v} %. No cierres esta pantalla.`; };
    t.textContent = texto + " No cierres esta pantalla.";
    return { set, text: (x) => { t.textContent = x; bar.classList.add("ind"); }, remove: () => { const e = $("#gUp", d.body); if (e) e.remove(); } };
  }
  const ytId = (u) => { const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(String(u || "")); return m ? m[1] : null; };

  /* ---------- vista previa de una tarjeta, igual que en la página Gratis ---------- */
  const TAG = (r) => (r.kind === "archivo" ? "Documento" : r.kind === "video_corto" ? "Video corto" : r.youtube || ytId(r.videoUrl) ? "YouTube" : "Video");
  function rc(r, o) {
    o = o || {};
    const src = o.cover || r.coverUrl, fb = r.coverFallbackUrl || "";
    return `<article class="fap-card fap-rc" data-id="${esc(r.id || "")}"><div class="fap-thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy" ${fb ? `onerror="this.onerror=null;this.src='${esc(fb)}'"` : ""}>` : `<span class="fap-nofoto">Sin foto</span>`}</div>
      <div class="body"><span class="fap-kick">${esc(TAG(r))}</span><h4>${esc(r.title || "Sin título")}</h4><p>${esc(r.description || "")}</p>${o.acts || ""}</div></article>`;
  }

  /* ---------- sección dentro de la página Gratis ---------- */
  function seccion(box, tipo, pg) {
    const esVideos = tipo === "videos";
    const mios = (r) => (esVideos ? r.kind !== "archivo" : r.kind === "archivo");
    let alive = true;
    const draw = async (force) => {
      box.innerHTML = `<div class="fap-skel" style="height:160px"></div>`;
      let items;
      try { items = (await FAP.get("free", force)).items.filter(mios); }
      catch (e) { if (e.handled) return; box.innerHTML = `<div class="fap-card"><p><b>No se pudo cargar esta lista.</b></p><p class="fap-help">${esc(err(e))}</p><p style="margin-top:12px"><button type="button" class="fap-btn" data-re>Reintentar</button></p></div>`; $("[data-re]", box).onclick = () => draw(true); return; }
      box.innerHTML = `<div class="fap-row-card" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${esVideos ? `<button type="button" class="fap-btn sec" data-n="video_externo">Agregar video de YouTube</button><button type="button" class="fap-btn sec" data-n="video_corto">Subir video corto</button>` : `<button type="button" class="fap-btn sec" data-n="archivo">Subir documento</button>`}</div>
        ${items.length ? `<div class="fap-rcs">${items.map((r) => rc(r, { acts: `<div class="fap-item"><div class="top"><span class="fap-chip ${r.published ? "ok" : "warn"}">${r.published ? "Publicado" : "Oculto"}</span>${r.fileUrl ? `<a class="fap-btn text sm" href="${esc(r.fileUrl)}" target="_blank" rel="noopener">Ver ${ico("ext")}</a>` : r.videoUrl ? `<a class="fap-btn text sm" href="${esc(r.videoUrl)}" target="_blank" rel="noopener">Ver ${ico("ext")}</a>` : ""}</div><div class="acts"><button type="button" class="fap-btn sec sm" data-e="${esc(r.id)}">Editar</button><button type="button" class="fap-btn sec sm" data-t="${esc(r.id)}">${r.published ? "Ocultar" : "Mostrar"}</button><button type="button" class="fap-btn danger sm" data-d="${esc(r.id)}">Eliminar</button></div></div>` })).join("")}</div>`
          : `<div class="fap-card"><p><b>${esVideos ? "Todavía no hay videos gratis." : "Todavía no hay documentos gratis."}</b></p><p class="fap-help">${esVideos ? "Agrega un video de YouTube o sube un video corto." : "Sube un PDF u otro documento para que la gente lo descargue."}</p></div>`}`;
      const by = Object.fromEntries(items.map((r) => [r.id, r]));
      $$("[data-n]", box).forEach((b) => (b.onclick = () => nuevo(b.dataset.n, b, draw)));
      $$("[data-e]", box).forEach((b) => (b.onclick = () => editar(by[b.dataset.e], b, draw)));
      $$("[data-t]", box).forEach((b) => (b.onclick = () => alternar(by[b.dataset.t], draw)));
      $$("[data-d]", box).forEach((b) => (b.onclick = () => borrar(by[b.dataset.d], draw)));
    };
    draw(false);
  }

  async function alternar(r, draw) {
    try { await FAP.api("free-update", { body: { id: r.id, title: r.title, description: r.description, published: !r.published } }); FAP.drop("free", "summary"); FAP.aviso(r.published ? "Listo: «" + r.title + "» ya no se ve en el sitio." : "Listo: «" + r.title + "» ya se ve en el sitio.", "ok"); await draw(true); }
    catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
  }
  async function borrar(r, draw) {
    const c = await FAP.confirmar({ titulo: "¿Eliminar este recurso?", cuerpo: `<p><b>${esc(r.title)}</b></p><p>Deja de verse en la página y se borran su foto y su archivo de forma definitiva. No se puede deshacer.</p>`, ok: "Eliminar", peligro: true, extra: r.published ? "Mejor ocultarlo" : null });
    if (c === "extra") return alternar(r, draw);
    if (c !== "ok") return;
    try { await FAP.api("free-delete", { body: { id: r.id } }); FAP.drop("free", "summary"); FAP.aviso("Recurso eliminado.", "ok"); await draw(true); }
    catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
  }

  /* ---------- agregar: 1 Datos · 2 Revisar y publicar ---------- */
  function nuevo(kind, _b, draw) {
    const titulos = { video_externo: "Agregar video de YouTube", video_corto: "Subir video corto", archivo: "Subir documento" };
    const d = FAP.dialog({ title: titulos[kind], side: true, cls: "sheet" }), labels = ["Datos", "Revisar y publicar"];
    const S = { link: "", title: "", desc: "", up: false, ctl: null }, ext = kind === "video_externo";
    let fileP = null, coverP = null;
    d.veto = () => { if (S.up) return false; [fileP, coverP].forEach((p) => p && p.destroy()); return true; };
    function datos(msg) {
      d.setSteps(labels, 0);
      d.body.innerHTML = `${ext ? `<div class="fap-field"><label for="gLink">Link del video</label><input id="gLink" type="url" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…" value="${esc(S.link)}"><small>Pega el link del video completo desde YouTube.</small></div>` : `<div data-pf></div>`}
        <div class="fap-field"><label for="gTit">Título</label><input id="gTit" maxlength="160" value="${esc(S.title)}"></div>
        <div class="fap-field"><label for="gDes">Descripción (opcional)</label><textarea id="gDes" maxlength="1000">${esc(S.desc)}</textarea><small>Es el texto corto que se ve bajo el título en la tarjeta.</small></div>
        <div data-pc></div><p class="fap-err" id="gErr" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
      const keepF = fileP && { file: fileP.file, note: fileP.note }, keepC = coverP && { file: coverP.file, note: coverP.note };
      [fileP, coverP].forEach((p) => p && p.destroy());
      if (!ext) { fileP = picker($("[data-pf]", d.body), kind === "archivo" ? { init: keepF, id: "gF", label: "Documento", titulo: "Arrastra el documento aquí o toca para elegirlo", boton: "Elegir documento", accept: accept(DOC), ayuda: "PDF, EPUB, ZIP, Word, Excel, PowerPoint o texto. Hasta 50 MB.", check: (f) => revisar(f, DOC, 50, "un PDF u otro documento (EPUB, ZIP, Word, Excel, PowerPoint o texto)") } : { init: keepF, id: "gF", label: "Video corto", titulo: "Arrastra el video aquí o toca para elegirlo", boton: "Elegir video", accept: accept(VIDEO), ayuda: "MP4 o WebM. Hasta 50 MB.", check: (f) => revisar(f, VIDEO, 50, "un video MP4 o WebM", "Pesa más de 50 MB. Súbelo a YouTube y usa «Agregar video de YouTube».") }); }
      coverP = picker($("[data-pc]", d.body), { init: keepC, id: "gC", label: ext ? "Foto de referencia (opcional si es YouTube)" : "Foto de referencia", titulo: "Arrastra la foto aquí o toca para elegirla", boton: "Elegir foto", accept: accept(COVER), ayuda: "JPG, PNG, WebP o AVIF. Hasta 5 MB. Es la imagen que muestra de qué trata." + (ext ? " Si no pones una, usamos la de YouTube." : ""), img: true, check: checkCover, prep: prepCover });
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-n>Continuar</button>`;
      $("[data-c]", d.foot).onclick = () => { [fileP, coverP].forEach((p) => p && p.destroy()); d.close(null); };
      $("[data-n]", d.foot).onclick = continuar;
      d.focus(ext ? "#gLink" : "[data-pick]");
    }
    function leer() { S.link = (($("#gLink", d.body) || {}).value || "").trim(); S.title = $("#gTit", d.body).value.trim(); S.desc = $("#gDes", d.body).value.trim(); }
    async function continuar() {
      await Promise.all([fileP && fileP.ready, coverP && coverP.ready]);
      leer(); const er = $("#gErr", d.body); er.hidden = false;
      const m = (t) => { er.textContent = t; };
      if (ext) { if (!/^https:\/\/\S+\.\S+/.test(S.link)) { m(FAP.friendly({ code: "bad_video_url" })); return $("#gLink", d.body).focus(); } }
      else if (!fileP.file) { m(kind === "archivo" ? "Elige el documento para descargar." : "Elige el video corto."); return; }
      if (!S.title) { m(FAP.friendly({ code: "title" })); return $("#gTit", d.body).focus(); }
      if (!coverP.file && !(ext && ytId(S.link))) { m(FAP.friendly({ code: "needs_cover" }, { youtube: ext })); return; }
      er.hidden = true; revisarPaso();
    }
    function revisarPaso(msg) {
      d.setSteps(labels, 1);
      const cover = coverP.file ? coverP.url : (ytId(S.link) ? `https://i.ytimg.com/vi/${ytId(S.link)}/mqdefault.jpg` : null);
      d.body.innerHTML = `<p class="fap-help">Así se verá la tarjeta en la página «Recursos gratis»:</p><div style="max-width:360px">${rc({ title: S.title, description: S.desc, kind, videoUrl: S.link, youtube: !!ytId(S.link) }, { cover })}</div>
        <p class="fap-help" style="margin-top:12px">${ext ? "Link: " + esc(S.link) : esc(fileP.file.name) + " · " + FAP.fsize(fileP.file.size)}</p><p class="fap-err" id="gErr2" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn sec" data-h>Guardar oculto</button><button type="button" class="fap-btn" data-p>Publicar ahora</button>`;
      $("[data-b]", d.foot).onclick = () => datos();
      $("[data-h]", d.foot).onclick = () => guardar(false);
      $("[data-p]", d.foot).onclick = () => guardar(true);
      d.focus("[data-p]");
    }
    async function guardar(pub) {
      const files = [coverP.file && { f: coverP.file, role: "cover" }, !ext && fileP.file && { f: fileP.file, role: "file" }].filter(Boolean);
      const total = files.reduce((a, x) => a + x.f.size, 0) || 1; let hecho = 0;
      S.up = true; S.ctl = new AbortController(); d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-x>Cancelar subida</button>`;
      $("[data-x]", d.foot).onclick = () => S.ctl.abort();
      const er = $("#gErr2", d.body); er.hidden = true;
      const b = barra(d, files.length ? "Subiendo…" : "Guardando…");
      try {
        let id = null; const subidos = {};
        for (const x of files) {
          const r = await FAP.api("free-upload-url", { body: { id, role: x.role, kind, fileName: x.f.name, contentType: x.f.type, size: x.f.size }, ctx: { max: x.role === "cover" ? 5 : 50, what: x.role === "cover" ? "una foto JPG, PNG, WebP o AVIF" : kind === "archivo" ? "un documento permitido" : "un video MP4 o WebM" } });
          id = r.id; const base = hecho;
          await FAP.subir(r, x.f, { signal: S.ctl.signal, onProgress: (p) => b.set((base + p * x.f.size) / total) });
          hecho += x.f.size; subidos[x.role] = r;
        }
        b.text("Guardando…");
        const c = subidos.cover, f = subidos.file;
        await FAP.api("free-save", { body: { id: id || crypto.randomUUID(), kind, title: S.title, description: S.desc, published: pub, videoUrl: ext ? S.link : undefined,
          coverPath: c && c.path, coverName: c ? coverP.file.name : undefined, coverType: c && c.contentType, coverSize: c ? coverP.file.size : undefined,
          filePath: f && f.path, fileName: f ? fileP.file.name : undefined, contentType: f && f.contentType, size: f ? fileP.file.size : undefined } });
        S.up = false; FAP.drop("free", "summary");
        d.setSteps(labels, 1);
        d.body.innerHTML = `<div class="fap-strip info" role="status"><p><b>${pub ? "¡Listo! Ya se ve en la página «Recursos gratis»." : "Guardado. Quedó oculto hasta que lo publiques."}</b></p></div>`;
        d.foot.innerHTML = `<button type="button" class="fap-btn" data-k>Cerrar</button>`; $("[data-k]", d.foot).onclick = () => { [fileP, coverP].forEach((p) => p && p.destroy()); d.close("ok"); }; d.focus("[data-k]");
        FAP.aviso(pub ? "Recurso publicado." : "Recurso guardado, oculto.", "ok");
        d.promise.then(() => draw(true));
      } catch (e) {
        S.up = false; if (e.handled) return;
        revisarPaso(e.code === "aborted" ? "Cancelaste la subida. No se publicó nada." : err(e));
      }
    }
    datos();
  }

  /* ---------- editar ---------- */
  function editar(r, _b, draw) {
    const d = FAP.dialog({ title: "Editar recurso", side: true, cls: "sheet" }), ext = r.kind === "video_externo";
    d.body.innerHTML = `${ext ? `<div class="fap-field"><label for="eLink">Link del video</label><input id="eLink" type="url" value="${esc(r.videoUrl || "")}"></div>` : `<div data-pf></div>`}
      <div class="fap-field"><label for="eTit">Título</label><input id="eTit" maxlength="160" value="${esc(r.title)}"></div>
      <div class="fap-field"><label for="eDes">Descripción (opcional)</label><textarea id="eDes" maxlength="1000">${esc(r.description || "")}</textarea></div>
      <div data-pc></div>
      ${ext && r.hasOwnCover && r.youtube ? `<label class="fap-check" style="margin-bottom:16px"><input type="checkbox" id="eYt"> Usar la foto de YouTube en vez de la mía</label>` : ""}
      <label class="fap-check"><input type="checkbox" id="ePub" ${r.published ? "checked" : ""}> Mostrar en el sitio</label>
      <p class="fap-err" id="eErr" role="alert" hidden></p>`;
    const fileP = ext ? null : picker($("[data-pf]", d.body), r.kind === "archivo" ? { id: "eF", label: "Reemplazar el documento (opcional)", actual: r.fileName, titulo: "Arrastra el documento nuevo o toca para elegirlo", boton: "Elegir documento", accept: accept(DOC), ayuda: "PDF, EPUB, ZIP, Word, Excel, PowerPoint o texto. Hasta 50 MB.", check: (f) => revisar(f, DOC, 50, "un PDF u otro documento permitido") } : { id: "eF", label: "Reemplazar el video (opcional)", actual: r.fileName, titulo: "Arrastra el video nuevo o toca para elegirlo", boton: "Elegir video", accept: accept(VIDEO), ayuda: "MP4 o WebM. Hasta 50 MB.", check: (f) => revisar(f, VIDEO, 50, "un video MP4 o WebM") });
    const coverP = picker($("[data-pc]", d.body), { id: "eC", label: "Reemplazar la foto de referencia (opcional)", actual: r.hasOwnCover ? "tienes una foto puesta" : null, titulo: "Arrastra la foto nueva o toca para elegirla", boton: "Elegir foto", accept: accept(COVER), ayuda: "JPG, PNG, WebP o AVIF. Hasta 5 MB.", img: true, check: checkCover, prep: prepCover });
    let up = false, ctl = null;
    d.veto = () => { if (up) return false; [fileP, coverP].forEach((p) => p && p.destroy()); return true; };
    d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-g>Guardar cambios</button>`;
    $("[data-c]", d.foot).onclick = () => { [fileP, coverP].forEach((p) => p && p.destroy()); d.close(null); };
    $("[data-g]", d.foot).onclick = async () => {
      await Promise.all([fileP && fileP.ready, coverP && coverP.ready]);
      const er = $("#eErr", d.body); er.hidden = true;
      const title = $("#eTit", d.body).value.trim(); if (!title) { er.hidden = false; er.textContent = FAP.friendly({ code: "title" }); return $("#eTit", d.body).focus(); }
      const link = ext ? $("#eLink", d.body).value.trim() : undefined;
      if (ext && !/^https:\/\/\S+\.\S+/.test(link)) { er.hidden = false; er.textContent = FAP.friendly({ code: "bad_video_url" }); return $("#eLink", d.body).focus(); }
      const files = [coverP.file && { f: coverP.file, role: "cover" }, fileP && fileP.file && { f: fileP.file, role: "file" }].filter(Boolean);
      const total = files.reduce((a, x) => a + x.f.size, 0) || 1; let hecho = 0; up = true; ctl = new AbortController();
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-x>Cancelar subida</button>`; $("[data-x]", d.foot).onclick = () => ctl.abort();
      const b = barra(d, files.length ? "Subiendo…" : "Guardando…");
      try {
        const sub = {};
        for (const x of files) { const u = await FAP.api("free-upload-url", { body: { id: r.id, role: x.role, kind: r.kind, fileName: x.f.name, contentType: x.f.type, size: x.f.size } }); const base = hecho; await FAP.subir(u, x.f, { signal: ctl.signal, onProgress: (p) => b.set((base + p * x.f.size) / total) }); hecho += x.f.size; sub[x.role] = u; }
        b.text("Guardando…");
        const c = sub.cover, f = sub.file;
        await FAP.api("free-update", { body: { id: r.id, title, description: $("#eDes", d.body).value.trim(), published: $("#ePub", d.body).checked, videoUrl: link, removeCover: !!($("#eYt", d.body) && $("#eYt", d.body).checked) && !c || undefined,
          coverPath: c && c.path, coverName: c ? coverP.file.name : undefined, coverType: c && c.contentType, coverSize: c ? coverP.file.size : undefined,
          filePath: f && f.path, fileName: f ? fileP.file.name : undefined, contentType: f && f.contentType, size: f ? fileP.file.size : undefined } });
        up = false; FAP.drop("free", "summary"); FAP.aviso("Cambios guardados.", "ok"); [fileP, coverP].forEach((p) => p && p.destroy()); d.close("ok"); draw(true);
      } catch (e) {
        up = false; if (e.handled) return; b.remove(); const er2 = $("#eErr", d.body); er2.hidden = false; er2.textContent = e.code === "aborted" ? "Cancelaste la subida. No se cambió nada." : err(e);
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-g>Guardar cambios</button>`; $("[data-c]", d.foot).onclick = () => d.close(null);
        $("[data-g]", d.foot).onclick = () => { d.close(null); editar(r, null, draw); };
      }
    };
    d.focus("#eTit");
  }

  FAP.picker = picker; FAP.checks = { revisar, DOC, VIDEO, COVER, accept };
  FAP.gratis = { seccion, rc, picker };
})();
