/* Panel del equipo · «Accesos»: personas con plan. Dar acceso en 2 pasos, lista con filtros y «Últimos pagos recibidos» en palabras. */
(function () {
  const FAP = window.FAP, { $, $$, esc } = FAP, PLANS = (window.FA_CONFIG || {}).PLANS || {};
  const KEYS = ["basico", "pro", "premium"], err = (e) => FAP.friendly(e);
  const full = (k) => (PLANS[k] || {}).name || k, DAY = 86400000;
  const clp = (n) => (FAP.A.clp ? FAP.A.clp(n) : "$" + Number(n).toLocaleString("es-CL"));
  const EV = { PURCHASE_APPROVED: "Pago confirmado", PURCHASE_COMPLETE: "Compra completada", PURCHASE_CANCELED: "Compra cancelada", PURCHASE_REFUNDED: "Reembolso", PURCHASE_CHARGEBACK: "Reclamo del pago al banco", SUBSCRIPTION_CANCELLATION: "Suscripción cancelada" };
  const OUT = { applied: "Listo: el plan se actualizó", ignored: "No cambió nada", unmapped: "No coincide con ningún plan: avisa al administrador", stale: "Aviso antiguo: se ignoró", no_email: "Sin correo: no se pudo asignar" };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const dia = (iso) => FAP.fechaDia(iso);
  let filtro = "activos", q = "", hl = null;

  const estado = (a) => {
    if (a.status === "cancelada") return { t: "Desactivado", k: "bad" };
    if (!a.active) return { t: "Vencido", k: "warn" };
    if (a.status === "cancelada_fin_periodo") return { t: "Cancelado: vigente hasta " + dia(a.periodEnd), k: "warn" };
    return { t: "Activo", k: "ok" };
  };
  const porVencer = (a) => a.active && a.periodEnd && new Date(a.periodEnd).getTime() - Date.now() <= 7 * DAY;
  const FILT = { activos: (a) => a.active, vencer: porVencer, vencidos: (a) => !a.active, todos: () => true };

  async function render(main) {
    FAP.setTitle("Accesos");
    let alive = true, data = null;
    main.innerHTML = `<div class="fap-view"><div class="fap-head"><p class="fap-help" style="max-width:62ch">Las personas con un plan activo ven su material y pueden preguntar. Aquí ves quién tiene acceso y puedes dar o quitar uno.</p><button type="button" class="fap-btn" id="aDar">Dar acceso a una persona</button></div><div id="aBody"><div class="fap-skel" style="height:240px"></div></div></div>`;
    const body = $("#aBody", main);
    $("#aDar", main).onclick = () => dar();
    function paint() {
      const items = data.items, lista = items.filter(FILT[filtro]).filter((a) => !q || (a.email + " " + (a.buyerName || "")).toLowerCase().includes(q.toLowerCase()));
      body.innerHTML = `${data.hottokConfigured === false ? `<div class="fap-strip warn" style="margin-bottom:16px"><p>Los pagos en línea todavía no activan los planes solos. Mientras tanto usa «Dar acceso a una persona» y avisa al administrador del sitio.</p></div>` : ""}
        <div class="fap-field"><label for="aQ">Buscar por correo o nombre</label><input id="aQ" type="search" autocomplete="off" value="${esc(q)}"></div>
        <div class="fap-tabs chips" role="group" aria-label="Filtrar accesos" style="margin-bottom:14px">${[["activos", "Activos"], ["vencer", "Por vencer (7 días)"], ["vencidos", "Vencidos"], ["todos", "Todos"]].map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${filtro === k}">${t}</button>`).join("")}</div>
        <div id="aList" aria-live="polite">${lista.length ? `<div class="fap-items">${lista.map((a) => { const e = estado(a); return `<article class="fap-card fap-item ${hl === a.email ? "fap-slot flash" : ""}" id="a-${esc(a.id)}"><div class="top"><b>${esc(a.buyerName || a.email)}</b><span class="fap-chip info">${esc(full(a.plan))}</span><span class="fap-chip ${e.k}">${esc(e.t)}</span></div>
          <p class="fap-help">${esc(a.email)}${a.buyerName ? "" : ""}</p><p class="fap-help">${a.active || a.periodEnd ? "Vigente hasta " + esc(dia(a.periodEnd)) + " · " : ""}${a.source === "manual" ? "Agregado a mano" : "Pago en línea"} · ${a.hasAccount ? "Ya tiene cuenta" : "Aún no crea su cuenta"}</p>
          ${a.active ? `<div class="acts"><button type="button" class="fap-btn danger sm" data-q="${esc(a.id)}">Quitar acceso</button></div>` : ""}</article>`; }).join("")}</div>` : `<div class="fap-card"><p><b>${items.length ? "No hay personas en este filtro." : "Todavía no hay accesos."}</b></p><p class="fap-help">${items.length ? "Prueba con «Todos» o cambia lo que buscaste." : "Cuando alguien pague su plan, o cuando le des acceso a mano, aparecerá aquí."}</p></div>`}</div>
        <details class="fap-card" style="margin-top:24px"><summary style="min-height:48px;display:flex;align-items:center;cursor:pointer;font-weight:700">Últimos pagos recibidos</summary><div class="fap-items" style="margin-top:12px">${(data.events || []).length ? data.events.map((v) => `<article class="fap-card fap-item"><div class="top"><b>${esc(EV[v.event] || "Otro aviso de pago")}</b><span class="fap-chip ${v.outcome === "applied" ? "ok" : v.outcome === "ignored" || v.outcome === "stale" ? "" : "warn"}">${esc(OUT[v.outcome] || "—")}</span></div><p class="fap-help">${esc(v.email || "Sin correo")}${v.plan ? " · " + esc(full(v.plan)) : ""} · ${esc(FAP.fechaHora ? FAP.fechaHora(v.received_at) : dia(v.received_at))}</p></article>`).join("") : `<p class="fap-help">Todavía no llega ningún aviso de pago.</p>`}</div></details>`;
      $("#aQ", body).oninput = (e) => { q = e.target.value; const pos = e.target.selectionStart; paint(); const n = $("#aQ", body); n.focus(); n.setSelectionRange(pos, pos); };
      $$("[data-f]", body).forEach((b) => (b.onclick = () => { filtro = b.dataset.f; paint(); $(`[data-f="${filtro}"]`, body).focus(); }));
      const by = Object.fromEntries(items.map((a) => [a.id, a]));
      $$("[data-q]", body).forEach((b) => (b.onclick = () => quitar(by[b.dataset.q])));
      if (hl) { const c = $(".flash", body); if (c) c.scrollIntoView({ block: "center" }); setTimeout(() => { hl = null; }, 2500); }
    }
    async function load(force) {
      try { data = await FAP.get("access", force); if (alive) { paint(); if (FAP.intent === "dar") { FAP.intent = null; dar(); } } }
      catch (e) { if (!alive || e.handled) return; body.innerHTML = `<div class="fap-card"><p><b>No se pudo cargar la lista de accesos.</b></p><p class="fap-help">${esc(err(e))}</p><p style="margin-top:12px"><button type="button" class="fap-btn" data-re>Reintentar</button></p></div>`; $("[data-re]", body).onclick = () => load(true); }
    }
    const recargar = () => { FAP.drop("access", "summary"); return load(true); };

    async function quitar(a) {
      const r = await FAP.confirmar({ titulo: "¿Quitar este acceso?", cuerpo: `<p><b>${esc(a.buyerName || a.email)}</b><br>${esc(a.email)} · ${esc(full(a.plan))}</p><p>Esta persona dejará de ver el material y de poder preguntar. Podrás volver a darle acceso cuando quieras.</p>`, ok: "Quitar acceso", peligro: true });
      if (r !== "ok") return;
      try { await FAP.api("access-revoke", { body: { id: a.id } }); FAP.aviso("Acceso quitado.", "ok"); await recargar(); }
      catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
    }

    /* ---------- dar acceso: 1 Datos · 2 Confirmar ---------- */
    function dar() {
      const d = FAP.dialog({ title: "Dar acceso a una persona", side: true, cls: "sheet" }), labels = ["Datos", "Confirmar"];
      const S = { email: "", plan: "", until: "" }, hoy = FAP.hoyMas(0), max = FAP.hoyMas(395);
      function p1(msg, campo) {
        d.setSteps(labels, 0);
        d.body.innerHTML = `<div class="fap-field"><label for="dMail">Correo con el que la persona pagó</label><input id="dMail" type="email" inputmode="email" autocomplete="off" value="${esc(S.email)}" placeholder="nombre@correo.cl"></div>
          <fieldset class="fap-field" style="border:0;padding:0"><legend>Plan</legend><div class="fap-pick" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));grid-auto-rows:1fr">${KEYS.map((k) => `<label><input type="radio" name="dPlan" value="${k}" ${S.plan === k ? "checked" : ""}><b>${esc(full(k))}</b><span>${clp((PLANS[k] || {}).amount || 0)} al mes</span></label>`).join("")}</div></fieldset>
          <div class="fap-field"><label for="dUntil">Acceso hasta</label><input id="dUntil" type="date" min="${hoy}" max="${max}" value="${esc(S.until)}"><div class="fap-tabs chips" role="group" aria-label="Atajos de fecha" style="margin-top:6px"><button type="button" data-d="30">1 mes</button><button type="button" data-d="90">3 meses</button><button type="button" data-d="365">1 año</button></div><small>Máximo 13 meses.</small></div>
          <p class="fap-err" id="dErr" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
        $$("[data-d]", d.body).forEach((b) => (b.onclick = () => { $("#dUntil", d.body).value = FAP.hoyMas(+b.dataset.d); }));
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-n>Continuar</button>`;
        $("[data-c]", d.foot).onclick = () => d.close(null);
        $("[data-n]", d.foot).onclick = () => {
          S.email = $("#dMail", d.body).value.trim().toLowerCase(); S.plan = ($("[name=dPlan]:checked", d.body) || {}).value || ""; S.until = $("#dUntil", d.body).value;
          const m = (t, id) => { const e = $("#dErr", d.body); e.hidden = false; e.textContent = t; const f = $(id, d.body); if (f) f.focus(); };
          if (!EMAIL_RE.test(S.email)) return m(FAP.friendly({ code: "bad_email" }), "#dMail");
          if (!S.plan) return m(FAP.friendly({ code: "bad_plan" }), "[name=dPlan]");
          if (!S.until) return m(FAP.friendly({ code: "bad_until", message: "" }), "#dUntil");
          if (S.until < hoy) return m(FAP.friendly({ code: "bad_until", message: "ya pasó" }), "#dUntil");
          if (S.until > max) return m(FAP.friendly({ code: "bad_until", message: "13 meses" }), "#dUntil");
          p2();
        };
        d.focus(campo || "#dMail");
      }
      function p2(msg) {
        d.setSteps(labels, 1);
        const largo = FAP.fechaDia(new Date(S.until + "T12:00:00-03:00").toISOString());
        d.body.innerHTML = `<div class="fap-card"><p>Vas a dar el <b>${esc(full(S.plan))}</b> a <b>${esc(S.email)}</b> hasta el <b>${esc(largo)}</b>.</p><p class="fap-help">La persona lo verá cuando entre a su cuenta con ese correo.</p></div><p class="fap-err" id="dErr2" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-ok>Confirmar</button>`;
        $("[data-b]", d.foot).onclick = () => p1();
        $("[data-c]", d.foot).onclick = () => d.close(null);
        $("[data-ok]", d.foot).onclick = async () => {
          const b = $("[data-ok]", d.foot); b.disabled = true; b.textContent = "Guardando…";
          try { await FAP.api("access-grant", { body: { email: S.email, plan: S.plan, until: S.until } }); hl = S.email; filtro = "activos"; q = ""; FAP.aviso(`Listo: ${S.email} ya tiene el ${full(S.plan)}.`, "ok"); d.close("ok"); await recargar(); }
          catch (e) { if (e.handled) return; p2(err(e)); }
        };
        d.focus("[data-ok]");
      }
      p1();
    }
    load(false);
    return () => { alive = false; };
  }
  FAP.views.accesos = { render };
})();
