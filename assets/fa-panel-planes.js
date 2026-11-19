/* Panel del equipo · «Material de los planes»: tres tarjetas de plan, subir archivo en 3 pasos, y la lista con editar, ocultar, ver y eliminar. */
(function () {
  const FAP = window.FAP, { $, $$, esc, ico } = FAP, MB = 1048576, CF = window.FA_CONFIG || {}, PLANS = CF.PLANS || {};
  const KEYS = ["basico", "pro", "premium"], err = (e, ctx) => FAP.friendly(e, ctx);
  const short = (k) => String((PLANS[k] || {}).name || k).replace(/^Plan\s+/, ""), full = (k) => (PLANS[k] || {}).name || k;
  const CAT = { ebook: "Ebook", biblioteca: "Biblioteca de conocimientos", guia: "Guía", video: "Video", recurso: "Otro" };
  const DONDE = { ebook: "Ebooks", biblioteca: "Biblioteca", guia: "Material", video: "Material", recurso: "Material" };
  const MAT = Object.assign({}, FAP.checks ? FAP.checks.DOC : {}, { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "video/mp4": ["mp4"], "video/webm": ["webm"] });
  const lista = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]);
  const clp = (n) => (FAP.A.clp ? FAP.A.clp(n) : "$" + Number(n).toLocaleString("es-CL"));
  const tipoDe = (m) => (/^image\//.test(m) ? "Imagen" : /^video\//.test(m) ? "Video" : /pdf/.test(m) ? "PDF" : /epub/.test(m) ? "Libro electrónico" : /zip/.test(m) ? "ZIP" : /word/.test(m) ? "Word" : /sheet/.test(m) ? "Excel" : /presentation/.test(m) ? "PowerPoint" : "Texto");
  let filtro = "todos";

  async function render(main) {
    FAP.setTitle("Material de los planes");
    let alive = true, items = null;
    main.innerHTML = `<div class="fap-view"><p class="fap-help" style="max-width:70ch">Lo que subas aquí lo ven solo las personas con este plan activo, en su cuenta, en la sección Material. Los cursos se venden aparte y no se gestionan aquí.</p><div class="fap-skel" style="height:240px"></div></div>`;
    const host = $(".fap-view", main);
    const cuenta = (k) => { const l = (items || []).filter((m) => m.plans.includes(k)); return { n: l.length, o: l.filter((m) => !m.published).length }; };
    function paint() {
      const vis = (items || []).filter((m) => filtro === "todos" || m.plans.includes(filtro));
      host.innerHTML = `<p class="fap-help" style="max-width:70ch">Lo que subas aquí lo ven solo las personas con este plan activo, en su cuenta, en la sección Material. Los cursos se venden aparte y no se gestionan aquí.</p>
        <div class="fap-plans">${KEYS.map((k) => { const p = PLANS[k] || {}, c = cuenta(k); return `<article class="fap-card fap-plan"><span class="fap-kick">${esc(p.label || "")}</span><h3>${esc(p.name || k)}</h3><p class="price">${clp(p.amount || 0)}<small class="fap-help"> /mes</small></p><ul>${(p.benefits || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul><p><b>${c.n} ${c.n === 1 ? "archivo" : "archivos"}</b> · ${c.o} ${c.o === 1 ? "oculto" : "ocultos"}</p><button type="button" class="fap-btn" data-sub="${k}">Subir archivo para este plan</button></article>`; }).join("")}</div>
        <section class="fap-sec" style="margin-top:28px"><header><h2>Archivos</h2></header><div class="fap-tabs chips" role="group" aria-label="Ver archivos de" style="margin-bottom:14px">${[["todos", "Todos los planes"]].concat(KEYS.map((k) => [k, short(k)])).map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${filtro === k}">${esc(t)}</button>`).join("")}</div>
        ${vis.length ? `<div class="fap-items">${vis.map((m) => `<article class="fap-card fap-item" data-id="${esc(m.id)}"><div class="top"><b>${esc(m.title)}</b><span class="fap-chip">${esc(CAT[m.category] || m.category)}</span>${m.plans.map((p) => `<span class="fap-chip info">${esc(short(p))}</span>`).join("")}<span class="fap-chip ${m.published ? "ok" : "warn"}">${m.published ? "Visible" : "Oculto"}</span></div>
          <p class="fap-help">${esc(tipoDe(m.contentType))} · ${esc(m.fileName)} · ${FAP.fsize(m.size || 0)} · subido el ${esc(FAP.fechaCorta(m.createdAt))}${m.description ? " · " + esc(m.description) : ""}</p>
          <div class="acts"><button type="button" class="fap-btn sec sm" data-v="${esc(m.id)}">Ver archivo ${ico("ext")}</button><button type="button" class="fap-btn sec sm" data-e="${esc(m.id)}">Editar</button><button type="button" class="fap-btn sec sm" data-t="${esc(m.id)}">${m.published ? "Ocultar" : "Mostrar"}</button><button type="button" class="fap-btn danger sm" data-d="${esc(m.id)}">Eliminar</button></div></article>`).join("")}</div>`
          : `<div class="fap-card"><p><b>${filtro === "todos" ? "Todavía no hay archivos." : "Este plan todavía no tiene archivos."}</b></p><p class="fap-help">Usa «Subir archivo para este plan» para agregar el primero.</p></div>`}</section>`;
      const by = Object.fromEntries((items || []).map((m) => [m.id, m]));
      $$("[data-sub]", host).forEach((b) => (b.onclick = () => subir(b.dataset.sub)));
      $$("[data-f]", host).forEach((b) => (b.onclick = () => { filtro = b.dataset.f; paint(); const n = $(`[data-f="${filtro}"]`, host); if (n) n.focus(); }));
      $$("[data-v]", host).forEach((b) => (b.onclick = () => ver(by[b.dataset.v])));
      $$("[data-e]", host).forEach((b) => (b.onclick = () => editar(by[b.dataset.e])));
      $$("[data-t]", host).forEach((b) => (b.onclick = () => alternar(by[b.dataset.t])));
      $$("[data-d]", host).forEach((b) => (b.onclick = () => borrar(by[b.dataset.d])));
    }
    async function load(force) {
      try { items = (await FAP.get("materials", force)).items; if (alive) paint(); }
      catch (e) { if (!alive || e.handled) return; host.innerHTML = `<div class="fap-card"><p><b>No se pudo cargar el material.</b></p><p class="fap-help">${esc(err(e))}</p><p style="margin-top:12px"><button type="button" class="fap-btn" data-re>Reintentar</button></p></div>`; $("[data-re]", host).onclick = () => load(true); }
    }
    const recargar = () => { FAP.drop("materials", "summary"); return load(true); };

    async function ver(m) {
      const w = window.open("about:blank", "_blank");
      try {
        const r = await FAP.api("material-preview-url", { body: { id: m.id } });
        if (w) { w.opener = null; w.location.href = r.url; } else FAP.aviso("Tu navegador bloqueó la ventana nueva. Permite ventanas emergentes para este sitio e inténtalo de nuevo.", "warn");
      } catch (e) { if (w) w.close(); if (!e.handled) FAP.aviso(err(e), "bad"); }
    }
    async function alternar(m) {
      try { await FAP.api("material-update", { body: { id: m.id, title: m.title, description: m.description, category: m.category, plans: m.plans, published: !m.published } }); FAP.aviso(m.published ? `«${m.title}» ya no se ve para nadie.` : `«${m.title}» ya se ve para ${lista(m.plans.map(full))}.`, "ok"); await recargar(); }
      catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
    }
    async function borrar(m) {
      const c = await FAP.confirmar({ titulo: "¿Eliminar este archivo?", cuerpo: `<p><b>${esc(m.title)}</b> · ${FAP.fsize(m.size || 0)}</p><p>Dejará de verse para ${m.plans.length} ${m.plans.length === 1 ? "plan" : "planes"} (${esc(lista(m.plans.map(short)))}) y el archivo se borra de forma definitiva.</p>`, ok: "Eliminar", peligro: true, extra: m.published ? "Mejor ocultarlo" : null });
      if (c === "extra") return alternar(m);
      if (c !== "ok") return;
      try { await FAP.api("material-delete", { body: { id: m.id } }); FAP.aviso("Archivo eliminado.", "ok"); await recargar(); }
      catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
    }

    /* campos compartidos entre subir y editar */
    function campos(v) {
      return `<div class="fap-field"><label for="mTit">Título</label><input id="mTit" maxlength="160" placeholder="Ebook de gases refrigerantes" value="${esc(v.title || "")}"></div>
        <div class="fap-field"><label for="mDes">Descripción corta (opcional)</label><textarea id="mDes" maxlength="1000">${esc(v.description || "")}</textarea></div>
        <fieldset class="fap-field" style="border:0;padding:0;margin:0 0 16px"><legend>¿Qué tipo de archivo es?</legend><div class="fap-checks">${Object.keys(CAT).map((k) => `<label class="fap-check"><input type="radio" name="mCat" value="${k}" ${v.category === k ? "checked" : ""}> ${esc(CAT[k])}</label>`).join("")}</div><p class="fap-help" id="mDonde" aria-live="polite"></p></fieldset>
        <fieldset class="fap-field" style="border:0;padding:0;margin:0 0 16px"><legend>¿Quién lo ve?</legend><div class="fap-checks">${KEYS.map((k) => `<label class="fap-check"><input type="checkbox" name="mPlan" value="${k}" ${(v.plans || []).includes(k) ? "checked" : ""}> ${esc(full(k))}</label>`).join("")}</div><p class="fap-help">Solo lo ven las personas con ese plan activo. Los ebooks y la biblioteca son beneficios del Plan Premium, por eso los marcamos así; puedes cambiarlo.</p></fieldset>`;
    }
    const leer = (root) => ({ title: $("#mTit", root).value.trim(), description: $("#mDes", root).value.trim(), category: ($("[name=mCat]:checked", root) || {}).value || "", plans: $$("[name=mPlan]:checked", root).map((i) => i.value) });
    function ligar(root) {
      const act = () => { const c = ($("[name=mCat]:checked", root) || {}).value, p = $$("[name=mPlan]:checked", root).map((i) => full(i.value));
        $("#mDonde", root).textContent = c ? `Aparecerá en Mi cuenta › ${DONDE[c]}${p.length ? ", para las personas con " + lista(p) : ""}.` : "Elige qué tipo de archivo es."; };
      $$("[name=mCat]", root).forEach((i) => i.addEventListener("change", () => { if (i.value === "ebook" || i.value === "biblioteca") $$("[name=mPlan]", root).forEach((x) => (x.checked = x.value === "premium")); act(); }));
      $$("[name=mPlan]", root).forEach((i) => i.addEventListener("change", act)); act();
    }
    function validar(v, er, root) {
      const m = (t, sel) => { er.hidden = false; er.textContent = t; const f = $(sel, root); if (f) f.focus(); return false; };
      if (!v.title) return m(FAP.friendly({ code: "title" }), "#mTit");
      if (!v.category) return m("Elige qué tipo de archivo es.", "[name=mCat]");
      if (!v.plans.length) return m(FAP.friendly({ code: "bad_plans" }), "[name=mPlan]");
      er.hidden = true; return true;
    }

    /* ---------- subir: 1 Elegir archivo · 2 Datos · 3 Revisar y publicar ---------- */
    function subir(plan) {
      const d = FAP.dialog({ title: "Subir archivo para " + full(plan), side: true, cls: "sheet" }), labels = ["Elegir archivo", "Datos", "Revisar y publicar"];
      const S = { v: { title: "", description: "", category: "", plans: [plan] }, up: false, ctl: null };
      let pk = null;
      d.veto = () => { if (S.up) return false; pk && pk.destroy(); return true; };
      function p1() {
        d.setSteps(labels, 0);
        d.body.innerHTML = `<div data-pk></div>`;
        pk = FAP.picker($("[data-pk]", d.body), { id: "mF", label: "Archivo", titulo: "Arrastra el archivo aquí o toca para elegirlo", boton: "Elegir archivo", accept: FAP.checks.accept(MAT), ayuda: "PDF, libro electrónico (EPUB), ZIP, Word, Excel, PowerPoint, texto, imagen o video. Hasta 50 MB.",
          check: (f) => FAP.checks.revisar(f, MAT, 50, "un PDF, EPUB, ZIP, Word, Excel, PowerPoint, texto, imagen o video"), init: S.file ? { file: S.file } : null, onChange: (f) => { if (f) { S.file = f; if (!S.v.title) S.v.title = ""; p2(); } else S.file = null; } });
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button>${S.file ? `<button type="button" class="fap-btn" data-n>Continuar</button>` : ""}`;
        $("[data-c]", d.foot).onclick = () => { pk && pk.destroy(); d.close(null); };
        if (S.file) $("[data-n]", d.foot).onclick = p2;
        d.focus("[data-pick]");
      }
      function p2(msg) {
        if (pk) { pk.destroy(); pk = null; }
        d.setSteps(labels, 1);
        d.body.innerHTML = `<div class="fap-strip"><p style="overflow-wrap:anywhere"><b>${esc(S.file.name)}</b><br><span class="fap-help">${esc(tipoDe(S.file.type))} · ${FAP.fsize(S.file.size)}</span></p></div><div style="height:14px"></div>${campos(S.v)}<p class="fap-err" id="mErr" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
        ligar(d.body);
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn" data-n>Continuar</button>`;
        $("[data-b]", d.foot).onclick = () => { S.v = leer(d.body); p1(); };
        $("[data-n]", d.foot).onclick = () => { const v = leer(d.body); if (!validar(v, $("#mErr", d.body), d.body)) return; S.v = v; p3(); };
        d.focus("#mTit");
      }
      function p3(msg) {
        if (S.url) URL.revokeObjectURL(S.url);
        S.url = URL.createObjectURL(S.file); const t = S.file.type;
        const prev = /^image\//.test(t) ? `<div class="fap-thumb"><img src="${esc(S.url)}" alt=""></div>` : /^video\//.test(t) ? `<div class="fap-thumb"><video src="${esc(S.url)}" controls muted playsinline preload="metadata"></video></div>` : t === "application/pdf" ? `<object data="${esc(S.url)}" type="application/pdf" style="width:100%;height:320px;border-radius:12px;background:#fff"><p class="fap-help">Tu navegador no muestra la vista previa del PDF; el archivo se subirá igual.</p></object>` : "";
        d.setSteps(labels, 2);
        d.body.innerHTML = `<p class="fap-help">Así lo verá la persona en su cuenta, en Mi cuenta › ${esc(DONDE[S.v.category])}:</p><article class="fap-card fap-item"><div class="top"><b>${esc(S.v.title)}</b><span class="fap-chip">${esc(CAT[S.v.category])}</span></div><p class="fap-help">${esc(tipoDe(t))} · ${esc(S.file.name)} · ${FAP.fsize(S.file.size)}</p>${S.v.description ? `<p>${esc(S.v.description)}</p>` : ""}${prev}</article>
          <p style="margin-top:12px">Lo verán las personas con ${esc(lista(S.v.plans.map(full)))}.</p><p class="fap-err" id="mErr3" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn sec" data-h>Guardar oculto</button><button type="button" class="fap-btn" data-p>Publicar ahora</button>`;
        $("[data-b]", d.foot).onclick = () => p2();
        $("[data-h]", d.foot).onclick = () => publicar(false);
        $("[data-p]", d.foot).onclick = () => publicar(true);
        d.focus("[data-p]");
      }
      async function publicar(pub) {
        const f = S.file; S.up = true; S.ctl = new AbortController();
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-x>Cancelar subida</button>`; $("[data-x]", d.foot).onclick = () => S.ctl.abort();
        $("#mErr3", d.body).hidden = true;
        d.body.insertAdjacentHTML("beforeend", `<div id="mUp"><p id="mUpT" role="status">Subiendo ${esc(f.name)} (${FAP.fsize(f.size)})… No cierres esta pantalla.</p><div class="fap-prog ind" id="mBar" role="progressbar" aria-label="Avance de la subida" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>`);
        const bar = $("#mBar", d.body), tx = $("#mUpT", d.body);
        try {
          const u = await FAP.api("material-upload-url", { body: { fileName: f.name, contentType: f.type, size: f.size }, ctx: { max: 50, what: "un PDF, EPUB, ZIP, Word, Excel, PowerPoint, texto, imagen o video" } });
          await FAP.subir(u, f, { signal: S.ctl.signal, onProgress: (p) => { bar.classList.remove("ind"); const n = Math.round(p * 100); $("i", bar).style.width = n + "%"; bar.setAttribute("aria-valuenow", n); tx.textContent = `Subiendo ${f.name} (${FAP.fsize(f.size)})… ${n} %. No cierres esta pantalla.`; } });
          tx.textContent = "Guardando…"; bar.classList.add("ind");
          await FAP.api("material-save", { body: Object.assign({ path: u.path, fileName: f.name, contentType: u.contentType, size: f.size, published: pub }, S.v) });
          S.up = false; URL.revokeObjectURL(S.url);
          d.setSteps(labels, 2);
          d.body.innerHTML = `<div class="fap-strip info" role="status"><p><b>${pub ? "¡Listo! El archivo ya está publicado." : "Guardado. Quedó oculto: nadie lo ve todavía."}</b><br>${pub ? `Lo ven las personas con ${esc(lista(S.v.plans.map(full)))}.` : "Cuando quieras que se vea, usa «Mostrar» en la lista."}</p></div>`;
          d.foot.innerHTML = `<button type="button" class="fap-btn" data-k>Cerrar</button>`; $("[data-k]", d.foot).onclick = () => d.close("ok"); d.focus("[data-k]");
          FAP.aviso(pub ? "Archivo publicado." : "Archivo guardado, oculto.", "ok"); d.promise.then(recargar);
        } catch (e) { S.up = false; if (e.handled) return; p3(e.code === "aborted" ? "Cancelaste la subida. No se guardó nada." : err(e)); }
      }
      p1();
    }

    /* ---------- editar ---------- */
    function editar(m) {
      const d = FAP.dialog({ title: "Editar archivo", side: true, cls: "sheet" });
      d.body.innerHTML = `<div class="fap-strip"><p style="overflow-wrap:anywhere"><b>${esc(m.fileName)}</b><br><span class="fap-help">${esc(tipoDe(m.contentType))} · ${FAP.fsize(m.size || 0)}. Para cambiar el archivo, súbelo de nuevo y elimina este.</span></p></div><div style="height:14px"></div>${campos(m)}<label class="fap-check"><input type="checkbox" id="mPub" ${m.published ? "checked" : ""}> Visible para las personas de esos planes</label><p class="fap-err" id="mErr" role="alert" hidden></p>`;
      ligar(d.body);
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-g>Guardar cambios</button>`;
      $("[data-c]", d.foot).onclick = () => d.close(null);
      $("[data-g]", d.foot).onclick = async () => {
        const v = leer(d.body), er = $("#mErr", d.body); if (!validar(v, er, d.body)) return;
        const g = $("[data-g]", d.foot); g.disabled = true; g.textContent = "Guardando…";
        try { await FAP.api("material-update", { body: Object.assign({ id: m.id, published: $("#mPub", d.body).checked }, v) }); FAP.aviso("Cambios guardados.", "ok"); d.close("ok"); await recargar(); }
        catch (e) { g.disabled = false; g.textContent = "Guardar cambios"; if (!e.handled) { er.hidden = false; er.textContent = err(e); } }
      };
      d.focus("#mTit");
    }
    load(false);
    return () => { alive = false; };
  }
  FAP.views.planes = { render };
})();
