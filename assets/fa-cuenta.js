/* Panel "Mi cuenta" del suscriptor: crear cuenta / ingresar, plan, vigencia, cupo, chat con el equipo,
   material y videollamadas. Datos reales vía /api/account (Supabase). El plan lo activa solo el webhook de Hotmart.
   Página de retorno de Hotmart: mi-cuenta.html?compra=ok (abre directo "Crear mi cuenta"). */
(function () {
  const A = window.FAAuth, C = window.FA_CONFIG || {}, PLANS = C.PLANS || {};
  const { esc, clp, fdate } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const root = $("#faCuenta");
  const qs = new URLSearchParams(location.search);
  let state = null, tab = "chat", timer = null;

  const STATUS = {
    activa: ["Activa", "fa-ok"],
    cancelada_fin_periodo: ["Cancelada · vigente hasta fin de período", "fa-warn"],
    cancelada: ["Terminada", "fa-bad"],
    sin_suscripcion: ["Sin plan", "fa-bad"],
  };

  /* ---------- Login / recuperación ---------- */
  let authMode = null;
  function loginView(msg) {
    stopPoll();
    if (!authMode) authMode = qs.get("olvide") === "1" ? "forgot" : (qs.get("compra") || qs.get("registro") === "1") ? "signup" : "login";
    const mode = authMode;
    const fromHotmart = qs.get("compra") === "ok";
    const heads = { login: "Ingresa a tu cuenta", signup: "Crea tu cuenta", forgot: "Recuperar contraseña" };
    const subs = {
      login: "Usa el correo y la contraseña con que creaste tu cuenta en este sitio.",
      signup: "Crea tu cuenta con el <b>mismo correo con el que pagaste en Hotmart</b>: así activamos tu plan y ves tu material.",
      forgot: "Te enviamos un correo con un enlace para crear una contraseña nueva.",
    };
    root.innerHTML = `
      <div class="fa-auth glass">
        ${fromHotmart ? `<div class="fa-cta-msg ok" role="status"><b>¡Gracias por tu compra!</b> Para entrar a tu plan, crea tu cuenta aquí con el mismo correo con que pagaste en Hotmart (o ingresa si ya la tienes).</div>` : ""}
        <h2>${heads[mode]}</h2>
        <p class="fa-sub-note">${subs[mode]}</p>
        <form id="faLoginForm" novalidate>
          ${mode === "signup" ? `<label>Nombre<input name="nombre" autocomplete="name" required></label>` : ""}
          <label>${mode === "signup" ? "Correo (el mismo de Hotmart)" : "Correo"}<input name="email" type="email" autocomplete="email" required></label>
          ${mode === "forgot" ? "" : `<label>${mode === "signup" ? "Crea una contraseña" : "Contraseña"}<input name="password" type="password" ${mode === "signup" ? 'minlength="8" autocomplete="new-password"' : 'autocomplete="current-password"'} required></label>`}
          <p class="fa-err" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>
          <button class="btn btn-red" type="submit">${{ login: "Ingresar", signup: "Crear mi cuenta", forgot: "Enviar enlace" }[mode]}</button>
        </form>
        <p class="fa-sub-note">${mode === "login"
          ? `<button type="button" class="fa-linkbtn" data-mode="signup">Crear mi cuenta</button> · <button type="button" class="fa-linkbtn" data-mode="forgot">Olvidé mi contraseña</button> · <a href="planes.html">Ver planes</a>`
          : mode === "signup"
            ? `¿Ya tienes cuenta? <button type="button" class="fa-linkbtn" data-mode="login">Ingresa</button> · <a href="planes.html">Ver planes</a>`
            : `<button type="button" class="fa-linkbtn" data-mode="login">Volver a ingresar</button>`}</p>
      </div>`;
    root.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { authMode = b.getAttribute("data-mode"); loginView(); }));
    const f = $("#faLoginForm"), err = $(".fa-err", f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(f), btn = $("button", f);
      err.hidden = true; btn.disabled = true;
      try {
        const email = String(d.get("email") || "").trim();
        if (mode === "forgot") {
          await A.resetPassword(email);
          err.hidden = false; err.style.color = "var(--ice, #9fe3ff)";
          err.textContent = "Si el correo tiene cuenta, te llegará un mensaje en unos minutos.";
        } else {
          const password = String(d.get("password") || "");
          if (mode === "signup") {
            const nombre = String(d.get("nombre") || "").trim();
            if (!nombre || !email || password.length < 8) throw new Error("Completa tu nombre, tu correo y una contraseña de al menos 8 caracteres.");
            await A.api("/api/account?action=signup", { body: { nombre, email, password } });
          }
          await A.signIn(email, password);
          authMode = null;
          history.replaceState(null, "", "mi-cuenta.html");
          await load();
        }
      } catch (ex) { err.hidden = false; err.textContent = ex.message; }
      btn.disabled = false;
    };
  }

  function recoverView() {
    root.innerHTML = `
      <div class="fa-auth glass">
        <h2>Crea tu nueva contraseña</h2>
        <form id="faRecForm" novalidate>
          <label>Nueva contraseña<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
          <p class="fa-err" role="alert" hidden></p>
          <button class="btn btn-red" type="submit">Guardar contraseña</button>
        </form>
      </div>`;
    const f = $("#faRecForm"), err = $(".fa-err", f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const p = String(new FormData(f).get("password") || "");
      if (p.length < 8) { err.hidden = false; err.textContent = "Mínimo 8 caracteres."; return; }
      try { await A.updatePassword(p); history.replaceState(null, "", "mi-cuenta.html"); await load(); }
      catch (ex) { err.hidden = false; err.textContent = ex.message; }
    };
  }

  /* ---------- Panel ---------- */
  const expired = (s) => s.status === "cancelada" || (s.periodEnd && new Date(s.periodEnd).getTime() + 86400000 < Date.now());
  function planCard(s) {
    if (!s.hasSubscription) {
      return `<div class="fa-card glass fa-plancard" id="faVerifying">
        <div><span class="mono fa-ej">Tu plan</span><h3>Tu pago está siendo verificado</h3>
        <span class="fa-pill fa-warn">En verificación</span></div>
        <p class="fa-sub-note">Tu cuenta (<b>${esc(s.email)}</b>) todavía no tiene un plan activado. Cuando Hotmart confirme tu pago, el plan se activa solo y verás aquí tu plan y tu material; normalmente toma unos minutos. Recuerda que debes usar el <b>mismo correo con el que pagaste en Hotmart</b>.</p>
        <div class="fa-row"><button class="btn btn-line btn-sm" id="faRefresh">Actualizar</button><a class="btn btn-red btn-sm" href="planes.html">Ver planes</a></div>
      </div>`;
    }
    const gone = expired(s);
    const st = gone ? STATUS.cancelada : (STATUS[s.status] || [s.status, ""]);
    return `<div class="fa-card glass fa-plancard">
      <div class="fa-plan-top"><div><span class="mono fa-ej">Tu plan${(PLANS[s.plan] && PLANS[s.plan].label) ? " · " + esc(PLANS[s.plan].label) : ""}</span><h3>${esc(s.planName || "")}</h3></div>
      <span class="fa-pill ${st[1]}">${esc(st[0])}</span></div>
      <dl class="fa-dl"><div><dt>${gone ? "Terminó el" : "Acceso hasta"}</dt><dd>${s.periodEnd ? fdate(s.periodEnd) : "—"}</dd></div></dl>
      <p class="fa-sub-note">${gone ? "Tu acceso terminó. Renueva tu plan en Hotmart para volver a preguntar y ver el material." : "Tu plan se paga en Hotmart y se renueva allí con cada pago. Para cambiarlo o cancelarlo, hazlo desde Hotmart o escríbele al equipo por el chat."}</p>
      ${gone ? `<div class="fa-row"><a class="btn btn-red btn-sm" href="planes.html">Ver planes</a></div>` : ""}
    </div>`;
  }

  function quotaCard(st) {
    const q = st.quota, s = st.subscriber;
    if (!s.hasSubscription) return "";
    const pct = q.unlimited ? 100 : Math.min(100, Math.round((q.used / Math.max(1, q.limit)) * 100));
    return `<div class="fa-card glass fa-quota">
      <span class="mono fa-ej">Preguntas de este período</span>
      <b>${q.unlimited ? "Ilimitadas" : `${q.left} de ${q.limit} disponibles`}</b>
      ${q.unlimited ? `<small>Llevas ${q.used} en este período.</small>` : `<div class="fa-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.limit}" aria-valuenow="${q.used}"><i style="width:${pct}%"></i></div><small>Usaste ${q.used}. Se renuevan con cada pago mensual${q.periodTo ? " (" + fdate(q.periodTo) + ")" : ""}.</small>`}
      ${st.features.videollamada ? `<button class="btn btn-line btn-sm" data-act="video">Agendar videollamada</button>` : ""}
    </div>`;
  }

  function chatPane(st) {
    const msgs = st.messages.map((m) => `<div class="fa-m ${m.sender === "cliente" ? "fa-u" : "fa-a"}">${esc(m.body).replace(/\n/g, "<br>")}<small>${m.sender === "cliente" ? "Tú" : "Equipo Frío Austral"} · ${fdate(m.created_at, true)}</small></div>`).join("")
      || `<p class="fa-ej mono">Aún no hay mensajes. Escribe tu primera pregunta: describe el vehículo (marca, modelo, año), el síntoma y lo que ya revisaste.</p>`;
    let block = "";
    if (!st.subscriber.hasSubscription) block = `Tu pago está siendo verificado: cuando se active tu plan podrás preguntar aquí. <a class="btn btn-red btn-sm" href="planes.html">Ver planes</a>`;
    else if (!st.canAsk) block = "Tu suscripción no está activa. Renueva tu plan en Hotmart para seguir preguntando.";
    else if (!st.quota.unlimited && st.quota.left <= 0) block = `Usaste tus ${st.quota.limit} preguntas de este período. Para seguir preguntando, pásate al Plan Técnico en Hotmart.`;
    return `<div class="fa-chat" id="faChat" aria-live="polite">${msgs}</div>
      ${block ? `<div class="fa-block">${block}</div>` : ""}
      <form class="fa-input" id="faMsgForm"><textarea id="faMsg" rows="2" maxlength="4000" placeholder="Escribe tu pregunta…" ${block ? "disabled" : ""} required></textarea><button class="btn btn-red btn-sm" ${block ? "disabled" : ""}>Enviar</button></form>
      <p class="fa-err" id="faMsgErr" role="alert" hidden></p>`;
  }

  function render() {
    const st = state, s = st.subscriber;
    root.innerHTML = `
      <div class="fa-acc-head"><div><span class="mono fa-ej">Mi cuenta</span><h2>Hola, ${esc(s.nombre || s.email)}</h2><small class="fa-sub-note">${esc(s.email)}</small></div>
        <button class="btn btn-line btn-sm" id="faOut">Cerrar sesión</button></div>
      <div class="fa-acc-grid">${planCard(s)}${quotaCard(st)}</div>
      <div class="fa-tabs" role="tablist">
        <button data-tab="chat" class="${tab === "chat" ? "on" : ""}">Chat con el equipo</button>
        ${st.features.community || st.features.ver_preguntas_otros ? `<button data-tab="base" class="${tab === "base" ? "on" : ""}">Preguntas de otros usuarios</button>` : ""}
        ${st.features.videollamada ? `<button data-tab="video" class="${tab === "video" ? "on" : ""}">Videollamadas</button>` : ""}
        ${st.canAsk ? `<button data-tab="material" class="${tab === "material" ? "on" : ""}">Material</button>` : ""}
        ${st.features.ebooks_gratis ? `<button data-tab="ebooks" class="${tab === "ebooks" ? "on" : ""}">Ebooks</button>` : ""}
        ${st.features.biblioteca ? `<button data-tab="biblioteca" class="${tab === "biblioteca" ? "on" : ""}">Biblioteca</button>` : ""}
      </div>
      <div class="fa-pane glass" data-pane="chat" ${tab === "chat" ? "" : "hidden"}>${chatPane(st)}</div>
      ${st.features.community || st.features.ver_preguntas_otros ? `<div class="fa-pane glass" data-pane="base" ${tab === "base" ? "" : "hidden"}><form id="faBaseForm" class="fa-input"><input name="q" placeholder="Busca por síntoma, vehículo, gas…"><button class="btn btn-line btn-sm">Buscar</button></form><div id="faBase"><p class="fa-sub-note">Consulta, solo lectura, las preguntas ya respondidas a otros usuarios. No aparecen nombres ni correos.</p></div></div>` : ""}
      ${st.features.videollamada ? `<div class="fa-pane glass" data-pane="video" ${tab === "video" ? "" : "hidden"}>
        <form id="faVidForm" class="fa-vid-form"><label>Día y hora que propones<input type="datetime-local" name="when" required></label><label>Tema (opcional)<input name="note" maxlength="500" placeholder="Ej.: diagnóstico de compresor en Hilux 2018"></label><button class="btn btn-red btn-sm">Solicitar videollamada</button></form>
        <p class="fa-sub-note">Se abre en una pestaña nueva, sin límite de tiempo. El primero del equipo en entrar puede tener que iniciar sesión con Google o GitHub para abrir la sala.</p>
        <p class="fa-err" id="faVidErr" role="alert" hidden></p>
        <div id="faVids"><p class="fa-sub-note">Cargando…</p></div></div>` : ""}
      ${st.canAsk ? `<div class="fa-pane glass" data-pane="material" ${tab === "material" ? "" : "hidden"}><div id="faMatAll"><p class="fa-sub-note">Cargando…</p></div></div>` : ""}
      ${st.features.ebooks_gratis ? `<div class="fa-pane glass" data-pane="ebooks" ${tab === "ebooks" ? "" : "hidden"}><div id="faMatEbooks"><div class="fa-soon"><b>Próximamente</b><p class="fa-sub-note">El acceso gratuito a los ebooks del Plan Premium se publicará aquí. Todavía no hay títulos disponibles.</p></div></div></div>` : ""}
      ${st.features.biblioteca ? `<div class="fa-pane glass" data-pane="biblioteca" ${tab === "biblioteca" ? "" : "hidden"}><div id="faMatBib"><div class="fa-soon"><b>Próximamente</b><p class="fa-sub-note">La biblioteca de conocimientos para estudiar y profundizar se publicará aquí.</p></div></div></div>` : ""}`;
    const chat = $("#faChat"); if (chat) chat.scrollTop = chat.scrollHeight;
    $("#faOut").onclick = async () => { await A.signOut(); state = null; loginView(); };
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.getAttribute("data-tab"); render(); if (tab === "base") search(""); if (tab === "video") loadVideos(); }));
    if (st.canAsk && ["material", "ebooks", "biblioteca"].includes(tab)) loadMaterials();
    const vf = $("#faVidForm");
    if (vf) vf.onsubmit = requestVideo;
    if (tab === "video") loadVideos();
    root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => act(b.getAttribute("data-act"))));
    const rf = $("#faRefresh"); if (rf) rf.onclick = () => load(true);
    const mf = $("#faMsgForm");
    if (mf) mf.onsubmit = sendMsg;
    const ta = $("#faMsg");
    if (ta) ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) mf.requestSubmit(); };
    const bf = $("#faBaseForm");
    if (bf) bf.onsubmit = (e) => { e.preventDefault(); search(new FormData(bf).get("q")); };
  }

  /* ---------- material de mi plan (bucket privado: la descarga usa una URL firmada de 2 minutos) ---------- */
  const CAT_LABEL = { ebook: "Ebook", biblioteca: "Biblioteca", guia: "Guía", video: "Video", recurso: "Recurso" };
  const fsize = (n) => (n == null ? "" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  function matList(items, empty) {
    if (!items.length) return empty;
    return items.map((m) => `<div class="fa-q fa-mat"><div><b>${esc(m.title)}</b> <span class="fa-pill">${esc(CAT_LABEL[m.category] || m.category)}</span>${m.description ? `<p>${esc(m.description)}</p>` : ""}<small class="fa-sub-note">${esc(m.fileName)}${m.size != null ? " · " + fsize(m.size) : ""}</small></div><button class="btn btn-red btn-sm" data-mat="${esc(m.id)}">Descargar</button></div>`).join("");
  }
  async function loadMaterials() {
    const all = $("#faMatAll"), eb = $("#faMatEbooks"), bi = $("#faMatBib");
    try {
      const out = await A.api("/api/account?action=materials");
      const soon = (t) => `<div class="fa-soon"><b>Próximamente</b><p class="fa-sub-note">${t}</p></div>`;
      if (all) all.innerHTML = matList(out.items, `<p class="fa-sub-note">Todavía no hay material para tu plan. Cuando el equipo suba ebooks o recursos, aparecen aquí.</p>`);
      if (eb) eb.innerHTML = matList(out.items.filter((m) => m.category === "ebook"), soon("El acceso gratuito a los ebooks del Plan Premium se publicará aquí. Todavía no hay títulos disponibles."));
      if (bi) bi.innerHTML = matList(out.items.filter((m) => m.category === "biblioteca"), soon("La biblioteca de conocimientos para estudiar y profundizar se publicará aquí."));
      root.querySelectorAll("[data-mat]").forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        try { const r = await A.api("/api/account?action=material-url", { body: { id: b.getAttribute("data-mat") } }); location.href = r.url; }
        catch (ex) { alert(ex.message); }
        b.disabled = false;
      }));
    } catch (e) {
      [all, eb, bi].forEach((n) => { if (n) n.innerHTML = `<p class="fa-err">${esc(e.message)}</p>`; });
    }
  }

  async function search(q) {
    const box = $("#faBase"); if (!box) return;
    box.innerHTML = `<p class="fa-sub-note">Buscando…</p>`;
    try {
      const out = await A.api("/api/account?action=community&q=" + encodeURIComponent(q || ""));
      box.innerHTML = out.items.map((i) => `<div class="fa-q"><b>${esc(i.pregunta)}</b><p>${esc(i.respuesta)}</p><small class="fa-sub-note">${fdate(i.fecha)}</small></div>`).join("") || `<p class="fa-sub-note">Sin resultados.</p>`;
    } catch (e) { box.innerHTML = `<p class="fa-err">${esc(e.message)}</p>`; }
  }

  /* ---------- Videollamadas (Jitsi Meet, en pestaña nueva y sin límite de tiempo) ---------- */
  const jitUrl = (u) => /^https:\/\/meet\.jit\.si\/frioaustral-[0-9a-f-]{36}$/i.test(String(u || ""));
  const VST = { solicitada: ["Esperando confirmación del equipo", "fa-warn"], propuesta: ["El equipo propone otra hora", "fa-warn"], confirmada: ["Confirmada", "fa-ok"], cancelada: ["Cancelada", "fa-bad"] };
  const fwhen = (i) => new Date(i).toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  function videoRow(v) {
    const s = VST[v.status] || [v.status, ""];
    let acts = "";
    if (v.status === "confirmada") acts = v.canJoin && jitUrl(v.url) ? `<a class="btn btn-red btn-sm" href="${esc(v.url)}" target="_blank" rel="noopener">Entrar a la videollamada</a>` : `<button class="btn btn-line btn-sm" disabled title="Se habilita 10 minutos antes">Entrar a la videollamada</button><small class="fa-sub-note">Se habilita desde ${fwhen(v.joinFrom)}.</small>`;
    if (v.status === "propuesta") acts = `<button class="btn btn-red btn-sm" data-vacc="${esc(v.id)}">Aceptar esta hora</button>`;
    if (v.status !== "cancelada") acts += ` <button class="btn btn-line btn-sm fa-danger" data-vcan="${esc(v.id)}">Cancelar</button>`;
    return `<div class="fa-q fa-vid"><b>${esc(fwhen(v.scheduledAt))}</b> <span class="fa-pill ${s[1]}">${esc(s[0])}</span>${v.note ? `<p>${esc(v.note)}</p>` : ""}<div class="fa-row">${acts}</div></div>`;
  }
  async function loadVideos() {
    const box = $("#faVids"); if (!box) return;
    try {
      const out = await A.api("/api/account?action=videos");
      box.innerHTML = out.items.map(videoRow).join("") || `<p class="fa-sub-note">Aún no tienes videollamadas. Propón un día y hora y el equipo te confirma.</p>`;
      box.querySelectorAll("[data-vacc]").forEach((b) => (b.onclick = () => videoAct("video-accept", b.getAttribute("data-vacc"))));
      box.querySelectorAll("[data-vcan]").forEach((b) => (b.onclick = () => { if (confirm("¿Cancelar esta videollamada?")) videoAct("video-cancel", b.getAttribute("data-vcan")); }));
    } catch (e) { box.innerHTML = `<p class="fa-err">${esc(e.message)}</p>`; }
  }
  async function videoAct(action, id) {
    try { await A.api("/api/account?action=" + action, { body: { id } }); } catch (e) { alert(e.message); }
    loadVideos();
  }
  async function requestVideo(e) {
    e.preventDefault();
    const f = e.target, err = $("#faVidErr"), d = new FormData(f), btn = $("button", f);
    err.hidden = true; btn.disabled = true;
    try {
      const when = new Date(String(d.get("when"))).toISOString();
      await A.api("/api/account?action=video-request", { body: { when, note: d.get("note") } });
      f.reset(); loadVideos();
    } catch (ex) { err.hidden = false; err.textContent = ex.message === "Invalid time value" ? "Elige una fecha y hora." : ex.message; }
    btn.disabled = false;
  }
  async function sendMsg(e) {
    e.preventDefault();
    const ta = $("#faMsg"), err = $("#faMsgErr"), btn = $("#faMsgForm button");
    const body = ta.value.trim(); if (!body) return;
    btn.disabled = true; err.hidden = true;
    try { await A.api("/api/account?action=message", { body: { body } }); ta.value = ""; await load(true); }
    catch (ex) { err.hidden = false; err.textContent = ex.message; btn.disabled = false; }
  }

  async function act(kind) {
    if (kind === "video") { tab = "video"; render(); loadVideos(); }
  }

  function stopPoll() { if (timer) clearInterval(timer); timer = null; }
  function startPoll() {
    stopPoll();
    timer = setInterval(() => { if (document.visibilityState === "visible" && !($("#faMsg") && $("#faMsg").value)) load(true); }, 30000);
  }

  async function load(quiet) {
    if (!quiet) root.innerHTML = `<p class="fa-ej mono">Cargando tu cuenta…</p>`;
    try {
      const sess = await A.session();
      if (!sess) return loginView();
      state = await A.api("/api/account?action=me");
      render();
      startPoll();
    } catch (e) {
      if (e.status === 401) { await A.signOut().catch(() => {}); return loginView(); }
      root.innerHTML = `<div class="fa-card glass"><p>${esc(e.message)}</p><button class="btn btn-line btn-sm" onclick="location.reload()">Reintentar</button></div>`;
    }
  }

  (async () => {
    try {
      const c = await A.client();
      c.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") recoverView(); });
      if (qs.get("recuperar") === "1" && /type=recovery/.test(location.hash)) return recoverView();
    } catch (e) {
      root.innerHTML = `<div class="fa-card glass"><p>${esc(e.message)}</p></div>`;
      return;
    }
    load();
  })();
})();
