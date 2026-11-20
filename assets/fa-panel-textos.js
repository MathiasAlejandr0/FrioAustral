/* Panel del equipo · textos de cada página, en el mismo mapa que las fotos.
   Editor simple: cuadro, contador, negrita y salto de línea. Publicar, volver al original y volver al anterior. */
(function () {
  const FAP = window.FAP, { $, $$, esc, ico } = FAP, M = window.FA_PANEL_MAPA, TX = window.FA_TEXTOS, AP = window.FA_APLICAR_TEXTOS;
  const PAGO = new RegExp(["hot", "mart"].join(""), "i");
  const err = (e) => e.friendly || FAP.friendly(e);

  function piezas(pg) {
    const txs = TX.de(pg.slug).map((t) => ({ tipo: "texto", id: t.id, pos: (t.pos && t.pos[pg.slug]) || 0, seccion: t.seccion }));
    const fts = pg.ids.map((id) => ({ tipo: "foto", id, pos: (TX.FOTOS[id] && TX.FOTOS[id][pg.slug]) || 0, seccion: M.por(id).seccion }));
    const all = txs.concat(fts).sort((a, b) => a.pos - b.pos || (a.tipo === "foto" ? -1 : 1));
    const num = {};
    all.forEach((it, i) => { num[it.id] = i + 1; });
    const blocks = [];
    for (const it of all) {
      let b = blocks[blocks.length - 1];
      if (!b || b.titulo !== it.seccion) { b = { titulo: it.seccion, fotos: [], textos: [] }; blocks.push(b); }
      (it.tipo === "foto" ? b.fotos : b.textos).push(it);
    }
    for (const s of pg.secciones) {
      if (!s.recursos) continue;
      let b = blocks.find((x) => x.titulo === s.titulo);
      if (!b) { b = { titulo: s.titulo, fotos: [], textos: [], recursos: s.recursos }; blocks.push(b); }
      else b.recursos = s.recursos;
    }
    return { all, num, blocks };
  }

  function fila(t, n, custom) {
    const actual = custom ? custom.body : t.texto;
    return `<article class="fap-card fap-tx" id="tx-${esc(t.id).replace(/\./g, "-")}" data-tx="${esc(t.id)}">
      <span class="fap-num" aria-hidden="true">${n}</span>
      <div class="tx"><span class="fap-kick">${esc(t.etiqueta)} · ${esc(t.seccion)}</span>
        <p>${esc(actual)}</p>
        <span class="fap-chip ${custom ? "info" : ""}">${custom ? "Cambiado el " + esc(FAP.fechaCorta(custom.updatedAt)) : "Original del sitio"}</span></div>
      <div class="acts"><button type="button" class="fap-btn" data-texto="${esc(t.id)}">Editar texto</button>
        <button type="button" class="fap-btn sec sm" data-mapa="${esc(t.id)}">Ver en el mapa</button>
        ${custom ? `<button type="button" class="fap-btn danger sm" data-torig="${esc(t.id)}">Volver al original</button>` : ""}
        ${custom && custom.hasPrevious ? `<button type="button" class="fap-btn sec sm" data-tant="${esc(t.id)}">Volver al anterior</button>` : ""}</div></article>`;
  }

  function muestra(texto) {
    const d = document.createElement("div");
    d.className = "fap-muestra";
    AP.aplicar(d, texto);
    return d;
  }

  function validar(t, valor) {
    const v = AP.limpiar(valor);
    if (!v.trim()) return "Escribe el texto. Si quieres el de siempre, usa «Volver al original».";
    if (/[<>]/.test(v)) return "Solo se puede escribir texto. Quita los símbolos de código.";
    if (PAGO.test(v)) return "Ese texto no puede nombrar al servicio de pago.";
    if ([...v].length > t.max) return `Máximo ${t.max} caracteres. Ahora tiene ${[...v].length}.`;
    return "";
  }

  function editar(pg, id, custom, alCerrar) {
    const t = TX.byId(id), actual = custom ? custom.body : t.texto;
    const S = { valor: actual };
    const d = FAP.dialog({ title: "Editar texto", side: true, cls: "sheet" });
    const labels = ["Escribir", "Revisar", "Publicar"], maps = [];
    d.veto = () => (maps.forEach((m) => m.destroy()), true);
    const head = () => `<p class="fap-help">${esc(pg.nombre)} · ${esc(t.seccion)} · ${esc(t.etiqueta)}</p>`;
    function paso1(msg) {
      d.setSteps(labels, 0); d.title("Editar texto");
      d.body.innerHTML = head() + `<div class="fap-field"><label for="txIn">Texto que se verá en el sitio</label>
        <textarea id="txIn" rows="6" maxlength="${t.max}">${esc(S.valor)}</textarea>
        <p class="fap-count" id="txC" aria-live="polite"></p></div>
        <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="fap-btn sec sm" data-b>Negrita</button><button type="button" class="fap-btn sec sm" data-s>Salto de línea</button></div>
        <p class="fap-help">La negrita marca una palabra entre asteriscos. Un salto de línea baja el texto. No pegues código.</p>
        <p class="fap-err" id="txE" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-n>Revisar</button>`;
      const ta = $("#txIn", d.body), cont = () => { const n = [...ta.value].length; $("#txC", d.body).textContent = `${n} de ${t.max} caracteres.`; };
      ta.oninput = cont; cont();
      $("[data-b]", d.body).onclick = () => {
        const a = ta.selectionStart, z = ta.selectionEnd, sel = ta.value.slice(a, z) || "texto";
        ta.setRangeText(`**${sel}**`, a, z, "end"); ta.focus(); cont();
      };
      $("[data-s]", d.body).onclick = () => { const a = ta.selectionStart; ta.setRangeText("\n", a, a, "end"); ta.focus(); cont(); };
      $("[data-c]", d.foot).onclick = () => d.close(null);
      $("[data-n]", d.foot).onclick = () => { S.valor = ta.value; const m = validar(t, S.valor); if (m) { const e = $("#txE", d.body); e.hidden = false; e.textContent = m; ta.focus(); return; } paso2(); };
      d.focus("#txIn");
    }
    function paso2() {
      maps.forEach((m) => m.destroy()); maps.length = 0;
      d.setSteps(labels, 1); d.title("Revisa cómo queda");
      d.body.innerHTML = head() + `<div class="fap-ba" id="txBa"></div>
        <div class="fap-previews"><div><p class="fap-lbl">Así se verá en computador</p><div data-pv="pc"></div></div><div><p class="fap-lbl">Así se verá en celular</p><div data-pv="cel"></div></div></div>`;
      const ba = $("#txBa", d.body);
      const antes = document.createElement("figure"), despues = document.createElement("figure");
      antes.appendChild(muestra(t.texto)); despues.appendChild(muestra(S.valor));
      const ca = document.createElement("figcaption"); ca.className = "fap-help"; ca.textContent = "Antes";
      const cd = document.createElement("figcaption"); cd.className = "fap-help"; cd.textContent = "Después";
      antes.appendChild(ca); despues.appendChild(cd); ba.appendChild(antes); ba.appendChild(despues);
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn" data-n>Continuar</button>`;
      $$("[data-pv]", d.body).forEach((h) => {
        const m = FAP.vista.mount(h, { pagina: pg, mode: h.dataset.pv, only: id });
        maps.push(m);
        h.addEventListener("fap-ready", () => m.previewTexto(id, S.valor));
      });
      $("[data-b]", d.foot).onclick = () => paso1();
      $("[data-n]", d.foot).onclick = () => paso3();
      d.focus("[data-n]");
    }
    function paso3(msg) {
      maps.forEach((m) => m.destroy()); maps.length = 0;
      d.setSteps(labels, 2); d.title("Publicar");
      d.body.innerHTML = head() + `<div class="fap-card" id="txOk"></div><p>Se verá en el sitio en menos de 1 minuto.</p><p class="fap-help">Podrás volver al original cuando quieras.</p><p class="fap-err" id="txE3" role="alert" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>`;
      $("#txOk", d.body).appendChild(muestra(S.valor));
      d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-b>Volver</button><button type="button" class="fap-btn sec" data-c>Cancelar</button><button type="button" class="fap-btn" data-p>Publicar en el sitio</button>`;
      $("[data-b]", d.foot).onclick = () => paso2();
      $("[data-c]", d.foot).onclick = () => d.close(null);
      $("[data-p]", d.foot).onclick = publicar;
      d.focus("[data-p]");
    }
    async function publicar() {
      const m = validar(t, S.valor);
      if (m) { paso3(m); return; }
      const b = $("[data-p]", d.foot); b.disabled = true; b.textContent = "Publicando…";
      try {
        await FAP.api("texts-save", { body: { id, body: AP.limpiar(S.valor) } });
        d.setSteps(labels, 2); d.title("¡Listo!");
        d.body.innerHTML = `<div class="fap-strip info" role="status"><p><b>¡Listo! El texto ya está publicado.</b><br>Puede tardar hasta 1 minuto en verse en el sitio.</p></div>`;
        d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-k>Cerrar</button><a class="fap-btn" href="${esc(pg.href)}?v=${Date.now()}" target="_blank" rel="noopener">Ver en el sitio ${ico("ext")}</a>`;
        $("[data-k]", d.foot).onclick = () => d.close("ok");
        d.focus("[data-k]");
        FAP.aviso("El texto ya está publicado.", "ok");
        d.promise.then(() => alCerrar && alCerrar(id));
      } catch (e) {
        if (e.handled) return;
        paso3(err(e));
      }
    }
    paso1();
  }

  async function volver(id, alCerrar) {
    const t = TX.byId(id);
    const r = await FAP.confirmar({ titulo: "¿Volver al texto original?", cuerpo: `<p><b>${esc(t.seccion)}</b></p><p>Volverá el texto original del sitio. El cambio que publicaste se eliminará.</p>`, ok: "Volver al original", peligro: true });
    if (r !== "ok") return;
    try { await FAP.api("texts-reset", { body: { id } }); FAP.aviso("Volvió el texto original del sitio.", "ok"); await alCerrar(id); }
    catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
  }
  async function anterior(id, alCerrar) {
    const t = TX.byId(id);
    const r = await FAP.confirmar({ titulo: "¿Volver al texto anterior?", cuerpo: `<p><b>${esc(t.seccion)}</b></p><p>Volverá el texto que estaba publicado antes de este último cambio. El de ahora se eliminará.</p>`, ok: "Volver al anterior", peligro: true });
    if (r !== "ok") return;
    try { await FAP.api("texts-restore-previous", { body: { id } }); FAP.aviso("Volvió el texto anterior.", "ok"); await alCerrar(id); }
    catch (e) { if (!e.handled) FAP.aviso(err(e), "bad"); }
  }

  FAP.textos = { piezas, fila, editar, volver, anterior };
})();
