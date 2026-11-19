/* Panel del equipo · vista «Mensajes»: preguntas de las personas suscritas y videollamadas (Plan Premium). */
(function () {
  const FAP = window.FAP, A = FAP.A, { $, $$, esc, ico } = FAP;
  const STATUS = { activa: ["Activa", "ok"], cancelada_fin_periodo: ["Cancela al terminar el período", "warn"], pago_pendiente: ["Pago en proceso", "warn"], pendiente: ["Por iniciar", "warn"], pendiente_tarjeta: ["Falta la tarjeta", "warn"], morosa: ["Pago atrasado", "bad"], cancelada: ["Cancelada", "bad"], sin_suscripcion: ["Sin plan", "bad"] };
  const PROBLEMA = ["morosa", "pago_pendiente", "pendiente_tarjeta"];
  const chip = (s) => { const t = STATUS[s] || [s, ""]; return `<span class="fap-chip ${t[1]}">${esc(t[0])}</span>`; };
  const VST = { solicitada: ["Pide confirmación", "warn"], propuesta: ["Esperando al cliente", "info"], confirmada: ["Confirmada", "ok"] };
  const jitUrl = (u) => /^https:\/\/meet\.jit\.si\/frioaustral-[0-9a-f-]{36}$/i.test(String(u || ""));
  const err = (e) => e.friendly || FAP.friendly(e);
  const LIM = 4000;

  async function render(main, cur) {
    const tab = cur.arg === "videollamadas" ? "videos" : "preguntas";
    let alive = true, list = null, vids = null, sel = null, thread = null, filter = "pendientes", q = "", timer = null;
    main.innerHTML = `<div class="fap-view"><div class="fap-tabs" role="group" aria-label="Qué quieres ver"><button type="button" data-t="preguntas" aria-pressed="${tab === "preguntas"}">Preguntas</button><button type="button" data-t="videos" aria-pressed="${tab === "videos"}">Videollamadas <span class="fap-badge" id="mvN" hidden></span></button></div><div id="mBody"></div></div>`;
    $$("[data-t]", main).forEach((b) => (b.onclick = () => FAP.go(b.dataset.t === "videos" ? "#/mensajes/videollamadas" : "#/mensajes")));
    const body = $("#mBody", main);
    const retry = (what, fn) => { body.innerHTML = `<div class="fap-card"><p><b>No se pudo cargar ${what}.</b></p><p class="fap-help" id="mErr"></p><p style="margin-top:12px"><button type="button" class="fap-btn" id="mRe">Reintentar</button></p></div>`; return (e) => { $("#mErr", body).textContent = err(e); $("#mRe", body).onclick = fn; }; };
    const pend = () => (vids || []).filter((v) => v.status === "solicitada").length;
    const cnt = () => { const n = $("#mvN", main); if (n) { n.hidden = !pend(); n.textContent = pend(); } };

    /* ---------- preguntas ---------- */
    const filtered = () => {
      let it = list.items;
      if (filter === "pendientes") it = it.filter((s) => s.unread > 0 || s.user_id === sel);
      else if (filter === "activos") it = it.filter((s) => s.canAsk);
      else if (filter === "problemas") it = it.filter((s) => PROBLEMA.includes(s.status));
      if (q) it = it.filter((s) => `${s.nombre || ""} ${s.email}`.toLowerCase().includes(q));
      return it.slice().sort((a, b) => (b.unread - a.unread) || String(b.lastUnreadAt || b.created_at).localeCompare(String(a.lastUnreadAt || a.created_at)));
    };
    const waiting = () => { const p = list.items.filter((s) => s.unread > 0); return { p: p.length, m: p.reduce((a, s) => a + s.unread, 0) }; };
    function paintList() {
      const ul = $("#mList", body); if (!ul) return;
      const had = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.u : null;
      const it = filtered();
      ul.innerHTML = it.map((s) => `<li><button type="button" data-u="${esc(s.user_id)}" ${sel === s.user_id ? 'aria-current="true"' : ""}><span class="row"><b>${esc(s.nombre || s.email)}</b>${s.unread ? `<span class="fap-badge" aria-label="${s.unread} sin leer">${s.unread}</span>` : ""}</span><small>${esc(s.planName || "Sin plan")}${s.unread ? " · " + esc(FAP.hace(s.lastUnreadAt)) : ""}</small>${chip(s.status)}</button></li>`).join("") || `<li class="fap-help" style="padding:12px">${filter === "pendientes" && !q ? "Nadie espera respuesta. ¡Todo al día!" : "No hay personas con ese filtro."}</li>`;
      $$("[data-u]", ul).forEach((b) => (b.onclick = () => open(b.dataset.u)));
      if (had) { const b = $(`[data-u="${had}"]`, ul); if (b) b.focus(); }
      const w = waiting(), h = $("#mWait", body);
      if (h) h.textContent = w.p ? `${w.p} ${w.p === 1 ? "persona" : "personas"} · ${w.m} ${w.m === 1 ? "mensaje" : "mensajes"} por responder` : "Nadie espera respuesta.";
      FAP.setBadge(w.p);
    }
    function paintPreguntas() {
      body.innerHTML = `<div class="fap-msgs two ${thread ? "open" : ""}" id="mTwo"><div class="fap-people"><p class="fap-help" id="mWait" aria-live="polite"></p>
          <div class="fap-tabs chips" role="group" aria-label="Filtrar personas">${[["pendientes", "Esperando respuesta"], ["activos", "Con plan activo"], ["problemas", "Con problema de pago"], ["todos", "Todos"]].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}</div>
          <div class="fap-field" style="margin:0"><label for="mQ">Buscar por nombre o correo</label><input id="mQ" type="search" autocomplete="off" value="${esc(q)}"></div>
          <ul class="fap-ppl" id="mList"></ul></div>
        <section class="fap-card fap-conv" id="mConv" aria-live="off"></section></div>`;
      $$("[data-f]", body).forEach((b) => (b.onclick = () => { filter = b.dataset.f; $$("[data-f]", body).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paintList(); }));
      $("#mQ", body).oninput = (e) => { q = e.target.value.trim().toLowerCase(); paintList(); };
      paintList(); paintConv();
    }
    function paintConv() {
      const c = $("#mConv", body); if (!c) return;
      if (!thread) { c.innerHTML = `<p class="fap-help">Elige una persona de la lista para ver sus mensajes y responderle.</p>`; return; }
      const s = thread.subscriber, qd = thread.quota, item = list.items.find((x) => x.user_id === sel);
      const un = item ? item.unread : 0;
      c.innerHTML = `<button type="button" class="fap-btn text sm" id="mBack" style="align-self:flex-start">${ico("back")} Volver</button>
        <div class="fap-head"><div><h2 style="font-size:26px">${esc(s.nombre || s.email)}</h2><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div><span>${chip(s.status)}</span></div>
        ${!thread.canAsk && s.periodEnd ? `<div class="fap-strip warn"><p>Su plan terminó el ${esc(FAP.fechaDia(s.periodEnd))}. Tus respuestas le siguen llegando a su cuenta.</p></div>` : ""}
        <dl class="meta"><div><dt>Plan</dt><dd>${esc(s.planName || "Sin plan")}</dd></div><div><dt>Acceso hasta</dt><dd>${esc(s.periodEnd ? FAP.fechaDia(s.periodEnd) : "—")}</dd></div><div><dt>Preguntas usadas</dt><dd>${qd.unlimited ? `${qd.used} · ilimitadas` : `${qd.used} de ${qd.limit}`}</dd></div></dl>
        ${un ? `<div class="fap-strip info"><p>${un} ${un === 1 ? "mensaje sin responder" : "mensajes sin responder"}. Se marcan como atendidos cuando respondes.</p><button type="button" class="fap-btn sec sm" id="mRead">Marcar como atendida</button></div>` : ""}
        <div class="fap-chat" id="mChat" tabindex="0" aria-label="Conversación">${thread.messages.map(bubble).join("") || `<p class="fap-help">Todavía no hay mensajes.</p>`}</div>
        <form class="fap-reply" id="mReply" novalidate><div class="fap-field"><label for="mMsg">Tu respuesta</label><textarea id="mMsg" name="body" maxlength="${LIM}" aria-describedby="mHelp mErr2"></textarea><p class="fap-help" id="mHelp">Enviar con Ctrl + Enter. <span id="mCnt"></span></p><p class="fap-err" id="mErr2" role="alert" hidden></p></div>
          <button class="fap-btn" id="mSend">Enviar respuesta</button></form>`;
      $("#mTwo", body).classList.add("open");
      const chat = $("#mChat", c); chat.scrollTop = chat.scrollHeight;
      $("#mBack", c).onclick = () => { sel = null; thread = null; $("#mTwo", body).classList.remove("open"); paintList(); paintConv(); };
      const ta = $("#mMsg", c), key = "reply:" + sel;
      ta.value = FAP.draft.get(key);
      const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(320, Math.max(110, ta.scrollHeight)) + "px"; const n = ta.value.length; $("#mCnt", c).textContent = n >= LIM - 600 ? `${n} de ${LIM} letras` : ""; };
      ta.oninput = () => { FAP.draft.set(key, ta.value); fit(); }; fit();
      ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $("#mReply", c).requestSubmit(); } };
      $("#mReply", c).onsubmit = send;
      const rd = $("#mRead", c); if (rd) rd.onclick = marcar;
    }
    const bubble = (m) => `<div class="fap-m ${m.sender === "equipo" ? "eq" : "cl"}">${esc(m.body).replace(/\n/g, "<br>")}<small>${m.sender === "equipo" ? "Equipo" : "Cliente"} · ${esc(FAP.fechaHora(m.created_at))}</small></div>`;
    async function open(id) {
      sel = id; thread = null;
      $("#mTwo", body).classList.add("open"); $("#mConv", body).innerHTML = `<div class="fap-skel" style="height:240px"></div>`; paintList();
      try { const t = await FAP.api("thread", { query: { user: id, mark: "0" } }); if (!alive || sel !== id) return; thread = t; paintConv(); $("#mMsg", body).focus({ preventScroll: true }); }
      catch (e) { if (!alive || e.handled) return; $("#mConv", body).innerHTML = `<p class="fap-err" role="alert">${esc(err(e))}</p><p><button type="button" class="fap-btn sm" id="mRe2">Reintentar</button></p>`; $("#mRe2", body).onclick = () => open(id); }
    }
    async function send(e) {
      e.preventDefault();
      const c = $("#mConv", body), ta = $("#mMsg", c), b = $("#mSend", c), er = $("#mErr2", c), text = ta.value.trim();
      er.hidden = true;
      if (!text) { er.hidden = false; er.textContent = "Escribe la respuesta antes de enviarla."; ta.focus(); return; }
      if (text.length > LIM) { er.hidden = false; er.textContent = `La respuesta es muy larga (máximo ${LIM} letras).`; ta.focus(); return; }
      b.disabled = true; b.classList.add("spin"); b.textContent = "Enviando…";
      try {
        const r = await FAP.api("reply", { body: { user: sel, body: text } });
        FAP.draft.set("reply:" + sel, ""); ta.value = "";
        thread.messages.push(r.message || { sender: "equipo", body: text, created_at: new Date().toISOString() });
        const it = list.items.find((x) => x.user_id === sel); if (it) it.unread = 0;
        const chat = $("#mChat", c); chat.insertAdjacentHTML("beforeend", bubble(thread.messages[thread.messages.length - 1])); chat.scrollTop = chat.scrollHeight;
        const rd = $("#mRead", c); if (rd) rd.closest(".fap-strip").remove();
        paintList(); FAP.aviso("Respuesta enviada.", "ok"); ta.style.height = "auto"; ta.focus();
      } catch (ex) { if (ex.handled) return; er.hidden = false; er.textContent = err(ex); }
      b.disabled = false; b.classList.remove("spin"); b.textContent = "Enviar respuesta";
    }
    async function marcar() {
      try { await FAP.api("mark-read", { body: { user: sel } }); const it = list.items.find((x) => x.user_id === sel); if (it) it.unread = 0; FAP.drop("summary"); paintList(); paintConv(); FAP.aviso("Listo: la conversación quedó como atendida.", "ok"); }
      catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
    }
    async function loadPreguntas(force) {
      body.innerHTML = `<div class="fap-skel" style="height:300px"></div>`;
      try { list = await FAP.get("list", force); if (!vids) FAP.get("videos").then((v) => { vids = v.items || []; cnt(); }).catch(() => {}); if (alive) paintPreguntas(); }
      catch (e) { if (alive && !e.handled) retry("las preguntas", () => loadPreguntas(true))(e); }
    }

    /* ---------- videollamadas ---------- */
    const quien = (v) => v.nombre || v.email;
    function vCard(v) {
      const s = VST[v.status] || [v.status, ""];
      let a = "";
      if (v.status === "solicitada") a += `<button type="button" class="fap-btn" data-vc="${esc(v.id)}">Confirmar</button>`;
      if (v.status === "confirmada") a += v.canJoin && jitUrl(v.url) ? `<a class="fap-btn" href="${esc(v.url)}" target="_blank" rel="noopener">Entrar a la videollamada ${ico("ext")}</a>` : `<button type="button" class="fap-btn" aria-disabled="true" data-nojoin>Entrar a la videollamada</button><p class="fap-help">Se habilita 10 minutos antes de la hora.</p>`;
      a += `<button type="button" class="fap-btn sec" data-vp="${esc(v.id)}">Proponer otra hora</button><button type="button" class="fap-btn danger" data-vx="${esc(v.id)}">${ico("trash")} Cancelar videollamada</button>`;
      return `<article class="fap-card fap-vc" data-v="${esc(v.id)}"><span class="fap-kick">${esc(quien(v))}</span><h3>${esc(FAP.fechaLarga(v.scheduledAt))}</h3><div><span class="fap-chip ${s[1]}">${esc(s[0])}</span></div>${v.note ? `<p class="fap-help">Nota: ${esc(v.note)}</p>` : ""}<div class="acts">${a}</div></article>`;
    }
    function paintVideos() {
      cnt();
      body.innerHTML = `<div class="fap-view"><div class="fap-strip info"><p>Se abre en una pestaña nueva, sin límite de tiempo. El primero del equipo en entrar puede tener que iniciar sesión con Google o GitHub para abrir la sala.</p></div>
        ${vids.length ? `<div class="fap-vcards">${vids.map(vCard).join("")}</div>` : `<div class="fap-card"><p>No hay videollamadas pedidas por ahora.</p><p class="fap-help">Cuando una persona con Plan Premium pida una, aparecerá aquí.</p></div>`}</div>`;
      $$("[data-vc]", body).forEach((b) => (b.onclick = () => confirmarV(b.dataset.vc)));
      $$("[data-vp]", body).forEach((b) => (b.onclick = () => proponer(b.dataset.vp)));
      $$("[data-vx]", body).forEach((b) => (b.onclick = () => cancelarV(b.dataset.vx)));
      $$("[data-nojoin]", body).forEach((b) => (b.onclick = () => FAP.aviso("La sala se habilita 10 minutos antes de la hora.")));
    }
    const vid = (id) => vids.find((v) => v.id === id);
    async function accionV(action, payload, ok) {
      try { await FAP.api(action, { body: payload }); vids = (await FAP.get("videos", true)).items || []; FAP.drop("summary"); if (alive) paintVideos(); FAP.aviso(ok, "ok"); return true; }
      catch (e) { if (!e.handled) { FAP.aviso(err(e), "bad"); if (e.code === "bad_state" || e.code === "not_found") { vids = (await FAP.get("videos", true).catch(() => ({ items: vids }))).items || []; if (alive) paintVideos(); } } return false; }
    }
    async function confirmarV(id) {
      const v = vid(id); if (!v) return;
      const r = await FAP.confirmar({ titulo: "¿Confirmar la videollamada?", cuerpo: `<p>Vas a confirmar la videollamada con <b>${esc(quien(v))}</b> el <b>${esc(FAP.fechaLarga(v.scheduledAt))}</b>.</p>`, ok: "Confirmar" });
      if (r === "ok") accionV("video-confirm", { id }, "Videollamada confirmada.");
    }
    async function cancelarV(id) {
      const v = vid(id); if (!v) return;
      const r = await FAP.confirmar({ titulo: "¿Cancelar la videollamada?", cuerpo: `<p>Se cancelará la videollamada con <b>${esc(quien(v))}</b> del <b>${esc(FAP.fechaLarga(v.scheduledAt))}</b>. La persona dejará de verla.</p>`, ok: "Cancelar videollamada", cancelar: "No cancelar", peligro: true });
      if (r === "ok") accionV("video-cancel", { id }, "Videollamada cancelada.");
    }
    function proponer(id) {
      const v = vid(id); if (!v) return;
      const d = FAP.dialog({ title: "Proponer otra hora" });
      d.body.innerHTML = `<p>Para <b>${esc(quien(v))}</b>. Hoy está para el ${esc(FAP.fechaLarga(v.scheduledAt))}.</p>
        <form id="pF" novalidate><div class="fap-field"><label for="pD">Día</label><input id="pD" name="dia" type="date" min="${FAP.hoyMas(0)}" max="${FAP.hoyMas(90)}" aria-describedby="pH pE"></div>
        <div class="fap-field"><label for="pT">Hora (hora de Chile)</label><input id="pT" name="hora" type="time" aria-describedby="pH pE"></div>
        <p class="fap-help" id="pH">Con al menos 30 minutos de anticipación y dentro de los próximos 90 días.</p>
        <div class="fap-field"><label for="pN">Mensaje para la persona (opcional)</label><textarea id="pN" name="note" maxlength="500" rows="2"></textarea></div>
        <p class="fap-err" id="pE" role="alert" hidden></p></form>`;
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-s>Enviar propuesta</button>`;
      const f = $("#pF", d.body); FAP.bindDraft(f, "propose:" + id);
      $("[data-c]", d.foot).onclick = () => d.close(null);
      const fail = (t, el) => { const e = $("#pE", d.body); e.hidden = false; e.textContent = t; el.setAttribute("aria-invalid", "true"); el.focus(); };
      $("[data-s]", d.foot).onclick = async () => {
        $$("[aria-invalid]", f).forEach((x) => x.removeAttribute("aria-invalid")); $("#pE", d.body).hidden = true;
        if (!f.dia.value) return fail("Elige el día.", f.dia);
        if (!f.hora.value) return fail("Elige la hora.", f.hora);
        const iso = FAP.santiagoIso(f.dia.value, f.hora.value), t = new Date(iso).getTime();
        if (t < Date.now() + 30 * 60000) return fail("Elige una hora con al menos 30 minutos de anticipación.", f.hora);
        if (t > Date.now() + 90 * 86400000) return fail("Elige una hora dentro de los próximos 90 días.", f.dia);
        const b = $("[data-s]", d.foot); b.disabled = true; b.classList.add("spin"); b.textContent = "Enviando…";
        const ok = await accionV("video-propose", { id, when: iso, note: f.note.value }, "Propuesta enviada.");
        if (ok) { FAP.draft.clear("propose:" + id); d.close("ok"); } else { b.disabled = false; b.classList.remove("spin"); b.textContent = "Enviar propuesta"; }
      };
      d.focus("#pD");
    }
    async function loadVideos(force) {
      body.innerHTML = `<div class="fap-skel" style="height:240px"></div>`;
      try { vids = (await FAP.get("videos", force)).items || []; if (alive) paintVideos(); }
      catch (e) { if (alive && !e.handled) retry("las videollamadas", () => loadVideos(true))(e); }
    }

    /* ---------- actualización automática cada 30 s: solo la lista y los contadores ---------- */
    async function refresh() {
      if (document.visibilityState !== "visible" || !alive || !body.querySelector) return;
      try {
        const [l, v] = await Promise.all([FAP.get("list", true), FAP.get("videos", true)]);
        if (!alive) return; list = l; vids = v.items || []; cnt(); FAP.live("");
        if (tab === "preguntas" && $("#mList", body)) paintList();
        else if (tab === "videos" && !$("dialog,.fap-back")) paintVideos();
      } catch (e) { if (!e.handled) FAP.live("No pudimos actualizar. Reintentando…"); }
    }
    (tab === "videos" ? loadVideos(true) : loadPreguntas(true));
    timer = setInterval(refresh, 30000);
    return () => { alive = false; clearInterval(timer); FAP.live(""); };
  }
  FAP.views.mensajes = { render };
})();
