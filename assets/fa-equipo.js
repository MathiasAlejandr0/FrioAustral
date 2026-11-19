/* Panel del equipo: suscriptores, chats sin responder y respuestas, videollamadas. */
(function () {
  const A = window.FAAuth, C = window.FA_CONFIG || {};
  const { esc, clp, fdate } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const root = $("#faEquipo");
  let vids = [], list = null, sel = null, thread = null, filter = "pendientes", q = "", timer = null;
  const STATUS = { activa: "Activa", cancelada_fin_periodo: "Cancela a fin de período", pago_pendiente: "Pago en proceso", pendiente: "Por iniciar", pendiente_tarjeta: "Sin tarjeta", morosa: "Morosa", cancelada: "Cancelada", sin_suscripcion: "Sin plan" };
  const cls = (s) => (s === "activa" ? "fa-ok" : s === "morosa" || s === "cancelada" || s === "sin_suscripcion" ? "fa-bad" : "fa-warn");

  function loginView(msg) {
    stop();
    root.innerHTML = `<div class="fa-auth glass"><h2>Panel del equipo</h2><p class="fa-sub-note">Ingresa con la cuenta del equipo de Frío Austral.</p>
      <form id="faEqLogin" novalidate><label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="fa-err" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p><button class="btn btn-red">Ingresar</button></form></div>`;
    const f = $("#faEqLogin");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(f);
      try { await A.signIn(d.get("email"), d.get("password")); await load(); }
      catch (ex) { loginView(ex.message); }
    };
  }

  function filtered() {
    let it = list.items;
    if (filter === "pendientes") it = it.filter((s) => s.unread > 0 || s.user_id === sel);
    else if (filter === "activos") it = it.filter((s) => s.canAsk);
    else if (filter === "problemas") it = it.filter((s) => ["morosa", "pago_pendiente", "pendiente_tarjeta"].includes(s.status));
    if (q) it = it.filter((s) => (s.nombre + " " + s.email).toLowerCase().includes(q));
    return it.slice().sort((a, b) => (b.unread - a.unread) || String(b.lastUnreadAt || b.created_at).localeCompare(String(a.lastUnreadAt || a.created_at)));
  }

  function render() {
    const st = list.stats;
    root.innerHTML = `
      <div class="fa-acc-head"><div><span class="mono fa-ej">Panel del equipo</span><h2>Suscriptores y preguntas</h2></div>
        <div class="fa-row"><a class="btn btn-red btn-sm" href="contenido.html">Material y fotos del sitio</a><button class="btn btn-line btn-sm" id="faOut">Salir</button></div></div>
      <div class="fa-kpis">
        <div class="fa-card glass"><span class="fa-ej mono">Por responder</span><b>${st.unread}</b></div>
        <div class="fa-card glass"><span class="fa-ej mono">Activos</span><b>${st.active}</b><small>de ${st.total}</small></div>
        <div class="fa-card glass"><span class="fa-ej mono">Ingreso mensual (activos)</span><b>${clp(st.mrr)}</b></div>
      </div>
      <section class="fa-card glass fa-eq-vids"><span class="fa-ej mono">Videollamadas (Plan Premium)</span>
        <p class="fa-sub-note">Se abre en una pestaña nueva, sin límite de tiempo. El primero del equipo en entrar puede tener que iniciar sesión con Google o GitHub para abrir la sala.</p>
        ${vidsView()}</section>
      <div class="fa-eq">
        <aside class="fa-card glass fa-eq-list">
          <div class="fa-tabs">${[["pendientes", "Por responder"], ["activos", "Activos"], ["problemas", "Con problemas"], ["todos", "Todos"]].map(([k, l]) => `<button data-f="${k}" class="${filter === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <input id="faEqQ" placeholder="Buscar nombre o email" value="${esc(q)}">
          <ul>${filtered().map((s) => `<li><button data-u="${s.user_id}" class="${sel === s.user_id ? "on" : ""}"><b>${esc(s.nombre || s.email)}</b>${s.unread ? `<span class="fa-badge-n">${s.unread}</span>` : ""}<small>${esc(s.planName || "Sin plan")} · <span class="fa-pill ${cls(s.status)}">${esc(STATUS[s.status] || s.status)}</span></small></button></li>`).join("") || `<li class="fa-sub-note">Nada por aquí.</li>`}</ul>
        </aside>
        <section class="fa-card glass fa-eq-thread" id="faThread">${thread ? threadView() : `<p class="fa-sub-note">Elige un suscriptor para ver su chat.</p>`}</section>
      </div>`;
    $("#faOut").onclick = async () => { await A.signOut(); loginView(); };
    root.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.getAttribute("data-f"); render(); }));
    const qi = $("#faEqQ"); qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; render(); const n = $("#faEqQ"); n.focus(); n.setSelectionRange(pos, pos); };
    root.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => open(b.getAttribute("data-u"))));
    bindThread();
    bindVids();
  }

  const jitUrl = (u) => /^https:\/\/meet\.jit\.si\/frioaustral-[0-9a-f-]{36}$/i.test(String(u || ""));
  const VST = { solicitada: ["Pide confirmación", "fa-warn"], propuesta: ["Esperando al cliente", "fa-warn"], confirmada: ["Confirmada", "fa-ok"] };
  const fwhen = (i) => new Date(i).toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  function vidsView() {
    if (!vids.length) return `<p class="fa-sub-note">No hay solicitudes de videollamada.</p>`;
    return vids.map((v) => {
      const s = VST[v.status] || [v.status, ""];
      let acts = "";
      if (v.status === "solicitada") acts += `<button class="btn btn-red btn-sm" data-vconf="${esc(v.id)}">Confirmar</button>`;
      if (v.status === "confirmada") acts += v.canJoin && jitUrl(v.url) ? `<a class="btn btn-red btn-sm" href="${esc(v.url)}" target="_blank" rel="noopener">Entrar a la videollamada</a>` : `<button class="btn btn-line btn-sm" disabled>Entrar a la videollamada</button>`;
      acts += ` <label class="fa-inline">Otra hora <input type="datetime-local" data-vwhen="${esc(v.id)}"></label><button class="btn btn-line btn-sm" data-vprop="${esc(v.id)}">Proponer</button> <button class="btn btn-line btn-sm fa-danger" data-vcan="${esc(v.id)}">Cancelar</button>`;
      return `<div class="fa-q"><b>${esc(v.nombre || v.email)} · ${esc(fwhen(v.scheduledAt))}</b> <span class="fa-pill ${s[1]}">${esc(s[0])}</span>${v.note ? `<p>${esc(v.note)}</p>` : ""}<div class="fa-row" style="flex-wrap:wrap;gap:8px">${acts}</div></div>`;
    }).join("");
  }
  function bindVids() {
    const run = async (action, body) => { try { await A.api("/api/admin?action=" + action, { body }); await loadVids(); render(); } catch (ex) { alert(ex.message); } };
    root.querySelectorAll("[data-vconf]").forEach((b) => (b.onclick = () => run("video-confirm", { id: b.getAttribute("data-vconf") })));
    root.querySelectorAll("[data-vcan]").forEach((b) => (b.onclick = () => { if (confirm("¿Cancelar esta videollamada?")) run("video-cancel", { id: b.getAttribute("data-vcan") }); }));
    root.querySelectorAll("[data-vprop]").forEach((b) => (b.onclick = () => {
      const id = b.getAttribute("data-vprop"), inp = root.querySelector(`[data-vwhen="${id}"]`);
      if (!inp || !inp.value) return alert("Elige la nueva fecha y hora.");
      run("video-propose", { id, when: new Date(inp.value).toISOString() });
    }));
  }
  async function loadVids() { try { vids = (await A.api("/api/admin?action=videos")).items || []; } catch (e) { vids = []; } }

  function threadView() {
    const s = thread.subscriber, qd = thread.quota;
    return `<div class="fa-plan-top"><div><h3>${esc(s.nombre || s.email)}</h3><small class="fa-sub-note"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></small></div>
        <span class="fa-pill ${cls(s.status)}">${esc(STATUS[s.status] || s.status)}</span></div>
      <dl class="fa-dl"><div><dt>Plan</dt><dd>${esc(s.planName || "—")}${s.amount ? " · " + clp(s.amount) : ""}</dd></div>
        <div><dt>Acceso hasta</dt><dd>${s.periodEnd ? fdate(s.periodEnd) : "—"}</dd></div>
        <div><dt>Preguntas del período</dt><dd>${qd.unlimited ? qd.used + " (ilimitado)" : qd.used + " de " + qd.limit}</dd></div></dl>
      <div class="fa-chat" id="faEqChat">${thread.messages.map((m) => `<div class="fa-m ${m.sender === "equipo" ? "fa-u" : "fa-a"}">${esc(m.body).replace(/\n/g, "<br>")}<small>${m.sender === "equipo" ? "Equipo" : "Cliente"} · ${fdate(m.created_at, true)}</small></div>`).join("") || `<p class="fa-sub-note">Sin mensajes.</p>`}</div>
      <form class="fa-input" id="faReply"><textarea id="faReplyMsg" rows="3" maxlength="4000" placeholder="Escribe la respuesta…" required></textarea><button class="btn btn-red btn-sm">Responder</button></form>
      <p class="fa-err" id="faReplyErr" hidden></p>`;
  }

  function bindThread() {
    const ch = $("#faEqChat"); if (ch) ch.scrollTop = ch.scrollHeight;
    const f = $("#faReply");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const ta = $("#faReplyMsg"), body = ta.value.trim(); if (!body) return;
      const b = $("button", f); b.disabled = true;
      try { await A.api("/api/admin?action=reply", { body: { user: sel, body } }); await open(sel, true); await refreshList(); }
      catch (ex) { const er = $("#faReplyErr"); er.hidden = false; er.textContent = ex.message; b.disabled = false; }
    };
  }

  async function open(id, keep) {
    sel = id;
    try { thread = await A.api("/api/admin?action=thread&user=" + encodeURIComponent(id)); }
    catch (e) { alert(e.message); return; }
    const it = list.items.find((s) => s.user_id === id); if (it) it.unread = 0;
    render();
  }

  async function refreshList() { list = await A.api("/api/admin?action=list"); await loadVids(); render(); }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  async function load() {
    root.innerHTML = `<p class="fa-ej mono">Cargando…</p>`;
    try {
      if (!(await A.session())) return loginView();
      list = await A.api("/api/admin?action=list");
      await loadVids();
      render();
      stop();
      timer = setInterval(() => { if (document.visibilityState === "visible" && !($("#faReplyMsg") && $("#faReplyMsg").value) && document.activeElement !== $("#faEqQ")) refreshList().catch(() => {}); }, 30000);
    } catch (e) {
      if (e.status === 401) return loginView();
      if (e.status === 403) { await A.signOut().catch(() => {}); return loginView(e.message); }
      root.innerHTML = `<div class="fa-card glass"><p>${esc(e.message)}</p></div>`;
    }
  }
  load();
})();
