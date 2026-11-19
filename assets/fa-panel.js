/* Panel del equipo · arranque, ingreso, marco (barra lateral / barra inferior) y enrutador por hash.
   Rutas: #/resumen · #/mensajes[/videollamadas] · #/paginas[/<pagina>] · #/planes · #/accesos */
(function () {
  const FAP = window.FAP, A = FAP.A, { $, $$, esc, ico } = FAP;
  const C = window.FA_CONFIG || {};
  const root = $("#fap");
  const NAV = [["resumen", "Resumen", "home"], ["mensajes", "Mensajes", "chat"], ["paginas", "Páginas del sitio", "photo"], ["planes", "Material de los planes", "folder"], ["accesos", "Accesos", "key"]];
  const SHORT = { resumen: "Resumen", mensajes: "Mensajes", paginas: "Páginas", planes: "Material", accesos: "Accesos" };
  const TITLES = { resumen: "Resumen", mensajes: "Mensajes", paginas: "Páginas del sitio", planes: "Material de los planes", accesos: "Accesos" };
  let email = "", timer = null, cleanup = null, badge = 0, routeAfterLogin = null;
  FAP.state = { email: "" };

  const logo = (n) => `<picture><source type="image/webp" srcset="assets/logo-frio-austral-88.webp 1x, assets/logo-frio-austral-160.webp 2x"><img src="assets/logo-frio-austral.png" alt="" width="${n}" height="${n}"></picture>`;

  /* ---------- ingreso ---------- */
  function loginView(msg, kind) {
    stopTimers();
    root.innerHTML = `<main class="fap-login" id="fapContenido"><div class="fap-card">${logo(72)}<h1>Panel del equipo</h1><p class="fap-help">Ingresa con tu correo y tu contraseña.</p>
      <form id="fapLogin" novalidate>
        <div class="fap-field" id="fCorreo"><label for="lEmail">Correo</label><input id="lEmail" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" required aria-describedby="lErr"></div>
        <div class="fap-field"><label for="lPass">Contraseña</label><div class="fap-pwd"><input id="lPass" name="password" type="password" autocomplete="current-password" required aria-describedby="lErr"><button type="button" class="fap-btn text" id="lShow" aria-pressed="false">Mostrar</button></div></div>
        <p class="fap-err" id="lErr" role="alert" ${msg && kind !== "ok" ? "" : "hidden"}>${esc(kind === "ok" ? "" : msg || "")}</p>
        <p class="fap-help" id="lOk" role="status" ${kind === "ok" ? "" : "hidden"}>${esc(kind === "ok" ? msg : "")}</p>
        <button class="fap-btn block" id="lGo">Ingresar</button>
        <p style="text-align:center;margin-top:12px"><button type="button" class="fap-btn text" id="lForgot">Olvidé mi contraseña</button></p>
      </form></div></main><div id="fapAvisos" class="fap-avisos" aria-live="polite"></div>`;
    document.title = "Panel del equipo · Frío Austral";
    const f = $("#fapLogin"), err = $("#lErr");
    const fail = (t, field) => { err.hidden = false; err.textContent = t; $("#lOk").hidden = true; if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); } };
    $("#lShow").onclick = (e) => { const p = $("#lPass"), on = p.type === "password"; p.type = on ? "text" : "password"; e.currentTarget.setAttribute("aria-pressed", String(on)); e.currentTarget.textContent = on ? "Ocultar" : "Mostrar"; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const em = f.email.value.trim(), pw = f.password.value;
      if (!em) return fail("Escribe tu correo.", f.email);
      if (!pw) return fail("Escribe tu contraseña.", f.password);
      const b = $("#lGo"); b.disabled = true; b.classList.add("spin"); b.textContent = "Ingresando…";
      try { await A.signIn(em, pw); await start(); }
      catch (ex) {
        b.disabled = false; b.classList.remove("spin"); b.textContent = "Ingresar";
        fail(ex.code === "login" ? "El correo o la contraseña no coinciden. Revisa e inténtalo de nuevo." : FAP.friendly(ex), ex.code === "login" ? f.password : null);
      }
    };
    $("#lForgot").onclick = async () => {
      const em = f.email.value.trim();
      if (!em) return fail("Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».", f.email);
      try { await A.resetPassword(em); err.hidden = true; $("#lOk").hidden = false; $("#lOk").textContent = "Si ese correo tiene cuenta, te enviamos un mensaje para cambiar la contraseña."; }
      catch (ex) { fail(FAP.friendly(ex)); }
    };
    f.email.focus();
  }

  FAP.sessionLost = (e) => {
    $$(".fap-back").forEach((b) => b.remove()); document.body.style.overflow = "";
    routeAfterLogin = location.hash;
    if (e && e.code === "not_admin") A.signOut().catch(() => {});
    loginView(FAP.friendly(e));
  };

  /* ---------- marco ---------- */
  const href = (k) => "#/" + k;
  function navHtml(cur) {
    return NAV.map(([k, label, ic]) => {
      const on = cur.view === k;
      const bd = k === "mensajes" && badge ? `<span class="fap-badge" aria-label="${badge} personas esperando respuesta">${badge}</span>` : "";
      let sub = "";
      if (k === "paginas" && on) {
        const m = FAP.cache.media && FAP.cache.media.items;
        sub = `<div class="fap-sub" role="group" aria-label="Páginas del sitio">${FA_PANEL_MAPA.PAGINAS.map((p) => {
          const n = m ? m.filter((x) => x.custom && FA_PANEL_MAPA.por(x.id) && FA_PANEL_MAPA.por(x.id).pagina === p.slug).length : 0;
          return `<a href="#/paginas/${p.slug}" ${cur.arg === p.slug ? 'aria-current="page"' : ""}>${esc(p.nombre)}${n ? `<span class="fap-n">${n} ${n === 1 ? "cambio" : "cambios"}</span>` : ""}</a>`;
        }).join("")}</div>`;
      }
      return `<a href="${href(k)}" ${on ? 'aria-current="page"' : ""}>${ico(ic)}<span>${esc(label)}</span>${bd}</a>${sub}`;
    }).join("");
  }
  function bnavHtml(cur) {
    return NAV.map(([k, , ic]) => `<a href="${href(k)}" ${cur.view === k ? 'aria-current="page"' : ""}>${ico(ic)}<span>${SHORT[k]}</span>${k === "mensajes" && badge ? `<span class="fap-badge" aria-label="${badge} esperando">${badge}</span>` : ""}</a>`).join("");
  }
  function shell() {
    root.innerHTML = `<a class="fap-skip" href="#fapMain">Saltar al contenido</a>
      <div class="fap-shell">
        <aside class="fap-side" aria-label="Menú del panel"><a class="fap-brand" href="#/resumen">${logo(44)}<span><b>Frío Austral</b><small>Panel del equipo</small></span></a><nav id="fapNav" aria-label="Secciones del panel"></nav>
          <div class="fap-me"><span class="fap-me-mail" id="fapMail"></span><a class="fap-btn sec sm" href="index.html" target="_blank" rel="noopener">Ir al sitio ${ico("ext")}</a><button type="button" class="fap-btn text sm" data-out>${ico("out")} Salir</button></div></aside>
        <div><header class="fap-top">${logo(36)}<h1 id="fapTitle" tabindex="-1"></h1><button type="button" class="fap-btn sec sm fap-top-out" id="fapMenuBtn">${ico("menu")} Menú</button></header>
          <div id="fapLive" class="fap-strip warn" role="status" hidden style="margin:0 16px"></div>
          <main class="fap-main" id="fapMain"></main></div>
      </div><nav class="fap-bnav" id="fapBnav" aria-label="Secciones del panel"></nav><div id="fapAvisos" class="fap-avisos" aria-live="polite"></div>`;
    $("#fapMail").textContent = email;
    $$("[data-out]").forEach((b) => (b.onclick = salir));
    $("#fapMenuBtn").onclick = menuMovil;
  }
  function menuMovil() {
    const d = FAP.dialog({ title: "Menú" });
    d.body.innerHTML = `<p class="fap-help">Cuenta: <b>${esc(email)}</b></p><a class="fap-btn sec" href="index.html" target="_blank" rel="noopener">Ir al sitio ${ico("ext")}</a>`;
    d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cerrar</button><button type="button" class="fap-btn danger" data-s>${ico("out")} Salir</button>`;
    $("[data-c]", d.foot).onclick = () => d.close(null);
    $("[data-s]", d.foot).onclick = () => { d.close(null); salir(); };
    d.focus("[data-c]");
  }
  async function salir() {
    if (FAP.draft.any()) {
      const r = await FAP.confirmar({ titulo: "¿Salir del panel?", cuerpo: `<p>Tienes mensajes o formularios sin terminar. Si sales, se borran.</p>`, ok: "Salir y borrar", peligro: true });
      if (r !== "ok") return;
    }
    FAP.draft.clear(); FAP.cache = {};
    await A.signOut().catch(() => {});
    location.hash = ""; loginView();
  }

  /* ---------- enrutador ---------- */
  function parse() {
    const h = (location.hash || "").replace(/^#\/?/, "").split("?")[0].split("/");
    const view = NAV.some((n) => n[0] === h[0]) ? h[0] : "resumen";
    return { view, arg: h[1] || "", raw: h.join("/") };
  }
  function paintNav(cur) { const n = $("#fapNav"); if (n) n.innerHTML = navHtml(cur); const b = $("#fapBnav"); if (b) b.innerHTML = bnavHtml(cur); }
  FAP.repaintNav = () => paintNav(parse());
  async function route() {
    if (!$("#fapMain")) return;
    const cur = parse();
    if (cleanup) { try { cleanup(); } catch (e) { /* vista anterior */ } cleanup = null; }
    paintNav(cur);
    const v = FAP.views[cur.view];
    $("#fapTitle").textContent = TITLES[cur.view];
    document.title = TITLES[cur.view] + " · Panel del equipo";
    const main = $("#fapMain"); main.innerHTML = ""; window.scrollTo(0, 0);
    try { cleanup = (await v.render(main, cur)) || null; } catch (e) { console.error(e); main.innerHTML = `<div class="fap-card"><p>Algo falló al mostrar esta pantalla. Recarga la página.</p></div>`; }
    if (!(cur.view === "mensajes" && cur.arg)) $("#fapTitle").focus({ preventScroll: true });
  }
  FAP.go = (h) => { if (location.hash === h) route(); else location.hash = h; };
  FAP.setTitle = (t) => { $("#fapTitle").textContent = t; document.title = t + " · Panel del equipo"; };

  /* ---------- actualización cada 30 s: solo contadores; si falla, se dice ---------- */
  function stopTimers() { if (timer) clearInterval(timer); timer = null; }
  const live = (t) => { const l = $("#fapLive"); if (l) { l.hidden = !t; l.textContent = t || ""; } };
  FAP.live = live;
  async function tick() {
    if (document.visibilityState !== "visible" || !$("#fapMain")) return;
    try { const s = await FAP.get("summary", true); setBadge(s.messages.people); live(""); if (FAP.onSummary) FAP.onSummary(s); }
    catch (e) { if (!e.handled) live("No pudimos actualizar. Reintentando…"); }
  }
  function setBadge(n) { if (n !== badge) { badge = n; paintNav(parse()); } }
  FAP.setBadge = setBadge;

  async function start() {
    root.innerHTML = `<div class="fap-login"><div class="fap-skel" style="width:240px;height:24px"></div></div><div id="fapAvisos" class="fap-avisos" aria-live="polite"></div>`;
    let s;
    try { s = await A.session(); } catch (e) { return loginView(FAP.friendly(e)); }
    if (!s) return loginView();
    try { email = (await FAP.api("whoami")).email || s.user.email || ""; }
    catch (e) { if (e.handled) return; return loginView(e.friendly || FAP.friendly(e)); }
    FAP.state.email = email;
    shell();
    try { const sm = await FAP.get("summary"); badge = sm.messages.people; } catch (e) { if (e.handled) return; }
    if (routeAfterLogin) { location.hash = routeAfterLogin; routeAfterLogin = null; }
    await route();
    stopTimers(); timer = setInterval(tick, 30000);
  }
  window.addEventListener("hashchange", () => { if ($("#fapMain")) route(); });
  start();
})();
