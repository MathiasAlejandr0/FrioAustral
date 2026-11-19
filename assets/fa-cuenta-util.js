/* Funciones puras de «Mi cuenta» (fechas, estado de la suscripción, mensajes de error en lenguaje simple).
   Sin DOM ni red: se usan en el navegador (window.FACuentaUtil) y en las pruebas de node. */
(function (root) {
  const TZ = "America/Santiago";
  const DAY = 86400000;

  const partsOf = (d) => {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t) => Number(p.find((x) => x.type === t).value);
    return { y: g("year"), m: g("month"), d: g("day") };
  };
  /* Días de calendario (en hora de Chile) entre «ahora» y una fecha. */
  function diasHasta(iso, now) {
    if (!iso) return null;
    const a = partsOf(now || new Date()), b = partsOf(new Date(iso));
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY);
  }
  /* «1 de diciembre» (con el año solo si no es el actual). */
  function fechaLarga(iso, now) {
    if (!iso) return "";
    const d = new Date(iso);
    const same = partsOf(d).y === partsOf(now || new Date()).y;
    return d.toLocaleDateString("es-CL", { timeZone: TZ, day: "numeric", month: "long", ...(same ? {} : { year: "numeric" }) });
  }
  /* Partes para mostrar «1» grande y «de diciembre» chico. */
  function fechaPartes(iso, now) {
    if (!iso) return null;
    const d = new Date(iso);
    const dia = d.toLocaleDateString("es-CL", { timeZone: TZ, day: "numeric" });
    const mes = d.toLocaleDateString("es-CL", { timeZone: TZ, month: "long" });
    const same = partsOf(d).y === partsOf(now || new Date()).y;
    return { dia, mes: "de " + mes, anio: same ? "" : String(partsOf(d).y) };
  }
  const hora = (iso) => new Date(iso).toLocaleTimeString("es-CL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const diaClave = (iso) => { const p = partsOf(new Date(iso)); return `${p.y}-${p.m}-${p.d}`; };
  function diaEtiqueta(iso, now) {
    const n = diasHasta(iso, now);
    if (n === 0) return "Hoy";
    if (n === -1) return "Ayer";
    const d = new Date(iso);
    const same = partsOf(d).y === partsOf(now || new Date()).y;
    return d.toLocaleDateString("es-CL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", ...(same ? {} : { year: "numeric" }) });
  }
  function faltan(n) {
    if (n == null) return "";
    if (n < 0) return "";
    if (n === 0) return "Es hoy";
    return n === 1 ? "Falta 1 día" : `Faltan ${n} días`;
  }
  function primerNombre(nombre, email) {
    const n = String(nombre || "").trim().split(/\s+/)[0];
    if (n) return n.charAt(0).toLocaleUpperCase("es-CL") + n.slice(1);
    return String(email || "").split("@")[0];
  }

  /* Estado de la suscripción para decidir qué se muestra.
     verificando: hay cuenta pero aún no hay plan · vencido: terminó o no está activa · cancelado_vigente: no se renovará, sigue hasta periodEnd · activo. */
  function estado(me, now) {
    const s = me.subscriber || {};
    const t = (now || new Date()).getTime();
    if (!s.hasSubscription) return "verificando";
    const pasado = s.periodEnd && new Date(s.periodEnd).getTime() + DAY < t;
    if (s.status === "cancelada" || pasado || !me.canAsk) return "vencido";
    if (s.status === "cancelada_fin_periodo") return "cancelado_vigente";
    return "activo";
  }
  const sinCupo = (me) => !!(me.quota && !me.quota.unlimited && me.quota.left <= 0);

  /* Respuestas del equipo no vistas: usa `unreadReplies` de la API; si el servidor no lo trae, usa la fecha del último mensaje visto (por dispositivo). */
  function respuestasNuevas(me, visto) {
    if (typeof me.unreadReplies === "number") return me.unreadReplies;
    return (me.messages || []).filter((m) => m.sender === "equipo" && (!visto || new Date(m.created_at) > new Date(visto))).length;
  }

  const EXT_VISIBLES = ["pdf", "png", "jpg", "jpeg", "webp", "mp4", "webm", "txt"];
  const extension = (n) => String(n || "").split(".").pop().toLowerCase();
  const seAbreEnNavegador = (m) => EXT_VISIBLES.includes(extension(m.fileName));
  const esNuevo = (iso, now) => !!iso && ((now || new Date()).getTime() - new Date(iso).getTime()) < 14 * DAY;
  const tamano = (n) => (n == null ? "" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

  const TIPOS = { ebook: "Ebook", biblioteca: "Biblioteca", guia: "Guía", video: "Video", recurso: "Otro" };
  const TIPOS_PLURAL = { ebook: "Ebooks", biblioteca: "Biblioteca", guia: "Guías", video: "Videos", recurso: "Otros" };
  const tipoDe = (m) => (TIPOS[m.category] ? m.category : "recurso");

  /* ---------- errores en lenguaje simple (sección 9 del encargo) ----------
     Devuelve { texto, accion } con accion = "renovar" | "planes" | "reingresar" | null. Nunca expone el texto técnico del servidor. */
  function mensajeError(err, ctx) {
    ctx = ctx || {};
    const code = err && err.code, status = err && err.status;
    const fecha = ctx.fechaRenovacion ? ` Se renuevan el ${ctx.fechaRenovacion}.` : "";
    const cuantas = ctx.limite ? `tus ${ctx.limite} preguntas` : "tus preguntas";
    if (code === "not_ready") return { texto: "El panel no está disponible por ahora. Inténtalo en un minuto.", accion: null };
    if (!status && !code) return { texto: "Parece que no hay conexión. Revisa tu internet; lo que escribiste queda guardado.", accion: null };
    if (status === 401 || code === "no_session" || code === "bad_session") return { texto: "Tu sesión se cerró por seguridad. Ingresa de nuevo.", accion: "reingresar" };
    if (code === "inactive") return { texto: "Tu suscripción no está activa. Renueva tu plan para seguir.", accion: "renovar" };
    if (code === "quota") return { texto: `Usaste ${cuantas} de este período.${fecha}`, accion: "planes" };
    if (code === "not_premium") return { texto: "Esto es parte del Plan Premium.", accion: "planes" };
    if (code === "empty") return { texto: "Escribe tu pregunta.", accion: null };
    if (code === "too_long") return { texto: "Tu pregunta es muy larga: máximo 4.000 caracteres.", accion: null };
    if (code === "too_many") return { texto: "Ya tienes 2 solicitudes pendientes. Espera la respuesta del equipo.", accion: null };
    if (code === "too_soon") return { texto: "Elige una hora con al menos 30 minutos de anticipación.", accion: null };
    if (code === "too_far") return { texto: "Elige una hora dentro de los próximos 90 días.", accion: null };
    if (code === "bad_when") return { texto: "Elige una fecha y hora válidas.", accion: null };
    if (code === "bad_state") return { texto: "Esta solicitud ya cambió. Actualiza para ver cómo quedó.", accion: null };
    if (code === "file_missing" || code === "not_found") return { texto: ctx.material ? "Este archivo no está disponible por ahora. Avísanos desde Preguntas." : "No encontramos eso. Actualiza e inténtalo de nuevo.", accion: null };
    if (code === "email_exists") return { texto: "Ya hay una cuenta con ese correo. Ingresa con tu contraseña.", accion: null };
    if (code === "weak_password" || code === "password") return { texto: "La contraseña debe tener al menos 8 caracteres.", accion: null };
    if (code === "login") return { texto: "El correo o la contraseña no coinciden. Revísalos o toca “Olvidé mi contraseña”.", accion: null };
    if (code === "email") return { texto: "Revisa que el correo esté bien escrito.", accion: null };
    if (code === "nombre") return { texto: "Escribe tu nombre.", accion: null };
    if (code === "same_plan") return { texto: "Ya tienes ese plan.", accion: null };
    if (code === "use_payment_link") return { texto: "Para subir de plan usa el enlace de pago del plan nuevo.", accion: null };
    if (status >= 500 || code === "db_error" || code === "supabase_not_configured") return { texto: "Algo falló de nuestro lado. Inténtalo en un minuto. Tus mensajes y tu plan no se perdieron.", accion: null };
    return { texto: "No pudimos completar la acción. Inténtalo de nuevo.", accion: null };
  }

  const API = { diasHasta, fechaLarga, fechaPartes, hora, diaClave, diaEtiqueta, faltan, primerNombre, estado, sinCupo, respuestasNuevas, seAbreEnNavegador, esNuevo, tamano, extension, TIPOS, TIPOS_PLURAL, tipoDe, mensajeError, TZ };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.FACuentaUtil = API;
})(typeof window !== "undefined" ? window : globalThis);
