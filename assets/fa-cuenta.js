/* Panel "Mi cuenta" del suscriptor: plan, estado, próximo cobro, cupo, chat con el equipo, pagos,
   cancelar, cambiar plan y cambiar tarjeta. Datos reales vía /api/account (Supabase + Flow). */
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
    pago_pendiente: ["Pago en proceso", "fa-warn"],
    pendiente: ["Por iniciar", "fa-warn"],
    pendiente_tarjeta: ["Falta registrar tarjeta", "fa-warn"],
    morosa: ["Pago atrasado", "fa-bad"],
    cancelada: ["Cancelada", "fa-bad"],
    sin_suscripcion: ["Sin suscripción", "fa-bad"],
  };

  function notice() {
    const map = {
      "alta=ok": ["ok", "¡Listo! Tu suscripción quedó creada. Flow cobra el primer mes en tu tarjeta; en cuanto se confirme el pago puedes empezar a preguntar."],
      "tarjeta=ok": ["ok", "Tu tarjeta quedó registrada para los próximos cobros."],
      "tarjeta=rechazada": ["bad", "Flow no pudo registrar la tarjeta. Intenta de nuevo con otra tarjeta de crédito."],
      "tarjeta=error": ["bad", "No pudimos confirmar el registro con Flow. Revisa tu estado abajo o intenta de nuevo."],
    };
    for (const k of Object.keys(map)) {
      const [key, val] = k.split("=");
      if (qs.get(key) === val) return `<div class="fa-cta-msg ${map[k][0]}" role="status">${map[k][1]}</div>`;
    }
    return "";
  }

  /* ---------- Login / recuperación ---------- */
  function loginView(msg) {
    stopPoll();
    const forgot = qs.get("olvide") === "1";
    root.innerHTML = `
      <div class="fa-auth glass">
        <h2>${forgot ? "Recuperar contraseña" : "Ingresa a tu cuenta"}</h2>
        <p class="fa-sub-note">${forgot ? "Te enviamos un correo con un enlace para crear una contraseña nueva." : "Usa el email y la contraseña con que te suscribiste."}</p>
        <form id="faLoginForm" novalidate>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          ${forgot ? "" : `<label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>`}
          <p class="fa-flow-err" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>
          <button class="btn btn-red" type="submit">${forgot ? "Enviar enlace" : "Ingresar"}</button>
        </form>
        <p class="fa-sub-note">${forgot ? `<a href="mi-cuenta.html">Volver a ingresar</a>` : `<a href="mi-cuenta.html?olvide=1">Olvidé mi contraseña</a> · ¿No tienes suscripción? <a href="planes.html">Ver planes</a>`}</p>
      </div>`;
    const f = $("#faLoginForm"), err = $(".fa-flow-err", f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(f), btn = $("button", f);
      err.hidden = true; btn.disabled = true;
      try {
        if (forgot) {
          await A.resetPassword(d.get("email"));
          err.hidden = false; err.style.color = "var(--ice, #9fe3ff)";
          err.textContent = "Si el email tiene cuenta, te llegará un correo en unos minutos.";
        } else {
          await A.signIn(d.get("email"), d.get("password"));
          history.replaceState(null, "", "mi-cuenta.html" + (qs.get("alta") ? "?alta=" + qs.get("alta") : ""));
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
          <p class="fa-flow-err" role="alert" hidden></p>
          <button class="btn btn-red" type="submit">Guardar contraseña</button>
        </form>
      </div>`;
    const f = $("#faRecForm"), err = $(".fa-flow-err", f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const p = String(new FormData(f).get("password") || "");
      if (p.length < 8) { err.hidden = false; err.textContent = "Mínimo 8 caracteres."; return; }
      try { await A.updatePassword(p); history.replaceState(null, "", "mi-cuenta.html"); await load(); }
      catch (ex) { err.hidden = false; err.textContent = ex.message; }
    };
  }

  /* ---------- Panel ---------- */
  function planCard(s) {
    const st = STATUS[s.status] || [s.status, ""];
    if (!s.hasSubscription) {
      return `<div class="fa-card glass fa-plancard">
        <div><span class="mono fa-ej">Tu plan</span><h3>${s.pendingPlan ? esc((PLANS[s.pendingPlan] || {}).name || "") + " (pendiente)" : "Aún no tienes un plan"}</h3>
        <span class="fa-pill ${st[1]}">${esc(st[0])}</span></div>
        <p class="fa-sub-note">${s.status === "pendiente_tarjeta" ? "Falta registrar tu tarjeta en Flow para activar el cobro mensual." : "Elige un plan para empezar a preguntarle al equipo de Frío Austral."}</p>
        <div class="fa-row">${s.status === "pendiente_tarjeta" && s.pendingPlan ? `<button class="btn btn-red btn-sm" data-act="retry" data-plan="${esc(s.pendingPlan)}">Registrar tarjeta</button>` : ""}<a class="btn ${s.status === "pendiente_tarjeta" ? "btn-line" : "btn-red"} btn-sm" href="planes.html">Ver planes</a></div>
      </div>`;
    }
    const others = Object.keys(PLANS).filter((k) => k !== s.plan);
    const canManage = s.status !== "cancelada";
    return `<div class="fa-card glass fa-plancard">
      <div class="fa-plan-top"><div><span class="mono fa-ej">Tu plan</span><h3>${esc(s.planName || "")} <small>${clp(s.amount)} / mes</small></h3></div>
      <span class="fa-pill ${st[1]}">${esc(st[0])}</span></div>
      <dl class="fa-dl">
        <div><dt>${s.cancelAtPeriodEnd ? "Acceso hasta" : "Próximo cobro"}</dt><dd>${s.cancelAtPeriodEnd ? fdate(s.periodEnd) : s.nextChargeAt ? fdate(s.nextChargeAt) : "—"}</dd></div>
        <div><dt>Período actual</dt><dd>${s.periodStart ? fdate(s.periodStart) + " – " + fdate(s.periodEnd) : "—"}</dd></div>
        <div><dt>Tarjeta</dt><dd>${s.card ? esc(s.card.brand || "Tarjeta") + " ···· " + esc(s.card.last4) : "Sin tarjeta registrada"}</dd></div>
      </dl>
      ${s.status === "morosa" ? `<p class="fa-cta-msg bad">Hay un cobro atrasado. Revisa tu tarjeta o cámbiala; Flow reintenta el cobro automáticamente.</p>` : ""}
      ${canManage ? `<div class="fa-row fa-actions">
        <button class="btn btn-line btn-sm" data-act="card">${s.card ? "Cambiar tarjeta" : "Registrar tarjeta"}</button>
        ${!s.cancelAtPeriodEnd ? `<label class="fa-inline">Cambiar a <select id="faNewPlan">${others.map((k) => `<option value="${k}">${esc(PLANS[k].name)} · ${clp(PLANS[k].amount)}</option>`).join("")}</select></label><button class="btn btn-line btn-sm" data-act="plan">Cambiar plan</button>` : ""}
        ${!s.cancelAtPeriodEnd ? `<button class="btn btn-line btn-sm fa-danger" data-act="cancel">Cancelar suscripción</button>` : ""}
      </div>` : `<div class="fa-row"><a class="btn btn-red btn-sm" href="planes.html">Volver a suscribirme</a></div>`}
    </div>`;
  }

  function quotaCard(st) {
    const q = st.quota, s = st.subscriber;
    if (!s.hasSubscription) return "";
    const pct = q.unlimited ? 100 : Math.min(100, Math.round((q.used / Math.max(1, q.limit)) * 100));
    return `<div class="fa-card glass fa-quota">
      <span class="mono fa-ej">Preguntas de este período</span>
      <b>${q.unlimited ? "Ilimitadas" : `${q.left} de ${q.limit} disponibles`}</b>
      ${q.unlimited ? `<small>Llevas ${q.used} en este período.</small>` : `<div class="fa-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.limit}" aria-valuenow="${q.used}"><i style="width:${pct}%"></i></div><small>Usaste ${q.used}. Se renuevan con cada cobro mensual${q.periodTo ? " (" + fdate(q.periodTo) + ")" : ""}.</small>`}
      ${st.features.calls ? `<a class="btn btn-wa btn-sm" href="${esc(C.CALLS_WHATSAPP_URL || "#")}" target="_blank" rel="noopener">Agendar llamada o videollamada</a>` : ""}
    </div>`;
  }

  function chatPane(st) {
    const msgs = st.messages.map((m) => `<div class="fa-m ${m.sender === "cliente" ? "fa-u" : "fa-a"}">${esc(m.body).replace(/\n/g, "<br>")}<small>${m.sender === "cliente" ? "Tú" : "Equipo Frío Austral"} · ${fdate(m.created_at, true)}</small></div>`).join("")
      || `<p class="fa-ej mono">Aún no hay mensajes. Escribe tu primera pregunta: describe el vehículo (marca, modelo, año), el síntoma y lo que ya revisaste.</p>`;
    let block = "";
    if (!st.subscriber.hasSubscription) block = `Necesitas un plan activo para preguntar. <a class="btn btn-red btn-sm" href="planes.html">Ver planes</a>`;
    else if (!st.canAsk) block = st.subscriber.status === "pago_pendiente" ? "Estamos esperando la confirmación del pago de Flow. Actualiza en unos minutos." : "Tu suscripción no está activa. Regulariza el pago o vuelve a suscribirte para seguir preguntando.";
    else if (!st.quota.unlimited && st.quota.left <= 0) block = `Usaste tus ${st.quota.limit} preguntas de este período. Puedes cambiarte al plan Ilimitado desde arriba.`;
    return `<div class="fa-chat" id="faChat" aria-live="polite">${msgs}</div>
      ${block ? `<div class="fa-block">${block}</div>` : ""}
      <form class="fa-input" id="faMsgForm"><textarea id="faMsg" rows="2" maxlength="4000" placeholder="Escribe tu pregunta…" ${block ? "disabled" : ""} required></textarea><button class="btn btn-red btn-sm" ${block ? "disabled" : ""}>Enviar</button></form>
      <p class="fa-flow-err" id="faMsgErr" role="alert" hidden></p>`;
  }

  function paysPane(st) {
    if (!st.payments.length) return `<p class="fa-sub-note">Todavía no hay cobros registrados.</p>`;
    return `<div class="v5-tw"><table class="v5-tab fa-paytab"><thead><tr><th>Período</th><th>Monto</th><th>Estado</th><th>Fecha de pago</th></tr></thead><tbody>
      ${st.payments.map((p) => `<tr><td>${p.period_start ? fdate(p.period_start) + " – " + fdate(p.period_end) : esc(p.subject || "")}</td><td>${clp(p.amount)}</td><td><span class="fa-pill ${p.status === "pagado" ? "fa-ok" : p.status === "anulado" ? "" : "fa-bad"}">${esc(p.status)}</span>${p.payment_link ? ` <a href="${esc(p.payment_link)}" target="_blank" rel="noopener">Pagar</a>` : ""}</td><td>${p.paid_at ? fdate(p.paid_at) : "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  function render() {
    const st = state, s = st.subscriber;
    root.innerHTML = `
      ${notice()}
      ${st.flowEnv === "sandbox" ? `<p class="fa-cta-msg warn mono">Modo de prueba (Flow sandbox): no se cobra dinero real.</p>` : ""}
      <div class="fa-acc-head"><div><span class="mono fa-ej">Mi cuenta</span><h2>Hola, ${esc(s.nombre || s.email)}</h2><small class="fa-sub-note">${esc(s.email)}</small></div>
        <button class="btn btn-line btn-sm" id="faOut">Cerrar sesión</button></div>
      <div class="fa-acc-grid">${planCard(s)}${quotaCard(st)}</div>
      <div class="fa-tabs" role="tablist">
        <button data-tab="chat" class="${tab === "chat" ? "on" : ""}">Chat con el equipo</button>
        <button data-tab="pagos" class="${tab === "pagos" ? "on" : ""}">Pagos</button>
        ${st.features.community ? `<button data-tab="base" class="${tab === "base" ? "on" : ""}">Base de preguntas</button>` : ""}
      </div>
      <div class="fa-pane glass" data-pane="chat" ${tab === "chat" ? "" : "hidden"}>${chatPane(st)}</div>
      <div class="fa-pane glass" data-pane="pagos" ${tab === "pagos" ? "" : "hidden"}>${paysPane(st)}</div>
      ${st.features.community ? `<div class="fa-pane glass" data-pane="base" ${tab === "base" ? "" : "hidden"}><form id="faBaseForm" class="fa-input"><input name="q" placeholder="Busca por síntoma, vehículo, gas…"><button class="btn btn-line btn-sm">Buscar</button></form><div id="faBase"><p class="fa-sub-note">Busca entre las preguntas ya respondidas por el equipo.</p></div></div>` : ""}`;
    const chat = $("#faChat"); if (chat) chat.scrollTop = chat.scrollHeight;
    $("#faOut").onclick = async () => { await A.signOut(); state = null; loginView(); };
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.getAttribute("data-tab"); render(); if (tab === "base") search(""); }));
    root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => act(b.getAttribute("data-act"), b)));
    const mf = $("#faMsgForm");
    if (mf) mf.onsubmit = sendMsg;
    const ta = $("#faMsg");
    if (ta) ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) mf.requestSubmit(); };
    const bf = $("#faBaseForm");
    if (bf) bf.onsubmit = (e) => { e.preventDefault(); search(new FormData(bf).get("q")); };
  }

  async function search(q) {
    const box = $("#faBase"); if (!box) return;
    box.innerHTML = `<p class="fa-sub-note">Buscando…</p>`;
    try {
      const out = await A.api("/api/account?action=community&q=" + encodeURIComponent(q || ""));
      box.innerHTML = out.items.map((i) => `<div class="fa-q"><b>${esc(i.pregunta)}</b><p>${esc(i.respuesta)}</p><small class="fa-sub-note">${fdate(i.fecha)}</small></div>`).join("") || `<p class="fa-sub-note">Sin resultados.</p>`;
    } catch (e) { box.innerHTML = `<p class="fa-flow-err">${esc(e.message)}</p>`; }
  }

  async function sendMsg(e) {
    e.preventDefault();
    const ta = $("#faMsg"), err = $("#faMsgErr"), btn = $("#faMsgForm button");
    const body = ta.value.trim(); if (!body) return;
    btn.disabled = true; err.hidden = true;
    try { await A.api("/api/account?action=message", { body: { body } }); ta.value = ""; await load(true); }
    catch (ex) { err.hidden = false; err.textContent = ex.message; btn.disabled = false; }
  }

  async function act(kind, btn) {
    const s = state.subscriber;
    try {
      if (kind === "cancel") {
        if (!confirm(`¿Cancelar tu suscripción? No se te cobrará más. Puedes seguir preguntando hasta el ${fdate(s.periodEnd)}.`)) return;
        btn.disabled = true;
        await A.api("/api/account?action=cancel", { body: {} });
        await load(true);
      } else if (kind === "plan") {
        const np = $("#faNewPlan").value, p = PLANS[np];
        if (!confirm(`¿Cambiar al plan ${p.name} (${clp(p.amount)} al mes)? Flow aplica el nuevo valor desde el próximo cobro según sus reglas de cambio de plan.`)) return;
        btn.disabled = true;
        await A.api("/api/account?action=change-plan", { body: { plan: np } });
        await load(true);
      } else if (kind === "card") {
        btn.disabled = true;
        const out = await A.api("/api/account?action=change-card", { body: {} });
        location.href = out.redirect;
      } else if (kind === "retry") {
        btn.disabled = true;
        const out = await A.api("/api/account?action=start", { body: { plan: btn.getAttribute("data-plan") } });
        location.href = out.redirect;
      }
    } catch (e) { alert(e.message); btn.disabled = false; }
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
