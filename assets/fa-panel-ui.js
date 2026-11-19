/* Panel del equipo · piezas comunes: iconos, fechas, avisos, cuadros de diálogo, errores en palabras simples,
   borradores, subida con progreso y conversión de fotos a WebP. */
(function () {
  const A = window.FAAuth;
  const FAP = (window.FAP = { A, views: {}, cache: {}, ver: {} });
  const esc = A.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const TZ = "America/Santiago";

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M16 7l3 3"/>',
    upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 3v6M16 6h6"/>',
    out: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    map: '<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  };
  const ico = (n) => `<svg class="fap-ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  /* ---- formatos ---- */
  const fsize = (n) => (n == null ? "" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const parts = (iso, o) => Object.fromEntries(new Intl.DateTimeFormat("es-CL", Object.assign({ timeZone: TZ, hourCycle: "h23" }, o)).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const fechaLarga = (iso) => { const p = parts(iso, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); return `${p.weekday} ${p.day} de ${p.month}, ${p.hour}:${p.minute}`; };
  const fechaDia = (iso) => (iso ? A.fdate(iso) : "—");
  const fechaCorta = (iso) => { if (!iso) return "—"; const p = parts(iso, { day: "numeric", month: "short" }); return `${p.day} ${String(p.month).replace(".", "")}`; };
  const fechaHora = (iso) => (iso ? A.fdate(iso, true) : "—");
  const hace = (iso) => { if (!iso) return ""; const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? `hace ${m || 1} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  /* Hora de pared de Chile -> instante ISO (el equipo escribe la hora de Chile sin importar la zona del computador). */
  function santiagoIso(dia, hora) {
    const [y, m, d] = dia.split("-").map(Number), [h, mi] = hora.split(":").map(Number), want = Date.UTC(y, m - 1, d, h, mi);
    let g = want;
    for (let i = 0; i < 2; i++) { const p = parts(g, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); g += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
    return new Date(g).toISOString();
  }
  const hoyMas = (dias) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + dias * 86400000));

  /* ---- borradores (sessionStorage) ---- */
  const KP = "fap:draft:";
  const draft = {
    get: (k) => { try { return sessionStorage.getItem(KP + k) || ""; } catch (e) { return ""; } },
    set: (k, v) => { try { v ? sessionStorage.setItem(KP + k, v) : sessionStorage.removeItem(KP + k); } catch (e) { /* sin almacenamiento */ } },
    any: () => { try { return Object.keys(sessionStorage).some((k) => k.startsWith(KP) && sessionStorage.getItem(k)); } catch (e) { return false; } },
    clear: (k) => { try { if (k) sessionStorage.removeItem(KP + k); else Object.keys(sessionStorage).filter((x) => x.startsWith(KP)).forEach((x) => sessionStorage.removeItem(x)); } catch (e) { /* nada */ } },
  };
  /* Guarda lo que se escribe en los campos de texto de un formulario y lo devuelve al abrirlo de nuevo. */
  function bindDraft(form, key) {
    let saved = {}; try { saved = JSON.parse(draft.get(key) || "{}"); } catch (e) { saved = {}; }
    $$("input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea", form).forEach((f) => { if (f.name && saved[f.name] != null && !f.value) f.value = saved[f.name]; });
    form.addEventListener("input", () => {
      const o = {}; $$("input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea", form).forEach((f) => { if (f.name && f.value) o[f.name] = f.value; });
      draft.set(key, Object.keys(o).length ? JSON.stringify(o) : "");
    });
  }

  /* ---- errores en palabras simples (qué pasó + qué hacer); el detalle técnico va solo a la consola ---- */
  const TECH = /base de datos|supabase|token|webhook|json|storage|postgres|hottok|sql/i;
  function friendly(e, ctx) {
    ctx = ctx || {};
    console.debug("[panel]", e && e.status, e && e.code, e && e.message);
    const code = e && e.code, st = e && e.status, msg = String((e && e.message) || "");
    if (e && e.friendly) return e.friendly;
    if (code === "offline" || (e instanceof TypeError)) return "Parece que no hay conexión. Revisa tu internet; no se perdió lo que escribiste.";
    if (st === 401 || code === "no_session" || code === "bad_session") return "Tu sesión se cerró por seguridad. Ingresa de nuevo; lo que escribiste quedó guardado.";
    if (code === "not_admin") return "Esta cuenta no tiene permiso para entrar al panel. Pídele al administrador del sitio que la habilite.";
    if (code === "too_big") return `El archivo pesa más de ${ctx.max || 50} MB. Reduce su peso o elige otro.`;
    if (code === "bad_type") return `Ese tipo de archivo no sirve aquí. Sube ${ctx.what || "un archivo permitido"}.`;
    if (code === "bad_size") return "No pudimos leer el archivo. Vuelve a elegirlo.";
    if (code === "not_uploaded") return "El archivo no terminó de subirse. Inténtalo de nuevo.";
    if (code === "storage_error" || code === "upload_fail") return "No pudimos subir el archivo. Revisa tu internet e inténtalo de nuevo.";
    if (code === "needs_cover") return ctx.youtube ? "Agrega la foto de referencia: es la imagen que muestra de qué trata el recurso." : "Agrega la foto de referencia: es la imagen que muestra de qué trata el recurso, o pega un enlace de YouTube.";
    if (code === "bad_video_url") return "Pega el enlace de un video completo de YouTube (empieza con https://).";
    if (code === "title") return "Ponle un título.";
    if (code === "bad_plans" || code === "bad_plan") return "Elige al menos un plan.";
    if (code === "bad_email") return "Revisa el correo: parece incompleto.";
    if (code === "bad_until") return /pas[óo]/i.test(msg) ? "Esa fecha ya pasó." : /13 meses/.test(msg) ? "La vigencia máxima es de 13 meses." : "Elige hasta qué día tiene acceso.";
    if (code === "too_soon") return "Elige una hora con al menos 30 minutos de anticipación.";
    if (code === "too_far") return "Elige una hora dentro de los próximos 90 días.";
    if (code === "bad_when") return "Elige una fecha y hora válidas.";
    if (code === "bad_state") return "Esta solicitud ya cambió. Actualiza la lista para ver cómo quedó.";
    if (code === "not_found" || st === 404) return "Ya no encontramos eso (puede haberlo borrado otra persona del equipo). Actualiza la lista.";
    if (code === "supabase_not_configured" || st === 503) return "El panel no está disponible por ahora. Avisa al administrador del sitio.";
    if (code === "db_error" || st >= 500 || TECH.test(msg)) return "Algo falló de nuestro lado. No se perdió nada de lo que ya estaba publicado. Inténtalo en un minuto y, si sigue, avisa al administrador.";
    return msg || "No pudimos completar la acción. Inténtalo de nuevo.";
  }

  /* ---- llamadas al servidor ---- */
  async function api(action, o) {
    o = o || {};
    const q = o.query ? "&" + new URLSearchParams(o.query).toString() : "";
    try {
      return await A.api("/api/admin?action=" + action + q, o.body !== undefined ? { body: o.body } : undefined);
    } catch (e) {
      if (e && e.status === undefined) {
        if (e.code === "not_ready") { e.friendly = friendly({ code: "supabase_not_configured" }); throw e; }
        const n = new Error("offline"); n.code = "offline"; n.friendly = friendly(n); throw n;
      }
      if (e.status === 401 || (e.status === 403 && e.code === "not_admin")) { if (FAP.sessionLost) FAP.sessionLost(e); e.handled = true; }
      e.friendly = friendly(e, o.ctx);
      throw e;
    }
  }
  /* Lista en memoria: se pide una vez y se conserva al volver; force = pedirla de nuevo. */
  const URLS = { list: "list", videos: "videos", access: "access-list", materials: "materials", free: "free-list", media: "media", summary: "summary" };
  async function get(key, force) {
    if (!force && FAP.cache[key]) return FAP.cache[key];
    const v = FAP.ver[key] = (FAP.ver[key] || 0) + 1;
    const d = await api(URLS[key]);
    if (v === FAP.ver[key]) FAP.cache[key] = d;
    return d;
  }
  const drop = (...ks) => ks.forEach((k) => { delete FAP.cache[k]; });

  /* ---- avisos (región aria-live; los de error no se cierran solos, los demás duran más de 8 s) ---- */
  function aviso(text, kind) {
    const box = $("#fapAvisos"); if (!box) return;
    const el = document.createElement("div");
    el.className = "fap-aviso " + (kind || "");
    el.innerHTML = `<p${kind === "bad" ? ' role="alert"' : ""}>${esc(text)}</p><button type="button" class="fap-btn text" aria-label="Cerrar aviso">Cerrar</button>`;
    $("button", el).onclick = () => el.remove();
    box.appendChild(el);
    if (kind !== "bad") setTimeout(() => el.remove(), 12000);
    return el;
  }

  /* ---- cuadros de diálogo: atrapan el foco, se cierran con Esc y devuelven el foco ---- */
  let dn = 0;
  function dialog(o) {
    const prev = document.activeElement, id = "fapD" + ++dn;
    $$(".fap-back").forEach((b) => b.setAttribute("inert", ""));
    const back = document.createElement("div");
    back.className = "fap-back" + (o.side ? " side" : "");
    back.innerHTML = `<div class="fap-dlg ${o.cls || ""}" role="dialog" aria-modal="true" aria-labelledby="${id}t"><header><h2 id="${id}t"></h2><button type="button" class="fap-btn text" data-x>Cerrar</button></header><ol class="fap-steps" aria-label="Pasos" hidden></ol><div class="cont"></div><footer></footer></div>`;
    document.body.appendChild(back);
    document.body.style.overflow = "hidden";
    const d = { el: back, box: $(".fap-dlg", back), body: $(".cont", back), foot: $("footer", back), steps: $(".fap-steps", back), done: false, veto: null };
    d.title = (t) => { $("h2", back).textContent = t; };
    d.title(o.title || "");
    d.close = (v) => {
      if (d.done) return; d.done = true; back.remove();
      const rest = $$(".fap-back"); if (rest.length) rest[rest.length - 1].removeAttribute("inert"); else document.body.style.overflow = "";
      if (prev && prev.isConnected) prev.focus({ preventScroll: true });
      d.resolve(v);
    };
    d.promise = new Promise((r) => { d.resolve = r; });
    const tryClose = () => { if (d.veto && d.veto() === false) return; d.close(null); };
    $("[data-x]", back).onclick = tryClose;
    back.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); tryClose(); return; }
      if (e.key !== "Tab") return;
      const f = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),select:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])', d.box).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !d.box.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !d.box.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    });
    d.focus = (sel) => { const t = (sel && $(sel, d.box)) || $("h2", back); if (t === $("h2", back)) t.tabIndex = -1; t.focus({ preventScroll: true }); };
    d.setSteps = (labels, n) => {
      d.steps.hidden = false;
      d.steps.innerHTML = labels.map((l, i) => `<li ${i === n ? 'aria-current="step"' : ""}><b>${i + 1}</b>${esc(l)}</li>`).join("");
    };
    return d;
  }
  /* Confirmación propia (nunca confirm() del navegador). Foco inicial en «Cancelar». Devuelve "ok", "extra" o null. */
  function confirmar(o) {
    const d = dialog({ title: o.titulo });
    d.body.innerHTML = o.cuerpo || "";
    const ok = o.peligro ? "fap-btn danger solid" : "fap-btn";
    d.foot.innerHTML = `<button type="button" class="fap-btn sec" data-c>${esc(o.cancelar || "Cancelar")}</button>${o.extra ? `<button type="button" class="fap-btn sec" data-e>${esc(o.extra)}</button>` : ""}<button type="button" class="${ok}" data-o>${esc(o.ok || "Confirmar")}</button>`;
    $("[data-c]", d.foot).onclick = () => d.close(null);
    $("[data-o]", d.foot).onclick = () => d.close("ok");
    if (o.extra) $("[data-e]", d.foot).onclick = () => d.close("extra");
    d.focus("[data-c]");
    return d.promise;
  }

  /* ---- zonas para elegir archivos (botón propio, sin texto en inglés del navegador) ---- */
  function zone(root, o) {
    const inp = $("input[type=file]", root), drop = $(".fap-drop", root);
    const take = (f) => { if (f) o.onFile(f); };
    $("[data-pick]", root).onclick = () => inp.click();
    inp.onchange = () => { take(inp.files[0]); inp.value = ""; };
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => take(e.dataTransfer && e.dataTransfer.files[0]));
  }
  const zoneHtml = (o) => `<div class="fap-file"><div class="fap-drop"><b>${esc(o.titulo)}</b><button type="button" class="fap-btn sec" data-pick>${esc(o.boton)}</button><p class="fap-help">${esc(o.ayuda || "")}</p></div><input type="file" class="fap-sr" tabindex="-1" aria-hidden="true" accept="${esc(o.accept)}"></div>`;

  /* ---- subida directa con progreso: misma petición que hace uploadToSignedUrl de supabase-js 2.49.4
     (PUT multipart con cacheControl y el archivo, x-upsert, apikey y Authorization); si no se puede, usa la librería sin progreso ---- */
  async function subir(up, file, o) {
    o = o || {};
    const c = await A.client(), s = await A.session().catch(() => null);
    const bucket = c.storage && c.storage.from(up.bucket);
    if (!bucket || !bucket.url || typeof XMLHttpRequest === "undefined") {
      const { error } = await c.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, file, { contentType: up.contentType });
      if (error) { const e = new Error("subida"); e.code = "upload_fail"; throw e; }
      return;
    }
    await new Promise((ok, ko) => {
      const x = new XMLHttpRequest(), fd = new FormData();
      fd.append("cacheControl", "3600"); fd.append("", file);
      x.open("PUT", `${bucket.url}/object/upload/sign/${up.bucket}/${up.path}?token=${encodeURIComponent(up.token)}`);
      const h = Object.assign({}, bucket.headers || {}, { "x-upsert": "false" });
      if (!h.apikey && c.supabaseKey) h.apikey = c.supabaseKey;
      if (s) h.Authorization = "Bearer " + s.access_token;
      Object.keys(h).forEach((k) => x.setRequestHeader(k, h[k]));
      x.upload.onprogress = (e) => { if (e.lengthComputable && o.onProgress) o.onProgress(e.loaded / e.total); };
      x.onload = () => { if (x.status >= 200 && x.status < 300) ok(); else { const e = new Error("subida"); e.code = "upload_fail"; ko(e); } };
      x.onerror = () => { const e = new Error("subida"); e.code = "upload_fail"; ko(e); };
      x.onabort = () => { const e = new Error("cancelado"); e.code = "aborted"; ko(e); };
      if (o.signal) o.signal.addEventListener("abort", () => x.abort());
      x.send(fd);
    });
  }

  /* ---- fotos: a WebP en el navegador (lado mayor ≤ 2400 px, sin ampliar) ---- */
  async function aWebp(file, o) {
    o = o || {};
    const max = o.max || 2400;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { return { file, converted: false, w: 0, h: 0, from: file.size, to: file.size }; }
    const w = bmp.width, h = bmp.height;
    const liviano = (file.type === "image/webp" || file.type === "image/avif") && file.size <= 1.5 * 1048576 && Math.max(w, h) <= max;
    if (liviano) { bmp.close && bmp.close(); return { file, converted: false, w, h, from: file.size, to: file.size }; }
    const k = Math.min(1, max / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    cv.getContext("2d").drawImage(bmp, 0, 0, cw, ch); bmp.close && bmp.close();
    const blob = await new Promise((r) => cv.toBlob(r, "image/webp", o.q || 0.85));
    if (!blob || blob.type !== "image/webp") return { file, converted: false, w, h, from: file.size, to: file.size };
    const nombre = String(file.name || "foto").replace(/\.[a-z0-9]{1,8}$/i, "") + ".webp";
    return { file: new File([blob], nombre, { type: "image/webp" }), converted: true, w, h, from: file.size, to: blob.size };
  }

  Object.assign(FAP, { $, $$, esc, ico, fsize, fechaLarga, fechaDia, fechaCorta, fechaHora, hace, santiagoIso, hoyMas, draft, bindDraft, friendly, api, get, drop, aviso, dialog, confirmar, zone, zoneHtml, subir, aWebp, TZ });
})();
