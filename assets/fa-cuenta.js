/* Panel del suscriptor «Mi cuenta» (rediseño): marco propio, enrutador por hash y vistas Inicio, Preguntas, Material,
   Videollamadas (Premium), Preguntas de otros (Premium) y Mi plan. Datos reales vía /api/account.
   Los pagos y el acceso por plan NO se tocan aquí: el plan lo activa el webhook; este archivo solo muestra y pide.
   URLs que no se rompen: mi-cuenta.html, ?compra=ok (retorno del pago), ?registro=1, ?olvide=1, ?recuperar=1#type=recovery. */
(function () {
  const A = window.FAAuth, U = window.FACuentaUtil, C = window.FA_CONFIG || {}, PLANS = C.PLANS || {};
  const { esc, clp } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const root = $("#faCuenta");
  const qs = new URLSearchParams(location.search);
  const WA = "https://wa.me/56987785601";
  const waLink = (t) => WA + "?text=" + encodeURIComponent(t);
  const RANK = (k) => (PLANS[k] ? PLANS[k].amount : 0);
  const SIZE = (n) => U.tamano(n);

  /* ---------- iconos (SVG en línea, trazo 1,9) ---------- */
  const IC = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    library: '<path d="M4 4v16M9 4v16"/><path d="m14 5 4-1 3 15-4 1z"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .8 3 2.700 3 6"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    send: '<path d="m4 12 16-8-6 17-3-7z"/><path d="m11 14 9-10"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    out: '<path d="M10 4H5v16h5"/><path d="M15 8l4 4-4 4M19 12H9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 4 2.500 20h19z"/><path d="M12 10v4.500M12 17.500v.01"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    whatsapp: '<path d="M4 20l1.300-4A8 8 0 1 1 8.200 18.700z"/><path d="M9 9c0 3 3 6 6 6l1-1.500-2-1-1 .7c-.8-.4-1.500-1.100-1.900-1.900l.7-1-1-2z"/>',
  };
  const ic = (n, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[n] || ""}</svg>`;
  const TYPE_IC = { ebook: "book", biblioteca: "library", guia: "file", video: "video", recurso: "file" };

  /* ---------- estado ---------- */
  let me = null, route = "inicio", sub = "", view = null, timer = null, authMode = null;
  let mat = { s: "idle", items: [], err: null, at: 0 };
  let vids = { s: "idle", items: [], err: null };
  const newIds = new Set();
  const email = () => (me && me.subscriber && me.subscriber.email) || localStorage.getItem("fa-ultimo-correo") || "";
  const DRAFT = () => "fa-borrador-" + email();
  const VISTO = () => "fa-visto-" + email();
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } },
  };
  const sub_ = () => me.subscriber;
  const est = () => U.estado(me);
  const isUnread = (m) => m.sender === "equipo" && (m.read === false || (m.read === undefined && (!ls.get(VISTO()) || new Date(m.created_at) > new Date(ls.get(VISTO())))));
  const premiumVideo = () => !!(me.features && me.features.videollamada && me.canAsk);
  const premiumComm = () => !!(me.features && (me.features.ver_preguntas_otros || me.features.community) && me.canAsk);
  const canActive = () => est() === "activo" || est() === "cancelado_vigente";

  function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }

  /* ---------- avisos (región aria-live; los de error no se cierran solos) ---------- */
  function toast(text, opts) {
    const box = $("#pnToasts"); if (!box) return;
    const error = !!(opts && opts.error);
    const t = document.createElement("div");
    t.className = "pn-toast" + (error ? " pn-toast--error" : "");
    t.setAttribute("role", error ? "alert" : "status");
    t.innerHTML = `<span>${esc(text)}</span><button type="button" aria-label="Cerrar aviso">${ic("x", 18)}</button>`;
    $("button", t).onclick = () => t.remove();
    box.appendChild(t);
    if (!error) setTimeout(() => t.remove(), 9000);
  }

  /* ---------- ventanas (dialog nativo: atrapa el foco, Esc cierra y devuelve el foco) ---------- */
  const isWide = () => window.matchMedia("(min-width: 1024px)").matches;
  function openDialog(o) {
    const opener = document.activeElement;
    const d = document.createElement("dialog");
    d.className = "pn-dlg " + (o.cls || "");
    d.setAttribute("aria-labelledby", o.labelId || "pnDlgT");
    d.innerHTML = o.html;
    document.body.appendChild(d);
    d.addEventListener("close", () => { d.remove(); if (opener && opener.focus && document.contains(opener)) opener.focus(); if (o.onClose) o.onClose(); });
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    d.showModal();
    $$("[data-close]", d).forEach((b) => (b.onclick = () => d.close()));
    if (o.onMount) o.onMount(d);
    const f = o.focus && $(o.focus, d);
    if (f) f.focus();
    return d;
  }
  const dlgHead = (title, id) => `<div class="pn-dlg-head"><h2 class="pn-h2" id="${id || "pnDlgT"}">${esc(title)}</h2><button type="button" class="pn-x" data-close aria-label="Cerrar">${ic("x", 20)}</button></div>`;
  function confirmDialog(o) {
    return new Promise((res) => {
      let ok = false;
      openDialog({
        cls: "", focus: "[data-ok]", labelId: "pnCfT",
        html: `<div class="pn-dlg-in">${dlgHead(o.title, "pnCfT")}${o.text ? `<p>${esc(o.text)}</p>` : ""}
          <div class="pn-row"><button type="button" class="pn-btn ${o.danger ? "pn-btn--solid-danger" : "pn-btn--primary"}" data-ok>${esc(o.ok || "Aceptar")}</button><button type="button" class="pn-btn pn-btn--ghost" data-close>${esc(o.cancel || "Volver")}</button></div></div>`,
        onMount: (d) => { $("[data-ok]", d).onclick = () => { ok = true; d.close(); }; },
        onClose: () => res(ok),
      });
    });
  }

  /* teclado del celular: la hoja inferior sube sobre él */
  if (window.visualViewport) {
    const f = () => { const v = window.visualViewport; document.documentElement.style.setProperty("--kb", Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop)) + "px"); };
    window.visualViewport.addEventListener("resize", f); window.visualViewport.addEventListener("scroll", f);
  }

  /* ---------- errores en lenguaje simple ---------- */
  function ctxErr(extra) {
    const q = me && me.quota;
    const to = (q && q.periodTo) || (me && sub_().periodEnd);
    return Object.assign({ limite: q && q.limit, fechaRenovacion: to ? U.fechaLarga(to) : "" }, extra || {});
  }
  const actionLink = (a) => a === "renovar" ? ` <a href="planes.html">Renovar mi plan</a>` : a === "planes" ? ` <a href="planes.html">Ver planes</a>` : "";
  /* show(texto, html) muestra el error junto a la acción. Devuelve true si la sesión se cerró. */
  function fail(ex, show, extra) {
    const m = U.mensajeError(ex, ctxErr(extra));
    if (m.accion === "reingresar") { sessionLost(m.texto); return true; }
    if (show) show(m); else toast(m.texto, { error: true });
    return false;
  }
  const errHTML = (m) => esc(m.texto) + actionLink(m.accion);
  async function sessionLost(texto) {
    stopPoll();
    await A.signOut().catch(() => {});
    $$("dialog[open]").forEach((d) => d.close());
    me = null; view = null;
    loginView(null, texto);
  }

  /* =====================================================================
     INGRESO · CREAR CUENTA · OLVIDÉ MI CONTRASEÑA · RESTABLECER
     ===================================================================== */
  const brandAuth = `<a class="pn-auth-brand" href="index.html"><img src="assets/logo-frio-austral-88.webp" alt="" width="48" height="48"><b>Frío Austral</b></a>`;
  const passField = (id, label, auto, extra) => `<div class="pn-field"><label for="${id}">${label}</label><div class="pn-pass"><input class="pn-input" id="${id}" name="password" type="password" autocomplete="${auto}" ${extra || ""} required aria-describedby="${id}Err"><button type="button" data-show aria-controls="${id}" aria-pressed="false">Mostrar contraseña</button></div><p class="pn-field-err" id="${id}Err" role="alert" hidden></p></div>`;
  function bindShow(f) {
    $$("[data-show]", f).forEach((b) => (b.onclick = () => {
      const i = $("#" + b.getAttribute("aria-controls")), on = i.type === "password";
      i.type = on ? "text" : "password"; b.textContent = on ? "Ocultar contraseña" : "Mostrar contraseña"; b.setAttribute("aria-pressed", String(on));
    }));
  }
  function fieldErr(f, name, text) {
    const i = $(`[name="${name}"]`, f); if (!i) return false;
    const p = $("#" + i.id + "Err", f) || $(`#${i.id}Err`);
    if (!p) return false;
    p.textContent = text; p.hidden = false; i.setAttribute("aria-invalid", "true"); i.focus();
    return true;
  }
  function loginView(msg, aviso) {
    stopPoll();
    document.title = "Ingresar · Frío Austral";
    if (!authMode) authMode = qs.get("olvide") === "1" ? "forgot" : (qs.get("compra") || qs.get("registro") === "1") ? "signup" : "login";
    const mode = authMode, fromPago = qs.get("compra") === "ok";
    const heads = { login: "Ingresa a tu cuenta", signup: "Crea tu cuenta", forgot: "Recupera tu contraseña" };
    const subs = {
      login: "Usa el correo y la contraseña con que creaste tu cuenta.",
      signup: "Usa el <b>mismo correo con el que pagaste</b>. Así activamos tu plan y ves tu material.",
      forgot: "Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.",
    };
    root.innerHTML = `<div class="pn-auth-page"><main class="pn-auth pn-card" id="pn-main" tabindex="-1">
      ${brandAuth}
      ${fromPago ? `<div class="pn-thanks" role="status"><b>¡Gracias por tu compra!</b> Para entrar a tu plan, crea tu cuenta con el mismo correo con el que pagaste. Si ya tienes cuenta, ingresa.</div>` : ""}
      ${aviso ? `<div class="pn-notice pn-notice--info" role="status"><span>${esc(aviso)}</span></div>` : ""}
      <h1 class="pn-h2">${heads[mode]}</h1>
      <p class="pn-muted">${subs[mode]}</p>
      <form id="faLoginForm" novalidate>
        ${mode === "signup" ? `<div class="pn-field"><label for="aNombre">Tu nombre</label><input class="pn-input" id="aNombre" name="nombre" autocomplete="name" required aria-describedby="aNombreErr"><p class="pn-field-err" id="aNombreErr" role="alert" hidden></p></div>` : ""}
        <div class="pn-field"><label for="aEmail">${mode === "signup" ? "Correo (el mismo del pago)" : "Correo"}</label><input class="pn-input" id="aEmail" name="email" type="email" inputmode="email" autocomplete="${mode === "signup" ? "email" : "username"}" autocapitalize="none" spellcheck="false" required aria-describedby="aEmailErr"><p class="pn-field-err" id="aEmailErr" role="alert" hidden></p></div>
        ${mode === "forgot" ? "" : passField("aPass", mode === "signup" ? "Crea una contraseña (mínimo 8 caracteres)" : "Contraseña", mode === "signup" ? "new-password" : "current-password", mode === "signup" ? 'minlength="8"' : "")}
        <p class="pn-err" id="aErr" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>
        <p class="pn-ok" id="aOk" role="status" hidden></p>
        <button class="pn-btn pn-btn--primary pn-btn--lg" type="submit">${{ login: "Ingresar", signup: "Crear mi cuenta", forgot: "Enviar enlace" }[mode]}</button>
      </form>
      <div class="pn-auth-links">
        ${mode === "login" ? `<button type="button" class="pn-link" data-mode="forgot">Olvidé mi contraseña</button><button type="button" class="pn-link" data-mode="signup">Crear mi cuenta</button>` : ""}
        ${mode === "signup" ? `<button type="button" class="pn-link" data-mode="login">Ya tengo cuenta: ingresar</button>` : ""}
        ${mode === "forgot" ? `<button type="button" class="pn-link" data-mode="login">Volver a ingresar</button>` : ""}
        <a class="pn-link" href="planes.html">Ver planes</a><a class="pn-link" href="index.html">Ir al sitio</a>
      </div></main></div>`;
    $$("[data-mode]", root).forEach((b) => (b.onclick = () => { authMode = b.getAttribute("data-mode"); loginView(); }));
    const f = $("#faLoginForm"); bindShow(f);
    const eml = ls.get("fa-ultimo-correo"); if (eml && mode !== "signup") $("#aEmail").value = eml;
    ($("#aEmail").value ? ($("#aPass") || $("#aEmail")) : (mode === "signup" ? $("#aNombre") : $("#aEmail"))).focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(f), btn = $("button[type=submit]", f), err = $("#aErr"), ok = $("#aOk");
      err.hidden = true; ok.hidden = true; $$("[aria-invalid]", f).forEach((i) => { i.removeAttribute("aria-invalid"); });
      $$(".pn-field-err", f).forEach((p) => (p.hidden = true));
      const mail = String(d.get("email") || "").trim(), password = String(d.get("password") || "");
      if (!mail) { fieldErr(f, "email", "Escribe tu correo."); return; }
      if (mode === "signup" && !String(d.get("nombre") || "").trim()) { fieldErr(f, "nombre", "Escribe tu nombre."); return; }
      if (mode !== "forgot" && !password) { fieldErr(f, "password", "Escribe tu contraseña."); return; }
      if (mode === "signup" && password.length < 8) { fieldErr(f, "password", "La contraseña debe tener al menos 8 caracteres."); return; }
      btn.disabled = true;
      try {
        if (mode === "forgot") {
          await A.resetPassword(mail);
          ok.hidden = false; ok.textContent = "Si el correo tiene cuenta, te llegará un mensaje en unos minutos. Revisa también la carpeta de spam.";
        } else {
          if (mode === "signup") await A.api("/api/account?action=signup", { body: { nombre: String(d.get("nombre")).trim(), email: mail, password } });
          await A.signIn(mail, password);
          ls.set("fa-ultimo-correo", mail.toLowerCase());
          authMode = null;
          history.replaceState(null, "", "mi-cuenta.html" + (location.hash && !/type=/.test(location.hash) ? location.hash : ""));
          await load();
        }
      } catch (ex) {
        const m = U.mensajeError(ex, {});
        const field = ex.code === "email_exists" || ex.code === "email" ? "email" : ["weak_password", "password", "login"].includes(ex.code) ? "password" : ex.code === "nombre" ? "nombre" : null;
        if (!(field && fieldErr(f, field, m.texto))) { err.hidden = false; err.textContent = m.texto; }
      }
      btn.disabled = false;
      if (btn.isConnected) btn.textContent = { login: "Ingresar", signup: "Crear mi cuenta", forgot: "Enviar enlace" }[mode];
    };
  }

  function recoverView() {
    stopPoll();
    root.innerHTML = `<div class="pn-auth-page"><main class="pn-auth pn-card" id="pn-main" tabindex="-1">${brandAuth}
      <h1 class="pn-h2">Crea tu nueva contraseña</h1>
      <form id="faRecForm" novalidate>${passField("rPass", "Nueva contraseña (mínimo 8 caracteres)", "new-password", 'minlength="8"')}
        <button class="pn-btn pn-btn--primary pn-btn--lg" type="submit">Guardar contraseña</button></form></main></div>`;
    const f = $("#faRecForm"); bindShow(f); $("#rPass").focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const p = String(new FormData(f).get("password") || "");
      if (p.length < 8) { fieldErr(f, "password", "La contraseña debe tener al menos 8 caracteres."); return; }
      try { await A.updatePassword(p); history.replaceState(null, "", "mi-cuenta.html"); await load(); }
      catch (ex) { fieldErr(f, "password", ex.message || "No pudimos guardar la contraseña. Inténtalo de nuevo."); }
    };
  }

  /* =====================================================================
     MARCO: barra superior, navegación (escritorio) y barra inferior (celular)
     ===================================================================== */
  const ROUTES = ["inicio", "preguntas", "material", "videollamadas", "comunidad", "plan"];
  const LABEL = { inicio: "Inicio", preguntas: "Preguntas", material: "Material", videollamadas: "Videollamadas", comunidad: "Preguntas de otros", plan: "Mi plan" };
  const ICON = { inicio: "home", preguntas: "chat", material: "file", videollamadas: "video", comunidad: "users", plan: "card" };
  function navItems() {
    const it = ["inicio", "preguntas", "material"];
    if (premiumVideo()) it.push("videollamadas");
    if (premiumComm()) it.push("comunidad");
    it.push("plan");
    return it;
  }
  const unread = () => U.respuestasNuevas(me, ls.get(VISTO()));
  function navHTML() {
    const n = unread();
    return navItems().map((r) => `<li><a href="#/${r}" ${r === route ? 'aria-current="page"' : ""}>${ic(ICON[r], 20)}${LABEL[r]}${r === "preguntas" && n ? `<span class="pn-dot" aria-label="${n} respuesta${n > 1 ? "s" : ""} nueva${n > 1 ? "s" : ""}">${n}</span>` : ""}</a></li>`).join("");
  }
  function barHTML() {
    const n = unread(), main = ["inicio", "preguntas", "material"], extra = navItems().filter((r) => !main.includes(r));
    return main.map((r) => `<li><a href="#/${r}" ${r === route ? 'aria-current="page"' : ""}>${ic(ICON[r], 24)}<span>${LABEL[r]}</span>${r === "preguntas" && n ? `<span class="pn-dot" aria-label="${n} nueva${n > 1 ? "s" : ""}">${n}</span>` : ""}</a></li>`).join("")
      + `<li><button type="button" data-act="more" aria-haspopup="dialog" ${extra.includes(route) ? 'aria-current="page"' : ""}>${ic("more", 24)}<span>Más</span></button></li>`;
  }
  function frameHTML() {
    return `<header class="pn-top"><div class="pn-wrap pn-top-in">
        <a class="pn-brand" href="#/inicio" aria-label="Frío Austral, ir al inicio de Mi cuenta"><img src="assets/logo-frio-austral-88.webp" alt="" width="40" height="40"><b>Frío Austral</b></a>
        <button type="button" class="pn-btn pn-btn--primary pn-btn--sm" id="pnAskTop" data-act="ask" hidden>${ic("chat", 20)}Preguntar</button>
        <a class="pn-top-link" href="index.html">Ir al sitio</a>
        <div class="pn-menu"><button type="button" class="pn-menu-btn" id="pnMenuBtn" aria-expanded="false" aria-controls="pnMenuPop" aria-haspopup="true"><span id="pnWho"></span>${ic("arrow", 16)}</button>
          <div class="pn-menu-pop" id="pnMenuPop" hidden><a href="#/plan">${ic("card", 20)}Mi plan</a><button type="button" data-act="signout">${ic("out", 20)}Cerrar sesión</button></div></div>
      </div>
      <nav class="pn-nav" aria-label="Secciones"><div class="pn-wrap"><ul id="pnNav"></ul></div></nav></header>
      <main class="pn-main" id="pn-main" tabindex="-1"><div class="pn-wrap" id="pnView"></div></main>
      <nav class="pn-bar" aria-label="Navegación inferior"><ul id="pnBar"></ul></nav>`;
  }
  let framed = false;
  function mountFrame() {
    root.innerHTML = frameHTML(); framed = true;
    const b = $("#pnMenuBtn"), pop = $("#pnMenuPop");
    const close = () => { pop.hidden = true; b.setAttribute("aria-expanded", "false"); };
    b.onclick = () => { const open = pop.hidden; pop.hidden = !open; b.setAttribute("aria-expanded", String(open)); };
    document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest(".pn-menu")) close(); });
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); b.focus(); } });
    pop.addEventListener("click", close);
  }
  function updateFrame() {
    if (!framed) return;
    setHTML($("#pnNav"), navHTML()); setHTML($("#pnBar"), barHTML());
    const s = sub_();
    $("#pnWho").textContent = U.primerNombre(s.nombre, s.email);
    $("#pnAskTop").hidden = !(me.canAsk && route !== "inicio");
  }

  /* ---------- enrutador por hash ---------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "").split("?")[0], [r, s] = h.split("/");
    return { r: ROUTES.includes(r) ? r : "inicio", s: s || "" };
  }
  function show(first) {
    let { r, s } = parseHash();
    if ((r === "videollamadas" && !premiumVideo()) || (r === "comunidad" && !premiumComm())) { r = "inicio"; s = ""; history.replaceState(null, "", "#/inicio"); }
    if (view && view.unmount) view.unmount();
    route = r; sub = s; view = VIEWS[r];
    const el = $("#pnView"); el.innerHTML = ""; el._h = null;
    view.mount(el, s);
    updateFrame();
    document.title = (r === "inicio" ? "Inicio" : LABEL[r]) + " · Mi cuenta · Frío Austral";
    if (!(r === "plan" && s) && !(r === "preguntas")) window.scrollTo(0, 0);
    if (!first) { const h = $("h1", el); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
  }
  window.addEventListener("hashchange", () => { if (me && framed) show(); });

  /* ---------- clics (delegados: sirven aunque una zona se vuelva a pintar) ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t || !me) return;
    const a = t.getAttribute("data-act");
    if (a === "ask") return openAsk();
    if (a === "more") return openMore();
    if (a === "signout") return signOut();
    if (a === "refresh") return refresh(false, t);
    if (a === "retry-mat") return loadMaterials(true);
    if (a === "retry-vid") return loadVideos(true);
    if (a === "open") return openMaterial(t.getAttribute("data-id"), "open", t);
    if (a === "dl") return openMaterial(t.getAttribute("data-id"), "dl", t);
    if (view && view.click) view.click(a, t, e);
  });

  async function signOut() {
    stopPoll();
    try { await A.signOut(); } catch (e) { /* ya estaba cerrada */ }
    Object.keys(localStorage).filter((k) => /^fa-(borrador|visto)-/.test(k)).forEach((k) => ls.del(k));
    me = null; view = null; framed = false; mat = { s: "idle", items: [], err: null, at: 0 }; vids = { s: "idle", items: [], err: null }; newIds.clear();
    history.replaceState(null, "", "mi-cuenta.html");
    authMode = "login"; loginView();
  }
  function openMore() {
    const extra = navItems().filter((r) => !["inicio", "preguntas", "material"].includes(r));
    openDialog({
      cls: "pn-sheet", labelId: "pnMoreT", focus: "a,button[data-act]",
      html: `<div class="pn-dlg-in">${dlgHead("Más", "pnMoreT")}<div class="pn-more">
        ${extra.map((r) => `<a href="#/${r}" data-close>${ic(ICON[r])}${LABEL[r]}</a>`).join("")}
        <a href="index.html">${ic("globe")}Ir al sitio</a>
        <button type="button" data-act="signout" data-close>${ic("out")}Cerrar sesión</button></div></div>`,
    });
  }

  /* =====================================================================
     DATOS: sesión, refresco automático, material y videollamadas
     ===================================================================== */
  function stopPoll() { if (timer) clearInterval(timer); timer = null; }
  function startPoll() {
    stopPoll();
    timer = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 30000);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && me) refresh(true); });

  /* Trae `me` y actualiza solo lo que cambió (no repinta lo que la persona está escribiendo). */
  async function refresh(quiet, btn) {
    if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = "Actualizando…"; }
    try {
      const before = est(), hadPlan = sub_().hasSubscription;
      const next = await A.api("/api/account?action=me");
      me = next;
      if (!hadPlan && sub_().hasSubscription) toast("¡Tu plan ya está activo!");
      if (before !== est() && canActive() && mat.s !== "loading") loadMaterials(true);
      if (view && view.update) view.update();
      updateFrame();
    } catch (ex) {
      if (!quiet) fail(ex);
      else if (ex.status === 401) sessionLost(U.mensajeError(ex).texto);
    }
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.t; }
  }

  async function loadMaterials(force) {
    if (!me || !me.canAsk) return;
    if (!force && (mat.s === "loading" || (mat.s === "ok" && Date.now() - mat.at < 60000))) return;
    if (mat.s !== "ok") mat.s = "loading";
    if (view && view.update) view.update();
    try { const out = await A.api("/api/account?action=materials"); mat = { s: "ok", items: out.items || [], err: null, at: Date.now() }; }
    catch (ex) { if (ex.status === 401) return sessionLost(U.mensajeError(ex).texto); mat = { s: "error", items: mat.items, err: U.mensajeError(ex, { material: true }), at: 0 }; }
    if (view && view.update) view.update();
  }
  async function loadVideos(force) {
    if (!me || !premiumVideo()) return;
    if (!force && (vids.s === "loading" || vids.s === "ok")) return;
    if (vids.s !== "ok") vids.s = "loading";
    if (view && view.update) view.update();
    try { const out = await A.api("/api/account?action=videos"); vids = { s: "ok", items: out.items || [], err: null }; }
    catch (ex) { if (ex.status === 401) return sessionLost(U.mensajeError(ex).texto); vids = { s: "error", items: vids.items, err: U.mensajeError(ex) }; }
    if (view && view.update) view.update();
  }

  /* Abrir material: la pestaña se abre en el mismo gesto del clic y luego recibe la dirección (así no la bloquea el navegador). */
  async function openMaterial(id, mode, btn) {
    const m = (mat.items || []).find((x) => x.id === id); if (!m) return;
    const verEnPestana = mode === "open" && U.seAbreEnNavegador(m);
    let w = null;
    if (verEnPestana) {
      w = window.open("", "_blank");
      if (w) { try { w.opener = null; w.document.title = "Abriendo…"; w.document.body.style.cssText = "background:#05070b;color:#eef4f8;font:18px sans-serif;padding:32px"; w.document.body.textContent = "Abriendo tu material…"; } catch (e) { /* otra ventana */ } }
    }
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Abriendo…";
    try {
      const r = await A.api("/api/account?action=material-url", { body: { id, inline: verEnPestana } });
      if (verEnPestana && w) w.location.href = r.url;
      else if (verEnPestana) { toast("Tu navegador no dejó abrir otra pestaña. Abrimos el archivo en esta."); setTimeout(() => (location.href = r.url), 1200); }
      else { const a = document.createElement("a"); a.href = r.url; a.download = m.fileName || ""; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
    } catch (ex) {
      if (w) w.close();
      fail(ex, (mm) => toast(mm.texto, { error: true }), { material: true });
    }
    if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
  }

  /* =====================================================================
     PREGUNTAR: cuadro de pregunta (hoja inferior en celular, panel lateral en escritorio) y caja de la vista Preguntas
     ===================================================================== */
  const GUIDE_TEXT = "Vehículo: \nSíntoma: \nQué ya revisaste: ";
  const quotaLine = () => {
    const q = me.quota;
    return q.unlimited ? "Preguntas ilimitadas." : q.left === 1 ? "Te queda 1 pregunta este período." : `Te quedan ${q.left} preguntas este período.`;
  };
  function composerHTML(id, compact) {
    return `<form class="pn-compose ${compact ? "pn-compose--sticky pn-compose--compact" : ""}" data-composer novalidate>
      <label class="pn-label" for="${id}">¿Qué quieres preguntar?</label>
      ${compact
        ? `<p class="pn-guide pn-guide--line" id="${id}G"><b>Vehículo:</b> marca, modelo y año · <b>Síntoma:</b> qué hace o no hace · <b>Qué ya revisaste</b></p>`
        : `<ul class="pn-guide" id="${id}G"><li><b>Vehículo:</b> marca, modelo y año</li><li><b>Síntoma:</b> qué hace o no hace</li><li><b>Qué ya revisaste</b></li></ul>`}
      <textarea class="pn-textarea" id="${id}" maxlength="4000" rows="${compact ? 2 : 4}" placeholder="${compact ? "Vehículo (marca, modelo y año), síntoma y qué ya revisaste" : "Cuéntanos qué vehículo tienes y qué le pasa"}" aria-describedby="${id}G ${id}Q ${id}E"></textarea>
      <p class="pn-small pn-muted" id="${id}Q" data-quota>${esc(quotaLine())} <span data-count></span></p>
      <p class="pn-err" id="${id}E" role="alert" hidden></p>
      <div class="pn-row pn-row--end"><span class="pn-row"><button type="button" class="pn-btn pn-btn--ghost pn-btn--sm" data-guide>Insertar guía</button><span class="pn-small pn-muted pn-hide-sm">Atajo: Ctrl + Enter</span></span><button type="submit" class="pn-btn pn-btn--primary">${ic("send", 20)}Enviar pregunta</button></div>
    </form>`;
  }
  function bindComposer(form, dlg) {
    const ta = $("textarea", form), err = $("[role=alert]", form), btn = $("button[type=submit]", form), count = $("[data-count]", form);
    ta.value = ls.get(DRAFT()) || "";
    const upd = () => { const n = ta.value.length; count.textContent = n >= 3500 ? `${n} de 4.000 caracteres.` : ""; };
    const autosize = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, Math.round(window.innerHeight * 0.5)) + "px"; };
    ta.addEventListener("input", () => { if (ta.value) ls.set(DRAFT(), ta.value); else ls.del(DRAFT()); upd(); autosize(); err.hidden = true; });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
    $("[data-guide]", form).onclick = () => { ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, "") + "\n\n" + GUIDE_TEXT : GUIDE_TEXT; ta.dispatchEvent(new Event("input")); ta.focus(); ta.setSelectionRange(10, 10); };
    upd(); autosize();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = ta.value.trim();
      const showErr = (m) => { err.hidden = false; err.innerHTML = errHTML(m); };
      if (!body) { showErr({ texto: "Escribe tu pregunta." }); ta.focus(); return; }
      if (body.length > 4000) { showErr(U.mensajeError({ code: "too_long", status: 400 })); return; }
      if (!me.quota.unlimited && me.quota.left === 1 && !(await confirmDialog({ title: "Esta es tu última pregunta de este período", text: "¿Enviar?", ok: "Enviar", cancel: "Volver" }))) return;
      btn.disabled = true; btn.lastChild.textContent = "Enviando…"; err.hidden = true;
      try {
        const out = await A.api("/api/account?action=message", { body: { body } });
        ls.del(DRAFT()); ta.value = ""; autosize(); upd();
        me.quota = out.quota || me.quota;
        if (out.message) me.messages.push(Object.assign({ read: true }, out.message));
        toast("Pregunta enviada. Verás la respuesta aquí.");
        updateFrame();
        if (dlg) { dlg.close(); if (route !== "preguntas") location.hash = "#/preguntas"; else if (view.update) view.update(true); }
        else if (view && view.update) view.update(true);
        else refresh(true);
      } catch (ex) { fail(ex, showErr); }
      btn.disabled = false; if (btn.isConnected) btn.lastChild.textContent = "Enviar pregunta";
    };
    return ta;
  }
  function blockedHTML() {
    const st = est(), q = me.quota, to = (q && q.periodTo) || sub_().periodEnd;
    if (st === "verificando") return { texto: "Tu pago está en verificación. Cuando se active tu plan podrás preguntar aquí.", btn: `<button type="button" class="pn-btn pn-btn--primary" data-act="refresh">Actualizar</button><a class="pn-btn pn-btn--ghost" href="planes.html">Ver planes</a>` };
    if (st === "vencido") return { texto: "Tu suscripción no está activa. Renueva tu plan para seguir.", btn: `<a class="pn-btn pn-btn--primary" href="planes.html">Renovar mi plan</a>` };
    return { texto: `Usaste tus ${q.limit} preguntas de este período.${to ? " Se renuevan el " + U.fechaLarga(to) + "." : ""}`, btn: `<a class="pn-btn pn-btn--primary" href="planes.html">Ver planes</a>` };
  }
  function openAsk() {
    if (route === "preguntas" && $("#pqText")) { $("#pqText").focus(); $("#pqText").scrollIntoView({ block: "center" }); return; }
    if (!me.canAsk || U.sinCupo(me)) {
      const b = blockedHTML();
      openDialog({ cls: "", focus: "a,button[data-act]", labelId: "pnBlkT", html: `<div class="pn-dlg-in">${dlgHead("No puedes preguntar ahora", "pnBlkT")}<p>${esc(b.texto)}</p><div class="pn-row">${b.btn}</div></div>`, onMount: (d) => $$("a,button[data-act]", d).forEach((x) => x.addEventListener("click", () => d.close())) });
      return;
    }
    openDialog({
      cls: isWide() ? "pn-side" : "pn-sheet", labelId: "pnAskT",
      html: `<div class="pn-dlg-in">${dlgHead("Preguntar al equipo", "pnAskT")}${composerHTML("pnAskText", false)}</div>`,
      onMount: (d) => { const ta = bindComposer($("[data-composer]", d), d); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); },
    });
  }

  /* =====================================================================
     VISTAS
     ===================================================================== */
  const VIEWS = {};
  const bubble = (m, o) => `<article class="pn-msg ${m.sender === "cliente" ? "pn-msg--me" : "pn-msg--team"}" ${o && o.isNew ? 'data-new tabindex="-1"' : ""}><p ${o && o.clamp ? 'class="pn-clamp"' : ""}>${esc(m.body)}</p><footer><span>${m.sender === "cliente" ? "Tú" : "Equipo Frío Austral"}</span><span>${o && o.day ? esc(U.diaEtiqueta(m.created_at)) + ", " : ""}${U.hora(m.created_at)}</span>${o && o.isNew ? '<span class="pn-pill pn-pill--new">Nueva</span>' : ""}</footer></article>`;
  const skel = (w) => `<span class="pn-skel" style="width:${w}"></span>`;
  const jitUrl = (u) => /^https:\/\/meet\.jit\.si\/frioaustral-[0-9a-f-]{36}$/i.test(String(u || ""));
  const fwhen = (i) => new Date(i).toLocaleString("es-CL", { timeZone: U.TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });

  /* ---------- INICIO ---------- */
  function heroHTML() {
    const s = sub_(), st = est(), q = me.quota, to = s.periodEnd;
    const nombre = U.primerNombre(s.nombre, s.email);
    const badge = `<span class="pn-badge">${esc(s.hasSubscription ? s.planName || "Tu plan" : "Sin plan activo")}</span>`;
    const status = {
      activo: ["ok", "check", "Activo"],
      cancelado_vigente: ["warn", "clock", "Termina el " + U.fechaLarga(to)],
      vencido: ["bad", "alert", "Vencido"],
      verificando: ["warn", "clock", "Pago en verificación"],
    }[st];
    let phrase = "", cta = "";
    if (canActive()) {
      const items = ((PLANS[s.plan] && PLANS[s.plan].benefits) || []).slice(0, 3).map((b) => b.replace(/\.$/, ""));
      phrase = `<div><p class="pn-muted pn-small">Con tu plan puedes:</p><ul class="pn-can">${items.map((i) => `<li>${ic("check", 18)}<span>${esc(i)}</span></li>`).join("")}</ul></div>`;
      cta = U.sinCupo(me)
        ? `<p>Usaste tus ${q.limit} preguntas de este período.${(q.periodTo || to) ? " Se renuevan el " + esc(U.fechaLarga(q.periodTo || to)) + "." : ""}</p><a class="pn-btn pn-btn--primary pn-btn--lg" href="planes.html">Ver planes</a>`
        : `<button type="button" class="pn-btn pn-btn--primary pn-btn--lg" data-act="ask">${ic("chat")}Preguntar al equipo</button>`;
    } else if (st === "vencido") {
      phrase = `<p>Tu acceso terminó${to ? " el " + esc(U.fechaLarga(to)) : ""}. Sin un plan activo no puedes hacer preguntas ni ver el material.</p>`;
      cta = `<a class="pn-btn pn-btn--primary pn-btn--lg" href="planes.html">Renovar mi plan</a>`;
    } else {
      phrase = `<p>Estamos verificando tu pago. Normalmente toma unos minutos.</p>`;
      cta = `<button type="button" class="pn-btn pn-btn--primary pn-btn--lg" data-act="refresh">${ic("refresh")}Actualizar</button><a class="pn-btn pn-btn--ghost" href="planes.html">Ver planes</a>`;
    }
    return `<section class="pn-hero" aria-label="Resumen de tu cuenta"><div class="pn-hero-main">
      <div><h1 class="pn-h1">Hola, <b>${esc(nombre)}</b></h1><p class="pn-muted">${esc(s.email)}</p></div>
      <div class="pn-hero-meta">${badge}<span class="pn-status pn-status--${status[0]}">${ic(status[1], 20)}${esc(status[2])}</span></div>
      ${phrase}</div><div class="pn-hero-cta">${cta}</div></section>`;
  }
  function noticeHTML() {
    const s = sub_(), st = est();
    if (st === "verificando") {
      return `<section class="pn-card pn-wide" aria-labelledby="pnVerT"><h2 class="pn-h3" id="pnVerT">Así sigue tu cuenta</h2>
        <ol class="pn-steps"><li><span class="pn-step-ic pn-step-ic--done">${ic("check", 18)}</span><div><b>Creaste tu cuenta</b><p class="pn-muted pn-small">${esc(s.email)}</p></div></li>
        <li><span class="pn-step-ic pn-step-ic--now">${ic("clock", 18)}</span><div><b>Estamos verificando tu pago</b><p class="pn-muted pn-small">Normalmente toma unos minutos. Esta pantalla se revisa sola.</p></div></li>
        <li><span class="pn-step-ic">3</span><div><b>Plan activo</b><p class="pn-muted pn-small">Podrás preguntar y ver tu material.</p></div></li></ol>
        <p class="pn-small"><b>Usa el mismo correo con el que pagaste.</b></p></section>`;
    }
    if (st === "vencido") {
      return `<div class="pn-notice pn-notice--bad"><div><b>Esto pasa mientras tu plan no está activo</b><p class="pn-muted">No puedes hacer preguntas ni ver el material. Tu historial de conversación sigue visible aquí abajo.</p></div></div>`;
    }
    if (st === "cancelado_vigente") {
      return `<div class="pn-notice"><p><b>Tu plan no se renovará.</b> Tienes acceso hasta el ${esc(U.fechaLarga(s.periodEnd))}.</p><a class="pn-btn pn-btn--ghost pn-btn--sm" href="planes.html">Ver planes</a></div>`;
    }
    return "";
  }
  function cardQuestions() {
    const q = me.quota, to = q.periodTo || sub_().periodEnd;
    const renew = to ? `Se renuevan el ${U.fechaLarga(to)}.` : "";
    if (q.unlimited) return `<article class="pn-card"><span class="pn-kicker">Preguntas</span><div class="pn-num pn-num--word">Ilimitadas</div><p>Llevas ${q.used} en este período.</p><p class="pn-muted pn-small">${esc(renew)}</p></article>`;
    const pct = Math.min(100, Math.round((q.used / Math.max(1, q.limit)) * 100));
    const bar = `<div class="pn-bar-track" role="progressbar" aria-label="Preguntas usadas" aria-valuemin="0" aria-valuemax="${q.limit}" aria-valuenow="${Math.min(q.used, q.limit)}" aria-valuetext="Usaste ${Math.min(q.used, q.limit)} de ${q.limit} preguntas"><i style="width:${pct}%"></i></div>`;
    if (q.left <= 0) return `<article class="pn-card"><span class="pn-kicker">Preguntas</span><p><strong>Usaste tus ${q.limit} preguntas</strong></p>${bar}<p class="pn-muted pn-small">${esc(renew)}</p><div class="pn-card-actions"><a class="pn-btn pn-btn--ghost pn-btn--sm" href="planes.html">Ver planes</a></div></article>`;
    return `<article class="pn-card"><span class="pn-kicker">Preguntas</span><div class="pn-num">${q.left}<small>de ${q.limit} disponibles</small></div>${bar}<p class="pn-muted pn-small">${esc(renew)}</p></article>`;
  }
  function cardRenewal() {
    const s = sub_(), st = est(), p = U.fechaPartes(s.periodEnd);
    const label = st === "cancelado_vigente" ? "Tu acceso termina el" : "Tu plan se renueva el";
    const act = `<div class="pn-card-actions"><a class="pn-btn pn-btn--ghost pn-btn--sm" href="#/plan">Ver mi plan</a></div>`;
    if (!p) return `<article class="pn-card"><span class="pn-kicker">Renovación</span><p class="pn-muted">Todavía no hay una fecha de renovación.</p>${act}</article>`;
    const dias = U.faltan(U.diasHasta(s.periodEnd));
    return `<article class="pn-card"><span class="pn-kicker">${label}</span><div class="pn-num">${esc(p.dia)}<small>${esc(p.mes)}${p.anio ? " " + esc(p.anio) : ""}</small></div><p><strong>${esc(dias)}</strong></p>${act}</article>`;
  }
  function cardReplies() {
    const n = unread();
    if (n > 0) return `<article class="pn-card"><span class="pn-kicker">Respuestas nuevas</span><div class="pn-num">${n}<small>respuesta${n > 1 ? "s" : ""} nueva${n > 1 ? "s" : ""} del equipo</small></div><div class="pn-card-actions"><a class="pn-btn pn-btn--ghost pn-btn--sm" href="#/preguntas">Leer respuesta${n > 1 ? "s" : ""}</a></div></article>`;
    return `<article class="pn-card"><span class="pn-kicker">Respuestas nuevas</span><p><strong>Sin respuestas nuevas</strong></p><p class="pn-muted pn-small">Cuando el equipo te responda, lo verás aquí.</p></article>`;
  }
  function cardMaterial() {
    const head = `<span class="pn-kicker">Último material</span>`;
    if (mat.s === "idle" || (mat.s === "loading" && !mat.items.length)) return `<article class="pn-card" aria-busy="true">${head}${skel("80%")}${skel("55%")}${skel("40%")}</article>`;
    if (mat.s === "error" && !mat.items.length) return `<article class="pn-card">${head}<p><strong>No pudimos cargar esto</strong></p><div class="pn-card-actions"><button type="button" class="pn-btn pn-btn--ghost pn-btn--sm" data-act="retry-mat">Reintentar</button></div></article>`;
    const it = mat.items;
    if (!it.length) return `<article class="pn-card">${head}<p>Todavía no hay material para tu plan. Cuando el equipo suba algo, aparecerá aquí.</p>${me.features && (me.features.ebooks_gratis || me.features.biblioteca) ? `<p class="pn-muted pn-small">Próximamente: los ebooks y la biblioteca de tu plan.</p>` : ""}</article>`;
    const m = it[0];
    return `<article class="pn-card">${head}<h3 class="pn-clamp" style="font:800 20px/1.2 var(--f-body);color:var(--snow)">${esc(m.title)}</h3><p class="pn-muted pn-small">${esc(U.TIPOS[U.tipoDe(m)])} · ${esc(U.fechaLarga(m.createdAt))}</p>
      <div class="pn-card-actions"><button type="button" class="pn-btn pn-btn--ghost pn-btn--sm" data-act="open" data-id="${esc(m.id)}">Abrir</button><a class="pn-link" href="#/material">Ver todo el material (${it.length})</a></div></article>`;
  }
  function videoCardInicio() {
    const now = Date.now() - 2 * 3600000;
    const next = (vids.items || []).filter((v) => v.status === "confirmada" && new Date(v.scheduledAt).getTime() > now).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
    const head = `<span class="pn-kicker">Tu próxima videollamada</span>`;
    if (vids.s === "idle" || (vids.s === "loading" && !vids.items.length)) return `<section class="pn-card pn-wide" aria-busy="true">${head}${skel("40%")}</section>`;
    if (vids.s === "error" && !vids.items.length) return `<section class="pn-card pn-wide">${head}<p><strong>No pudimos cargar esto</strong></p><div><button type="button" class="pn-btn pn-btn--ghost pn-btn--sm" data-act="retry-vid">Reintentar</button></div></section>`;
    if (!next) return `<section class="pn-card pn-wide">${head}<p>Aún no tienes una videollamada confirmada.</p><div><a class="pn-btn pn-btn--ghost pn-btn--sm" href="#/videollamadas">Pedir una videollamada</a></div></section>`;
    const join = next.canJoin && jitUrl(next.url) ? `<a class="pn-btn pn-btn--ghost pn-btn--sm" href="${esc(next.url)}" target="_blank" rel="noopener">Entrar</a>` : `<span class="pn-muted pn-small">Se habilita 10 minutos antes de la hora.</span>`;
    return `<section class="pn-card pn-wide">${head}<p><strong style="font-size:20px">${esc(fwhen(next.scheduledAt))}</strong></p><div class="pn-row">${join}<a class="pn-link" href="#/videollamadas">Ver mis videollamadas</a></div></section>`;
  }
  function lastChatHTML() {
    const ms = me.messages.slice(-2);
    const head = `<h2 class="pn-h3">Tu última conversación</h2>`;
    if (!ms.length) return `<section class="pn-card pn-wide" aria-labelledby="pnLastT">${head.replace("<h2", '<h2 id="pnLastT"')}<p>Aún no has preguntado. Cuéntanos qué vehículo tienes y qué le pasa.</p>${me.canAsk && !U.sinCupo(me) ? `<div><button type="button" class="pn-btn pn-btn--ghost" data-act="ask">${ic("chat", 20)}Preguntar al equipo</button></div>` : ""}</section>`;
    return `<section class="pn-card pn-wide" aria-labelledby="pnLastT">${head.replace("<h2", '<h2 id="pnLastT"')}<div class="pn-chat">${ms.map((m) => bubble(m, { clamp: true, day: true })).join("")}</div><div><a class="pn-btn pn-btn--ghost" href="#/preguntas">Abrir conversación</a></div></section>`;
  }
  VIEWS.inicio = {
    mount(el) {
      el.innerHTML = `<div id="inHero"></div><div id="inNotice"></div><div class="pn-cards" id="inCards"></div><div id="inVideo"></div><div id="inLast" class="pn-wide"></div>`;
      if (me.canAsk) loadMaterials();
      if (premiumVideo()) loadVideos();
      this.update();
    },
    update() {
      setHTML($("#inHero"), heroHTML());
      setHTML($("#inNotice"), noticeHTML());
      const cards = canActive() ? cardQuestions() + cardRenewal() + cardReplies() + cardMaterial() : "";
      const c = $("#inCards"); setHTML(c, cards); c.hidden = !cards;
      setHTML($("#inVideo"), canActive() && premiumVideo() ? `<div class="pn-wide">${videoCardInicio()}</div>` : "");
      setHTML($("#inLast"), lastChatHTML());
    },
  };

  /* ---------- PREGUNTAS ---------- */
  async function markRead() {
    if (markRead.busy) return;
    markRead.busy = true;
    try { await A.api("/api/account?action=read", { body: {} }); }
    catch (ex) { if (ex.status === 401) { markRead.busy = false; return sessionLost(U.mensajeError(ex).texto); } }
    me.unreadReplies = 0;
    me.messages.forEach((m) => { if (m.sender === "equipo") m.read = true; });
    const last = me.messages[me.messages.length - 1];
    if (last) ls.set(VISTO(), last.created_at);
    markRead.busy = false;
    updateFrame();
  }
  VIEWS.preguntas = {
    mount(el) {
      this.first = true; this.el = el;
      el.innerHTML = `<div class="pn-view-head"><div><h1 class="pn-h2">Preguntas</h1><p>Tu conversación con el equipo de Frío Austral.</p></div></div><div class="pn-chat" id="pqChat" role="log" aria-label="Conversación con el equipo"></div><div id="pqCompose"></div>`;
      this.update();
    },
    unmount() { newIds.clear(); },
    update(sent) {
      const unr = me.messages.filter(isUnread);
      unr.forEach((m) => newIds.add(String(m.id)));
      const chat = $("#pqChat"), cmp = $("#pqCompose");
      const near = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 260;
      const prev = chat._h;
      let html;
      if (!me.messages.length) html = `<div class="pn-empty"><p>Aún no has preguntado. Cuéntanos qué vehículo tienes y qué le pasa.</p></div>`;
      else { let day = ""; html = me.messages.map((m) => { const k = U.diaClave(m.created_at); const sep = k !== day ? `<div class="pn-day">${esc(U.diaEtiqueta(m.created_at))}</div>` : ""; day = k; return sep + bubble(m, { isNew: newIds.has(String(m.id)) }); }).join(""); }
      setHTML(chat, html);
      const can = me.canAsk && !U.sinCupo(me), key = can ? "c" : "b" + est() + (me.quota ? me.quota.left : "");
      if (cmp._k !== key) {
        cmp._k = key;
        if (can) { cmp.innerHTML = composerHTML("pqText", true); bindComposer($("[data-composer]", cmp)); }
        else { const b = blockedHTML(); cmp.innerHTML = `<div class="pn-notice pn-notice--info" style="margin-top:24px"><p>${esc(b.texto)}</p><div class="pn-row">${b.btn}</div></div>`; }
      } else if (can) { const q = $("[data-quota]", cmp); if (q && q.firstChild) q.firstChild.textContent = quotaLine() + " "; }
      const last = chat.lastElementChild;
      if (this.first) {
        this.first = false;
        const n = $("[data-new]", chat);
        if (n) { n.scrollIntoView({ block: "center" }); n.focus({ preventScroll: true }); }
        else if (last) last.scrollIntoView({ block: "end" });
      } else if (html !== prev && (sent || near) && last) last.scrollIntoView({ block: "end", behavior: "smooth" });
      if (unr.length && document.visibilityState === "visible") markRead();
    },
  };

  /* ---------- MATERIAL ---------- */
  const matCard = (m) => {
    const t = U.tipoDe(m), ver = U.seAbreEnNavegador(m);
    return `<article class="pn-card pn-mat"><div class="pn-mat-top"><span class="pn-mat-ic">${ic(TYPE_IC[t], 26)}</span>${U.esNuevo(m.createdAt) ? '<span class="pn-pill pn-pill--new">Nuevo</span>' : ""}</div>
      <h3>${esc(m.title)}</h3>${m.description ? `<p class="pn-clamp">${esc(m.description)}</p>` : ""}
      <p class="pn-small pn-muted">${esc(U.TIPOS[t])}${m.size != null ? " · " + esc(SIZE(m.size)) : ""} · ${esc(U.fechaLarga(m.createdAt))}</p>
      <div class="pn-card-actions" style="flex-direction:row;flex-wrap:wrap"><button type="button" class="pn-btn pn-btn--primary pn-btn--sm" data-act="open" data-id="${esc(m.id)}">Abrir</button>${ver ? "" : `<button type="button" class="pn-btn pn-btn--ghost pn-btn--sm" data-act="dl" data-id="${esc(m.id)}">${ic("download", 18)}Descargar</button>`}</div></article>`;
  };
  VIEWS.material = {
    mount(el) {
      this.f = { cat: "todo", q: "" };
      el.innerHTML = `<div class="pn-view-head"><div><h1 class="pn-h2">Material</h1><p>Ebooks, guías y archivos de tu plan. Lo más nuevo va primero.</p></div></div><div id="mChips"></div><div id="mSearch"></div><div id="mList"></div>`;
      loadMaterials(true);
      this.update();
    },
    click(a, t) { if (a === "chip") { const c = t.getAttribute("data-cat"); this.f.cat = c; this.update(); const b = $(`[data-act="chip"][data-cat="${c}"]`); if (b) b.focus(); } },
    update() {
      const list = $("#mList"); if (!list) return;
      const f = this.f;
      const emptyBlocked = () => { const st = est(); return st === "verificando" ? `<div class="pn-empty"><p>Cuando se active tu plan, aquí verás tu material.</p><div class="pn-row"><button type="button" class="pn-btn pn-btn--primary" data-act="refresh">Actualizar</button><a class="pn-btn pn-btn--ghost" href="planes.html">Ver planes</a></div></div>` : `<div class="pn-empty"><p>Tu suscripción no está activa, por eso no puedes ver el material. Renueva tu plan para volver a verlo.</p><a class="pn-btn pn-btn--primary" href="planes.html">Renovar mi plan</a></div>`; };
      if (!me.canAsk) { setHTML($("#mChips"), ""); setHTML($("#mSearch"), ""); return setHTML(list, emptyBlocked()); }
      if (mat.s !== "ok" && !mat.items.length) {
        setHTML($("#mChips"), ""); setHTML($("#mSearch"), "");
        return setHTML(list, mat.s === "error"
          ? `<div class="pn-empty"><p><strong>No pudimos cargar esto</strong></p><p class="pn-muted">${esc(mat.err ? mat.err.texto : "")}</p><button type="button" class="pn-btn pn-btn--ghost" data-act="retry-mat">Reintentar</button></div>`
          : `<div class="pn-grid" aria-busy="true">${[1, 2, 3].map(() => `<div class="pn-card pn-mat">${skel("30%")}${skel("85%")}${skel("60%")}</div>`).join("")}</div>`);
      }
      const items = mat.items;
      if (!items.length) {
        setHTML($("#mChips"), ""); setHTML($("#mSearch"), "");
        return setHTML(list, `<div class="pn-empty"><p>Todavía no hay material para tu plan. Cuando el equipo suba algo, aparecerá aquí.</p>${me.features && (me.features.ebooks_gratis || me.features.biblioteca) ? `<p class="pn-muted">Próximamente: los ebooks y la biblioteca de tu plan.</p>` : ""}</div>`);
      }
      const cats = Object.keys(U.TIPOS).filter((c) => items.some((m) => U.tipoDe(m) === c));
      if (f.cat !== "todo" && !cats.includes(f.cat)) f.cat = "todo";
      setHTML($("#mChips"), `<div class="pn-chips" role="group" aria-label="Filtrar por tipo"><button type="button" class="pn-chip" data-act="chip" data-cat="todo" aria-pressed="${f.cat === "todo"}">Todo <span>${items.length}</span></button>${cats.map((c) => `<button type="button" class="pn-chip" data-act="chip" data-cat="${c}" aria-pressed="${f.cat === c}">${U.TIPOS_PLURAL[c]} <span>${items.filter((m) => U.tipoDe(m) === c).length}</span></button>`).join("")}</div>`);
      const sr = $("#mSearch");
      if (items.length > 8 && !sr.firstChild) {
        sr.innerHTML = `<div class="pn-search"><label class="pn-label" for="mQ">Buscar por título</label><input class="pn-input" id="mQ" type="search" autocomplete="off"></div>`;
        $("#mQ").addEventListener("input", (e) => { this.f.q = e.target.value; this.update(); });
      }
      const q = f.q.trim().toLowerCase();
      const shown = items.filter((m) => (f.cat === "todo" || U.tipoDe(m) === f.cat) && (!q || m.title.toLowerCase().includes(q)));
      setHTML(list, shown.length ? `<div class="pn-grid">${shown.map(matCard).join("")}</div>` : `<div class="pn-empty"><p>No encontramos material con esa búsqueda.</p></div>`);
    },
  };

  /* ---------- VIDEOLLAMADAS (solo Premium) ---------- */
  const VST = { solicitada: ["Esperando confirmación del equipo", "warn", "clock"], propuesta: ["El equipo propone otra hora", "warn", "clock"], confirmada: ["Confirmada", "ok", "check"], cancelada: ["Cancelada", "bad", "x"] };
  function videoCard(v) {
    const s = VST[v.status] || [v.status, "", "clock"];
    let acts = "";
    if (v.status === "confirmada") acts = v.canJoin && jitUrl(v.url) ? `<a class="pn-btn pn-btn--primary pn-btn--sm" href="${esc(v.url)}" target="_blank" rel="noopener">Entrar a la videollamada</a>` : `<button type="button" class="pn-btn pn-btn--ghost pn-btn--sm" disabled>Entrar a la videollamada</button><p class="pn-muted pn-small">Se habilita 10 minutos antes de la hora.</p>`;
    if (v.status === "propuesta") acts = `<button type="button" class="pn-btn pn-btn--primary pn-btn--sm" data-act="video-accept" data-id="${esc(v.id)}">Aceptar esta hora</button>`;
    if (v.status !== "cancelada") acts += `<button type="button" class="pn-btn pn-btn--danger pn-btn--sm" data-act="video-cancel" data-id="${esc(v.id)}">Cancelar</button>`;
    return `<article class="pn-card"><h3 class="pn-q" style="font:800 20px/1.2 var(--f-body)">${esc(fwhen(v.scheduledAt))}</h3><p><span class="pn-pill pn-pill--${s[1]}">${ic(s[2], 16)}${esc(s[0])}</span></p>${v.note ? `<p class="pn-clamp">${esc(v.note)}</p>` : ""}<div class="pn-card-actions" style="flex-direction:row;flex-wrap:wrap;align-items:center">${acts}</div></article>`;
  }
  function openVideoRequest() {
    const pad = (n) => String(n).padStart(2, "0"), iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date(), max = new Date(Date.now() + 90 * 86400000);
    openDialog({
      cls: isWide() ? "" : "pn-sheet", focus: "#vDate", labelId: "pnVidT",
      html: `<div class="pn-dlg-in">${dlgHead("Pedir una videollamada", "pnVidT")}
        <ul class="pn-small pn-muted" style="margin:0;padding-left:20px"><li>Con al menos 30 minutos de anticipación y dentro de los próximos 90 días.</li><li>Puedes tener hasta 2 solicitudes abiertas.</li></ul>
        <form id="vForm" novalidate class="pn-form-grid">
          <div class="pn-field"><label for="vDate">Día</label><input class="pn-input" id="vDate" type="date" min="${iso(today)}" max="${iso(max)}" required></div>
          <div class="pn-field"><label for="vTime">Hora</label><input class="pn-input" id="vTime" type="time" step="900" required></div>
          <div class="pn-field pn-span"><label for="vNote">Tema (opcional)</label><input class="pn-input" id="vNote" maxlength="500" placeholder="Ej.: diagnóstico de compresor en una Hilux 2018"></div>
          <p class="pn-err pn-span" id="vErr" role="alert" hidden></p>
          <div class="pn-span pn-row"><button type="submit" class="pn-btn pn-btn--primary">Solicitar</button><button type="button" class="pn-btn pn-btn--ghost" data-close>Volver</button></div>
        </form></div>`,
      onMount: (d) => {
        const f = $("#vForm", d), err = $("#vErr", d), btn = $("button[type=submit]", f);
        f.onsubmit = async (e) => {
          e.preventDefault(); err.hidden = true;
          const dd = $("#vDate", d).value, tt = $("#vTime", d).value;
          const when = dd && tt ? new Date(`${dd}T${tt}`) : null;
          if (!when || isNaN(when)) { err.hidden = false; err.textContent = "Elige una fecha y hora válidas."; return; }
          btn.disabled = true; btn.textContent = "Enviando…";
          try {
            await A.api("/api/account?action=video-request", { body: { when: when.toISOString(), note: $("#vNote", d).value } });
            d.close(); toast("Solicitud enviada. El equipo te confirma la hora."); vids.s = "idle"; loadVideos(true);
          } catch (ex) { fail(ex, (m) => { err.hidden = false; err.innerHTML = errHTML(m); }); }
          btn.disabled = false; btn.textContent = "Solicitar";
        };
      },
    });
  }
  VIEWS.videollamadas = {
    mount(el) {
      el.innerHTML = `<div class="pn-view-head"><div><h1 class="pn-h2">Videollamadas</h1><p>Habla en vivo con el equipo. Propón un día y una hora y te confirmamos.</p></div><button type="button" class="pn-btn pn-btn--primary" data-act="video-new">Pedir una videollamada</button></div>
        <p class="pn-small pn-muted" style="margin-bottom:20px">Se abre en una pestaña nueva, sin límite de tiempo. El primero del equipo en entrar puede tener que iniciar sesión con Google o GitHub para abrir la sala.</p><div id="vList"></div>`;
      loadVideos(true); this.update();
    },
    async click(a, t) {
      if (a === "video-new") return openVideoRequest();
      const id = t.getAttribute("data-id");
      if (a === "video-cancel" && await confirmDialog({ title: "¿Cancelar esta videollamada?", text: "El equipo verá que ya no la necesitas.", ok: "Cancelar videollamada", cancel: "Volver", danger: true })) return this.act("video-cancel", id, "La videollamada se canceló.");
      if (a === "video-accept") return this.act("video-accept", id, "Listo. La videollamada quedó confirmada.");
    },
    async act(action, id, okText) {
      try { await A.api("/api/account?action=" + action, { body: { id } }); toast(okText); }
      catch (ex) { fail(ex, (m) => toast(m.texto, { error: true })); }
      loadVideos(true);
    },
    update() {
      const box = $("#vList"); if (!box) return;
      if (vids.s === "error" && !vids.items.length) return setHTML(box, `<div class="pn-empty"><p><strong>No pudimos cargar esto</strong></p><p class="pn-muted">${esc(vids.err ? vids.err.texto : "")}</p><button type="button" class="pn-btn pn-btn--ghost" data-act="retry-vid">Reintentar</button></div>`);
      if (vids.s !== "ok") return setHTML(box, `<div class="pn-list" aria-busy="true"><div class="pn-card">${skel("60%")}${skel("40%")}</div><div class="pn-card">${skel("60%")}${skel("40%")}</div></div>`);
      const items = vids.items.slice().sort((a, b) => (a.status === "cancelada") - (b.status === "cancelada") || new Date(b.scheduledAt) - new Date(a.scheduledAt));
      setHTML(box, items.length ? `<div class="pn-list">${items.map(videoCard).join("")}</div>` : `<div class="pn-empty"><p>Aún no tienes videollamadas. Propón un día y hora y el equipo te confirma.</p></div>`);
    },
  };

  /* ---------- PREGUNTAS DE OTROS (solo Premium) ---------- */
  VIEWS.comunidad = {
    mount(el) {
      el.innerHTML = `<div class="pn-view-head"><div><h1 class="pn-h2">Preguntas de otros</h1><p>Consulta lo que el equipo ya respondió a otras personas. Sin nombres ni correos.</p></div></div>
        <div class="pn-search"><label class="pn-label" for="cQ">Busca por síntoma, vehículo o gas</label><input class="pn-input" id="cQ" type="search" autocomplete="off" placeholder="Ej.: compresor que no engancha"></div><div id="cList" aria-live="polite"></div>`;
      let t = null;
      $("#cQ").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => this.search(e.target.value), 400); });
      this.search("");
    },
    async search(q) {
      const box = $("#cList"); if (!box) return;
      const my = (this.n = (this.n || 0) + 1);
      setHTML(box, `<p class="pn-muted" role="status">Buscando…</p>`);
      try {
        const out = await A.api("/api/account?action=community&q=" + encodeURIComponent(q || ""));
        if (my !== this.n) return;
        setHTML(box, out.items.length ? `<div class="pn-list">${out.items.map((i) => `<article class="pn-card pn-q"><h3>${esc(i.pregunta)}</h3><p class="pn-clamp" style="-webkit-line-clamp:6">${esc(i.respuesta)}</p><p class="pn-muted pn-small pn-push">${esc(U.fechaLarga(i.fecha))}</p></article>`).join("")}</div>` : `<div class="pn-empty"><p>Aún no hay resultados para esa búsqueda.</p></div>`);
      } catch (ex) { if (my === this.n) fail(ex, (m) => setHTML(box, `<div class="pn-empty"><p class="pn-err">${errHTML(m)}</p></div>`)); }
    },
  };

  /* ---------- MI PLAN ----------
     Solo muestra el plan. Para cambiarlo o cancelarlo la persona escribe por WhatsApp o por el chat con el equipo. */
  const planKeys = () => Object.keys(PLANS).sort((a, b) => RANK(a) - RANK(b));
  const checkList = (arr) => `<ul>${arr.map((b) => `<li>${ic("check", 18)}<span>${esc(b)}</span></li>`).join("")}</ul>`;
  function planMineHTML() {
    const s = sub_(), st = est(), p = PLANS[s.plan], q = me.quota;
    const estado = { activo: "Activo", cancelado_vigente: "No se renovará", vencido: "Vencido", verificando: "Pago en verificación" }[st];
    if (st === "verificando") return `<section class="pn-card"><h2 class="pn-h3">Aún no tienes un plan activo</h2><p>Estamos verificando tu pago. Normalmente toma unos minutos. Usa el mismo correo con el que pagaste.</p><div class="pn-row"><button type="button" class="pn-btn pn-btn--primary" data-act="refresh">Actualizar</button><a class="pn-btn pn-btn--ghost" href="planes.html">Ver planes</a></div></section>`;
    const cupo = q.unlimited ? "Ilimitadas" : `${q.left} de ${q.limit} disponibles`;
    const fin = st === "vencido" ? "Terminó el" : st === "cancelado_vigente" ? "Acceso hasta" : "Se renueva el";
    return `<section class="pn-card" aria-labelledby="pnMiPlanT"><div class="pn-row pn-row--end"><div><span class="pn-kicker">Tu plan</span><h2 class="pn-h2" id="pnMiPlanT">${esc(s.planName || "")}</h2></div><span class="pn-badge">${esc(estado)}</span></div>
      <dl class="pn-dl"><div><dt>Valor</dt><dd>${p ? clp(p.amount) + " al mes" : "—"}</dd></div><div><dt>${fin}</dt><dd>${s.periodEnd ? esc(U.fechaLarga(s.periodEnd)) : "—"}</dd></div>${st === "vencido" ? "" : `<div><dt>Preguntas</dt><dd>${esc(cupo)}</dd></div>`}</dl>
      ${p && st !== "vencido" ? `<div><p class="pn-kicker" style="margin-bottom:8px">Qué incluye</p><div class="pn-plan">${checkList(p.benefits)}</div></div>` : ""}
      ${st === "vencido" ? `<p>Tu acceso terminó. Renueva tu plan para volver a preguntar y ver el material.</p><div><a class="pn-btn pn-btn--primary" href="planes.html">Renovar mi plan</a></div>` : ""}
    </section>`;
  }
  function compareHTML() {
    const s = sub_(); if (!["basico", "pro"].includes(s.plan)) return "";
    const rows = [["Preguntas al equipo", (p) => (p.questionsPerPeriod == null ? "Ilimitadas" : p.questionsPerPeriod + " al mes")], ["Videollamadas de asesoría", (p) => p.videollamada], ["Ver preguntas de otros usuarios", (p) => p.ver_preguntas_otros], ["Ebooks gratis", (p) => p.ebooks_gratis], ["Biblioteca de conocimientos", (p) => p.biblioteca]];
    const cell = (v) => (v === true ? `<span class="pn-status pn-status--ok">${ic("check", 18)}Sí</span>` : v === false ? `<span class="pn-muted">No incluido</span>` : esc(v));
    const keys = planKeys();
    return `<section class="pn-section" aria-labelledby="pnCmpT"><h2 class="pn-h2" id="pnCmpT">Qué incluye cada plan</h2><div class="pn-card pn-table-wrap"><table class="pn-table"><thead><tr><th scope="col">Beneficio</th>${keys.map((k) => `<th scope="col">${esc(PLANS[k].name)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row" style="font-weight:700">${r[0]}</th>${keys.map((k) => `<td>${cell(r[1](PLANS[k]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p style="margin-top:16px"><a class="pn-link" href="planes.html">Ver planes</a></p></section>`;
  }
  VIEWS.plan = {
    mount(el) {
      el.innerHTML = `<div class="pn-view-head"><div><h1 class="pn-h2">Mi plan</h1><p>Tu plan, tu vigencia y qué incluye.</p></div></div><div id="plMine"></div><div id="plRest"></div>`;
      this.update();
    },
    update() {
      setHTML($("#plMine"), planMineHTML());
      const wa = esc(waLink("Hola, quiero consultar por mi plan de suscripción de Frío Austral."));
      const help = `<section class="pn-section"><div class="pn-card pn-card--flat"><h2 class="pn-h3">¿Necesitas ayuda con tu plan?</h2><p>Tu plan se paga de forma segura y se renueva con cada pago. Para cambiarlo o cancelarlo, escríbenos por WhatsApp (+56 9 8778 5601) o pregúntale al equipo en Preguntas.</p><div class="pn-row"><a class="pn-btn pn-btn--ghost" href="${wa}" target="_blank" rel="noopener">${ic("whatsapp", 20)}Escribir por WhatsApp</a>${canActive() ? `<a class="pn-btn pn-btn--ghost" href="#/preguntas">Escribir en Preguntas</a>` : ""}</div></div></section>`;
      setHTML($("#plRest"), (canActive() ? compareHTML() : "") + help);
    },
  };

  /* =====================================================================
     ARRANQUE
     ===================================================================== */
  async function load() {
    root.innerHTML = `<div class="pn-boot" role="status">Cargando tu cuenta…</div>`;
    try {
      const sess = await A.session();
      if (!sess) return loginView();
      me = await A.api("/api/account?action=me");
      ls.set("fa-ultimo-correo", String(sub_().email || "").toLowerCase());
      mat = { s: "idle", items: [], err: null, at: 0 }; vids = { s: "idle", items: [], err: null };
      mountFrame(); show(true); startPoll();
      if (qs.get("compra") === "ok") { toast("¡Gracias por tu compra!"); history.replaceState(null, "", "mi-cuenta.html" + location.hash); }
    } catch (ex) {
      if (ex.status === 401) { await A.signOut().catch(() => {}); return loginView(null, U.mensajeError(ex).texto); }
      const m = U.mensajeError(ex);
      root.innerHTML = `<div class="pn-auth-page"><main class="pn-auth pn-card" id="pn-main" tabindex="-1">${brandAuth}<h1 class="pn-h2">No pudimos cargar tu cuenta</h1><p class="pn-muted">${esc(m.texto)}</p><button type="button" class="pn-btn pn-btn--primary pn-btn--lg" id="pnRetry">Reintentar</button></main></div>`;
      $("#pnRetry").onclick = () => load();
    }
  }

  (async () => {
    try {
      const c = await A.client();
      c.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") recoverView(); });
      if (qs.get("recuperar") === "1" && /type=recovery/.test(location.hash)) return recoverView();
    } catch (ex) {
      const m = U.mensajeError(ex);
      root.innerHTML = `<div class="pn-auth-page"><main class="pn-auth pn-card" id="pn-main" tabindex="-1">${brandAuth}<h1 class="pn-h2">No pudimos cargar tu cuenta</h1><p class="pn-muted">${esc(m.texto)}</p><button type="button" class="pn-btn pn-btn--primary pn-btn--lg" onclick="location.reload()">Reintentar</button></main></div>`;
      return;
    }
    load();
  })();
})();
