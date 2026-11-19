/* Panel del equipo · vista «Resumen»: qué hay que hacer hoy. Solo cifras reales de /api/admin?action=summary. */
(function () {
  const FAP = window.FAP, { $, $$, esc, ico } = FAP, M = window.FA_PANEL_MAPA;
  const PLANS = (window.FA_CONFIG || {}).PLANS || {};
  const PK = ["basico", "pro", "premium"];
  const pn = (k) => String((PLANS[k] || {}).name || k).replace(/^Plan /, "");
  const num = (n) => Number(n).toLocaleString("es-CL");
  const TIPO = { foto: "Foto o video cambiado", material: "Material de un plan", gratis: "Recurso gratis" };

  function skeleton() { return `<div class="fap-kpis" aria-hidden="true">${"<div class='fap-skel' style='min-height:196px'></div>".repeat(6)}</div>`; }
  const kpi = (kick, inner, btn) => `<section class="fap-card fap-kpi"><span class="fap-kick">${esc(kick)}</span>${inner}${btn || ""}</section>`;
  const link = (h, t) => `<a class="fap-btn sec sm" href="${h}">${esc(t)}</a>`;
  const tri = (obj, sub) => `<div class="tri">${PK.map((k) => `<div><div class="big">${num(obj[k])}</div><small>${esc(pn(k))}${sub ? "<br>" + esc(sub(k)) : ""}</small></div>`).join("")}</div>`;

  function cards(s) {
    const nm = s.messages, v = s.videos, sb = s.subscribers;
    const mat = Object.fromEntries(PK.map((k) => [k, s.material[k].total]));
    const prox = v.nextAt ? `Próxima: ${FAP.fechaLarga(v.nextAt)}` : "";
    return [
      kpi("Personas esperando respuesta", `<div class="big">${num(nm.people)}</div><p class="fap-help">${nm.people ? `${num(nm.messages)} ${nm.messages === 1 ? "mensaje" : "mensajes"} sin responder` : "Nadie espera respuesta. ¡Todo al día!"}</p>`, link("#/mensajes", "Responder mensajes")),
      kpi("Videollamadas por confirmar", `<div class="big">${num(v.pending)}</div><p class="fap-help">${v.pending ? esc(prox) : "No hay solicitudes nuevas."}</p>`, link("#/mensajes/videollamadas", "Ver videollamadas")),
      kpi("Suscriptores activos, por plan", tri(sb.byPlan), link("#/mensajes", "Ver personas")),
      kpi("Con problema de pago", `<div class="big">${num(sb.problems)}</div><p class="fap-help">${sb.problems ? "Personas con un cobro pendiente o fallido." : "Nadie tiene problemas de pago."}</p>`, link("#/mensajes", "Ver personas")),
      kpi("Accesos que vencen en 7 días", `<div class="big">${num(s.expiring)}</div><p class="fap-help">${s.expiring ? "Conviene avisarles antes de que termine." : "No vence ninguno esta semana."}</p>`, link("#/accesos", "Ver accesos")),
      kpi("Material por plan", tri(mat, (k) => `${s.material[k].hidden} ${s.material[k].hidden === 1 ? "oculto" : "ocultos"}`), link("#/planes", "Ver material")),
      kpi("Recursos gratis", `<div class="tri" style="grid-template-columns:1fr 1fr"><div><div class="big">${num(s.free.published)}</div><small>publicados</small></div><div><div class="big">${num(s.free.hidden)}</div><small>ocultos</small></div></div>`, link("#/paginas/gratis", "Ver recursos gratis")),
      kpi("Fotos y videos cambiados", `<div class="big">${num(s.media.changed)}</div><p class="fap-help">de ${num(s.media.total)} que se pueden cambiar en el sitio</p>`, link("#/paginas/inicio", "Ver las páginas")),
    ].join("");
  }

  function recientes(s) {
    if (!s.recent.length) return `<p class="fap-help">Todavía no se ha subido nada desde el panel.</p>`;
    return `<ul class="fap-list">${s.recent.map((r) => {
      const z = r.slot && M.por(r.slot), pg = z && M.pagina(z.pagina);
      const t = r.type === "foto" ? (z ? `${z.nombre} · ${pg ? pg.nombre : ""}` : "Foto o video del sitio") : r.title;
      return `<li><span><b>${esc(t)}</b><br><small class="fap-mut">${esc(TIPO[r.type] || "")}</small></span><span class="fap-mut">${esc(FAP.fechaCorta(r.at))}</span></li>`;
    }).join("")}</ul>`;
  }

  function limites(s) {
    const L = s.limits || {}, o = [];
    if (L.subscribers) o.push("los primeros 1.000 suscriptores");
    if (L.unread) o.push("los primeros 5.000 mensajes sin leer");
    if (L.access) o.push("los primeros 500 accesos");
    if (L.videos) o.push("las primeras 200 videollamadas");
    return o.length ? `<div class="fap-strip info"><p>Mostrando ${esc(o.join(", "))}. Puede haber más.</p></div>` : "";
  }

  async function render(main) {
    main.innerHTML = `<div class="fap-view"><p>Hola, <b>${esc(FAP.state.email)}</b>. Esto es lo que hay que hacer hoy.</p><div id="rBody">${skeleton()}</div></div>`;
    const body = $("#rBody", main);
    let alive = true;
    const paint = (s) => {
      if (!alive) return;
      body.innerHTML = `${limites(s)}
        <nav aria-label="Accesos rápidos"><div class="fap-quick">
          <a href="#/mensajes">${ico("chat")}Responder mensajes</a>
          <a href="#/paginas/inicio">${ico("photo")}Cambiar una foto del sitio</a>
          <button type="button" id="qSubir">${ico("upload")}Subir un archivo</button>
          <a href="#/accesos" data-dar>${ico("user")}Dar acceso a una persona</a></div></nav>
        <div class="fap-kpis">${cards(s)}</div>
        <section class="fap-card" style="margin-top:16px"><h2 style="margin-bottom:12px">Últimas subidas</h2>${recientes(s)}</section>
        <p class="fap-help" style="margin-top:16px">Ingreso mensual estimado: <b>${esc(window.FAAuth.clp(s.subscribers.mrr))}</b> (suma de los planes activos; es una estimación).</p>`;
      FAP.setBadge(s.messages.people);
      $("[data-dar]", body).onclick = () => { FAP.intent = "dar"; };
      $("#qSubir", body).onclick = subirDonde;
    };
    const load = async (force) => {
      body.innerHTML = skeleton();
      try { paint(await FAP.get("summary", force)); }
      catch (e) { if (!alive || e.handled) return; body.innerHTML = `<div class="fap-card"><p><b>No se pudo cargar el resumen.</b></p><p class="fap-help">${esc(e.friendly || FAP.friendly(e))}</p><p style="margin-top:12px"><button type="button" class="fap-btn" id="rRe">Reintentar</button></p></div>`; $("#rRe", body).onclick = () => load(true); }
    };
    FAP.onSummary = (s) => paint(s);
    await load(true);
    return () => { alive = false; FAP.onSummary = null; };
  }

  function subirDonde() {
    const d = FAP.dialog({ title: "¿Dónde quieres subirlo?" });
    d.body.innerHTML = `<div class="fap-pick"><a class="fap-opt" href="#/planes" data-x><b>Material para suscriptores</b><span>Ebooks y guías que ve solo quien tiene un plan activo.</span></a><a class="fap-opt" href="#/paginas/gratis" data-x><b>Recurso gratis</b><span>Videos y documentos que ve cualquier visitante en la página Gratis.</span></a></div>`;
    d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button>`;
    $("[data-c]", d.foot).onclick = () => d.close(null);
    $$("a[data-x]", d.body).forEach((a) => (a.onclick = () => d.close(null)));
    d.focus("a[data-x]");
  }
  FAP.views.resumen = { render };
})();
