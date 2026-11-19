/* Contenido del sitio (equipo): material por plan, fotos y videos de la página, y accesos por plan (activados por Hotmart).
   Las subidas van directo a Supabase Storage con un token de un solo uso que entrega /api/admin;
   el navegador nunca tiene la clave de servicio. */
(function () {
  const A = window.FAAuth, C = window.FA_CONFIG || {}, PLANS = C.PLANS || {}, SL = window.FA_SLOTS;
  const { esc, fdate } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const root = $("#faContenido");
  const PK = ["basico", "pro", "premium"];
  const pname = (k) => (PLANS[k] || {}).name || k;
  const CAT = { ebook: "Ebook", biblioteca: "Biblioteca", guia: "Guía", video: "Video", recurso: "Recurso" };
  const fsize = (n) => (n == null ? "" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  let tab = "material", mats = null, media = null, subs = null, pageFilter = "Todas", subQ = "", msg = null;

  function loginView(m) {
    root.innerHTML = `<div class="fa-auth glass"><h2>Contenido del sitio</h2><p class="fa-sub-note">Ingresa con la cuenta del equipo de Frío Austral.</p>
      <form id="faLogin" novalidate><label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="fa-err" role="alert" ${m ? "" : "hidden"}>${esc(m || "")}</p><button class="btn btn-red">Ingresar</button></form></div>`;
    const f = $("#faLogin");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(f);
      try { await A.signIn(d.get("email"), d.get("password")); await load(); } catch (ex) { loginView(ex.message); }
    };
  }

  const note = () => (msg ? `<p class="fa-cta-msg ${msg.bad ? "bad" : "ok"}" role="status">${esc(msg.text)}</p>` : "");
  const say = (text, bad) => { msg = { text, bad: !!bad }; };

  function render() {
    root.innerHTML = `
      <div class="fa-acc-head"><div><span class="mono fa-ej">Panel del equipo</span><h2>Contenido del sitio</h2></div>
        <div class="fa-row"><a class="btn btn-line btn-sm" href="equipo.html">← Suscriptores y preguntas</a><button class="btn btn-line btn-sm" id="faOut">Salir</button></div></div>
      ${note()}
      <div class="fa-tabs" role="tablist">${[["material", "Material por plan"], ["fotos", "Fotos y videos"], ["accesos", "Accesos por plan"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}" role="tab">${l}</button>`).join("")}</div>
      <div id="faTabBody">${tab === "material" ? materialView() : tab === "fotos" ? mediaView() : accesosView()}</div>`;
    $("#faOut").onclick = async () => { await A.signOut(); loginView(); };
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = async () => { tab = b.getAttribute("data-tab"); msg = null; await ensure(); render(); }));
    if (tab === "material") bindMaterial(); else if (tab === "fotos") bindMedia(); else bindAccesos();
  }

  async function ensure() {
    try {
      if (tab === "material" && !mats) mats = (await A.api("/api/admin?action=materials")).items;
      if (tab === "fotos" && !media) media = (await A.api("/api/admin?action=media")).items;
      if (tab === "accesos" && !subs) subs = await A.api("/api/admin?action=access-list");
    } catch (e) { say(e.message, true); }
  }

  async function upload(bucketInfo, file) {
    const c = await A.client();
    const { error } = await c.storage.from(bucketInfo.bucket).uploadToSignedUrl(bucketInfo.path, bucketInfo.token, file, { contentType: bucketInfo.contentType });
    if (error) throw new Error("No pudimos subir el archivo. Revisa tu conexión e intenta de nuevo.");
  }

  /* ---------------- Material por plan ---------------- */
  const planBoxes = (name, sel) => PK.map((k) => `<label class="fa-check"><input type="checkbox" name="${name}" value="${k}" ${sel.includes(k) ? "checked" : ""}> ${esc(pname(k))}</label>`).join("");
  const catOpts = (sel) => Object.keys(CAT).map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${CAT[k]}</option>`).join("");

  function materialView() {
    const list = (mats || []).map((m) => `
      <details class="fa-q fa-mat-item" data-id="${esc(m.id)}">
        <summary><b>${esc(m.title)}</b> <span class="fa-pill">${esc(CAT[m.category] || m.category)}</span> ${m.plans.map((p) => `<span class="fa-pill fa-ok">${esc(pname(p))}</span>`).join(" ")} ${m.published ? "" : `<span class="fa-pill fa-warn">Oculto</span>`}
          <small class="fa-sub-note">${esc(m.fileName)}${m.size != null ? " · " + fsize(m.size) : ""} · ${fdate(m.createdAt)}</small></summary>
        <form class="fa-mat-edit" data-edit="${esc(m.id)}">
          <label>Título<input name="title" maxlength="160" value="${esc(m.title)}" required></label>
          <label>Descripción (opcional)<textarea name="description" rows="2" maxlength="1000">${esc(m.description)}</textarea></label>
          <label>Categoría<select name="category">${catOpts(m.category)}</select></label>
          <fieldset><legend>Lo ven los suscriptores de</legend>${planBoxes("plans", m.plans)}</fieldset>
          <label class="fa-check"><input type="checkbox" name="published" ${m.published ? "checked" : ""}> Visible para los suscriptores</label>
          <div class="fa-row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-red btn-sm">Guardar cambios</button><button type="button" class="btn btn-line btn-sm fa-danger" data-del="${esc(m.id)}">Eliminar material</button></div>
        </form>
      </details>`).join("") || `<p class="fa-sub-note">Todavía no hay material subido.</p>`;
    return `<section class="fa-card glass"><span class="fa-ej mono">Subir material nuevo</span>
        <p class="fa-sub-note">Solo lo ven y descargan los suscriptores con el plan al que lo asignes y con su suscripción vigente. Archivos: PDF, EPUB, ZIP, Word, Excel, PowerPoint, texto, imagen o video, hasta 50 MB.</p>
        <form id="faMatNew" class="fa-mat-edit">
          <label>Archivo<input type="file" name="file" required accept=".pdf,.epub,.zip,.docx,.xlsx,.pptx,.txt,.jpg,.jpeg,.png,.webp,.mp4,.webm"></label>
          <label>Título<input name="title" maxlength="160" required placeholder="Ej.: Ebook de gases refrigerantes"></label>
          <label>Descripción (opcional)<textarea name="description" rows="2" maxlength="1000"></textarea></label>
          <label>Categoría<select name="category" id="faMatCat">${catOpts("ebook")}</select></label>
          <fieldset><legend>Lo ven los suscriptores de</legend>${planBoxes("plans", ["premium"])}</fieldset>
          <p class="fa-err" id="faMatErr" role="alert" hidden></p>
          <div><button class="btn btn-red btn-sm" id="faMatGo">Subir material</button> <span class="fa-sub-note" id="faMatProg" hidden>Subiendo…</span></div>
        </form></section>
      <section class="fa-card glass"><span class="fa-ej mono">Material publicado (${(mats || []).length})</span>${list}</section>`;
  }

  const checked = (f, name) => [...f.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);

  function bindMaterial() {
    const f = $("#faMatNew");
    const cat = $("#faMatCat");
    if (cat) cat.onchange = () => { /* ebooks y biblioteca son beneficios del Premium: se sugiere ese plan */ const p = f.querySelectorAll('input[name="plans"]'); if (cat.value === "ebook" || cat.value === "biblioteca") p.forEach((i) => (i.checked = i.value === "premium")); };
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const er = $("#faMatErr"), go = $("#faMatGo"), pr = $("#faMatProg");
      er.hidden = true;
      const d = new FormData(f), file = d.get("file"), plans = checked(f, "plans");
      if (!file || !file.size) return;
      if (!plans.length) { er.hidden = false; er.textContent = "Elige al menos un plan."; return; }
      go.disabled = true; pr.hidden = false;
      try {
        const up = await A.api("/api/admin?action=material-upload-url", { body: { fileName: file.name, contentType: file.type, size: file.size } });
        await upload(up, file);
        await A.api("/api/admin?action=material-save", { body: { path: up.path, fileName: file.name, contentType: up.contentType, size: file.size, title: d.get("title"), description: d.get("description"), category: d.get("category"), plans, published: true } });
        mats = null; say("Material subido. Ya lo ven los suscriptores de los planes elegidos."); await ensure(); render();
      } catch (ex) { er.hidden = false; er.textContent = ex.message; go.disabled = false; pr.hidden = true; }
    };
    root.querySelectorAll("[data-edit]").forEach((form) => (form.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(form), plans = checked(form, "plans");
      if (!plans.length) { say("Elige al menos un plan.", true); render(); return; }
      try {
        await A.api("/api/admin?action=material-update", { body: { id: form.getAttribute("data-edit"), title: d.get("title"), description: d.get("description"), category: d.get("category"), plans, published: !!d.get("published") } });
        mats = null; say("Cambios guardados."); await ensure();
      } catch (ex) { say(ex.message, true); }
      render();
    }));
    root.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Eliminar este material? Los suscriptores dejarán de verlo y el archivo se borra de forma definitiva.")) return;
      try { await A.api("/api/admin?action=material-delete", { body: { id: b.getAttribute("data-del") } }); mats = null; say("Material eliminado."); await ensure(); } catch (ex) { say(ex.message, true); }
      render();
    }));
  }

  /* ---------------- Fotos y videos ---------------- */
  function originalPreview(s) {
    if (s.kind === "video") return `<div class="fa-prev fa-prev-none">Video original del sitio</div>`;
    const b = (s.bases || [])[0];
    return b ? `<img class="fa-prev" src="media/img/${esc(b)}-960.webp" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;fa-prev fa-prev-none&quot;>Imagen original del sitio</div>'">` : `<div class="fa-prev fa-prev-none">Imagen original del sitio</div>`;
  }
  function mediaView() {
    const pages = ["Todas", ...new Set((media || []).map((m) => m.page))];
    const rows = (media || []).filter((m) => pageFilter === "Todas" || m.page === pageFilter).map((m) => `
      <div class="fa-card glass fa-slot" data-slot="${esc(m.id)}">
        <div class="fa-slot-prev">${m.custom ? (m.kind === "video" ? `<video class="fa-prev" src="${esc(m.custom.url)}" controls preload="metadata" muted></video>` : `<img class="fa-prev" src="${esc(m.custom.url)}" alt="" loading="lazy">`) : originalPreview(m)}</div>
        <div><span class="fa-ej mono">${esc(m.page)} · ${m.kind === "video" ? "Video" : "Foto"}</span><h3>${esc(m.label)}</h3>
          <p class="fa-sub-note">${m.custom ? `<span class="fa-pill fa-ok">Archivo nuevo</span> ${m.custom.size != null ? fsize(m.custom.size) + " · " : ""}${fdate(m.custom.updatedAt)}` : `<span class="fa-pill">Original del sitio</span>`}</p>
          ${m.hint ? `<p class="fa-sub-note">${esc(m.hint)}</p>` : ""}</div>
        <form data-up="${esc(m.id)}" class="fa-slot-form"><label>${m.kind === "video" ? "Video nuevo" : "Foto nueva"} <small>(${esc(m.limits)})</small><input type="file" name="file" required accept="${m.kind === "video" ? ".mp4,.webm,video/mp4,video/webm" : ".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"}"></label>
          ${m.kind === "image" ? `<label>Descripción de la foto (para accesibilidad, opcional)<input name="alt" maxlength="300" value="${esc(m.custom ? m.custom.alt : "")}"></label>` : ""}
          <p class="fa-err" hidden role="alert"></p>
          <div class="fa-row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-red btn-sm">Cambiar</button>${m.custom ? `<button type="button" class="btn btn-line btn-sm" data-reset="${esc(m.id)}">Volver al original</button>` : ""}</div></form>
      </div>`).join("");
    return `<p class="fa-sub-note">Cada espacio reemplaza la foto o el video de esa parte de la página. Si no subes nada, o si el archivo nuevo no carga, el sitio sigue mostrando el original. Los cambios se ven en menos de un minuto.</p>
      <label class="fa-inline" style="margin:12px 0">Página <select id="faPageF">${pages.map((p) => `<option ${p === pageFilter ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
      <div class="fa-slots">${rows || `<p class="fa-sub-note">Sin espacios.</p>`}</div>`;
  }
  function bindMedia() {
    const pf = $("#faPageF"); if (pf) pf.onchange = () => { pageFilter = pf.value; render(); };
    root.querySelectorAll("[data-up]").forEach((form) => (form.onsubmit = async (e) => {
      e.preventDefault();
      const slot = form.getAttribute("data-up"), d = new FormData(form), file = d.get("file"), er = $(".fa-err", form), btn = $("button", form);
      if (!file || !file.size) return;
      er.hidden = true; btn.disabled = true; btn.textContent = "Subiendo…";
      try {
        const up = await A.api("/api/admin?action=media-upload-url", { body: { slot, fileName: file.name, contentType: file.type, size: file.size } });
        await upload(up, file);
        await A.api("/api/admin?action=media-save", { body: { slot, path: up.path, fileName: file.name, contentType: up.contentType, size: file.size, alt: d.get("alt") || "" } });
        media = null; say("Listo: el cambio ya está publicado."); await ensure(); render();
      } catch (ex) { er.hidden = false; er.textContent = ex.message; btn.disabled = false; btn.textContent = "Cambiar"; }
    }));
    root.querySelectorAll("[data-reset]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Volver al archivo original del sitio? Se borra el archivo que subiste.")) return;
      try { await A.api("/api/admin?action=media-reset", { body: { slot: b.getAttribute("data-reset") } }); media = null; say("Volvió el archivo original."); await ensure(); } catch (ex) { say(ex.message, true); }
      render();
    }));
  }

  /* ---------------- Accesos por plan: los activa solo el webhook de Hotmart ---------------- */
  const plus = (days) => { const d = new Date(Date.now() + days * 86400000); return d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" }); };
  const ACC_STATUS = { activa: ["Activo", "fa-ok"], cancelada_fin_periodo: ["Cancelado · vigente hasta el fin del período", "fa-warn"], cancelada: ["Desactivado", "fa-bad"] };
  const OUTCOME = { applied: "Aplicado", ignored: "Sin efecto", unmapped: "Producto sin plan", stale: "Evento antiguo", no_email: "Sin correo" };
  function accesosView() {
    const d = subs || { items: [], events: [], hottokConfigured: false };
    const q = subQ.toLowerCase();
    const rows = d.items.filter((r) => !q || (r.email + " " + (r.buyerName || "")).toLowerCase().includes(q)).map((r) => {
      const st = ACC_STATUS[r.status] || [r.status, ""];
      const live = r.active ? st : ["Vencido", "fa-bad"];
      return `<tr><td><b>${esc(r.buyerName || r.email)}</b><br><small class="fa-sub-note">${esc(r.email)}</small></td>
        <td>${esc(r.planName)}<br><span class="fa-pill ${live[1]}">${esc(live[0])}</span></td>
        <td>${r.periodEnd ? esc(fdate(r.periodEnd)) : "—"}</td>
        <td><small class="fa-sub-note">${r.source === "manual" ? "A mano" : "Hotmart"} · ${r.hasAccount ? "ya tiene cuenta" : "aún sin cuenta"}</small></td>
        <td>${r.status !== "cancelada" ? `<button type="button" class="btn btn-line btn-sm fa-danger" data-revoke="${esc(r.id)}">Quitar</button>` : ""}</td></tr>`;
    }).join("");
    const ev = d.events.map((e) => `<tr><td>${esc(fdate(e.received_at, true))}</td><td>${esc(e.event)}</td><td>${esc(e.email || "—")}</td><td>${esc(e.plan ? pname(e.plan) : "—")}</td><td>${esc(OUTCOME[e.outcome] || e.outcome)}</td></tr>`).join("");
    return `<section class="fa-card glass"><span class="fa-ej mono">Suscripciones</span>
      <p class="fa-sub-note">Los planes se pagan en Hotmart y <b>se activan solos</b>: cuando Hotmart confirma el pago, el plan queda activo para el correo del comprador y se vincula a su cuenta cuando entra a <b>Mi cuenta</b> con ese correo. Los reembolsos, cancelaciones y contracargos lo desactivan solos.</p>
      ${d.hottokConfigured ? "" : `<p class="fa-cta-msg bad" role="status">Falta conectar Hotmart: el sitio todavía no tiene el token del webhook (HOTMART_HOTTOK), por eso no se activa ningún plan automáticamente.</p>`}
      <input id="faSubQ" placeholder="Buscar nombre o email" value="${esc(subQ)}">
      <div class="v5-tw"><table class="v5-tab"><thead><tr><th>Cliente</th><th>Plan</th><th>Vigente hasta</th><th>Origen</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="fa-sub-note">Todavía no hay compras confirmadas por Hotmart.</td></tr>`}</tbody></table></div></section>
      <section class="fa-card glass"><span class="fa-ej mono">Últimos avisos de Hotmart</span>
      <div class="v5-tw"><table class="v5-tab"><thead><tr><th>Fecha</th><th>Evento</th><th>Correo</th><th>Plan</th><th>Resultado</th></tr></thead><tbody>${ev || `<tr><td colspan="5" class="fa-sub-note">Aún no ha llegado ningún aviso.</td></tr>`}</tbody></table></div></section>
      <details class="fa-card glass"><summary><b>Respaldo: dar acceso a mano</b></summary>
        <p class="fa-sub-note">Solo si Hotmart no avisó por alguna razón. Escribe el correo con que la persona pagó.</p>
        <form class="fa-grant" id="faGrant"><label class="fa-inline">Correo <input type="email" name="email" required></label>
          <select name="plan">${PK.map((k) => `<option value="${k}">${esc(pname(k))}</option>`).join("")}</select>
          <label class="fa-inline">Hasta <input type="date" name="until" value="${esc(plus(31))}" required></label>
          <button class="btn btn-red btn-sm">Dar acceso</button></form></details>`;
  }
  function bindAccesos() {
    const qi = $("#faSubQ");
    if (qi) qi.oninput = () => { subQ = qi.value.trim(); const pos = qi.selectionStart; render(); const n = $("#faSubQ"); n.focus(); n.setSelectionRange(pos, pos); };
    const f = $("#faGrant");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(f);
      try { await A.api("/api/admin?action=access-grant", { body: { email: d.get("email"), plan: d.get("plan"), until: d.get("until") } }); subs = null; say("Acceso guardado."); await ensure(); } catch (ex) { say(ex.message, true); }
      render();
    };
    root.querySelectorAll("[data-revoke]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Quitar este acceso? La persona deja de ver el material y de poder preguntar.")) return;
      try { await A.api("/api/admin?action=access-revoke", { body: { id: b.getAttribute("data-revoke") } }); subs = null; say("Acceso quitado."); await ensure(); } catch (ex) { say(ex.message, true); }
      render();
    }));
  }

  async function load() {
    root.innerHTML = `<p class="fa-ej mono">Cargando…</p>`;
    try {
      if (!(await A.session())) return loginView();
      await ensure();
      render();
    } catch (e) {
      if (e.status === 401) return loginView();
      if (e.status === 403) { await A.signOut().catch(() => {}); return loginView(e.message); }
      root.innerHTML = `<div class="fa-card glass"><p>${esc(e.message)}</p></div>`;
    }
  }
  load();
})();
