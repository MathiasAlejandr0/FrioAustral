/* Configuración pública de Frío Austral (la usan el navegador y las funciones de /api).

   TODO SE VENDE EN HOTMART. El sitio no cobra nada:
   - CURSOS (COURSES): cada curso tiene su hotmartCheckoutUrl. El botón «Comprar en Hotmart» abre ese link
     en una pestaña nueva. El curso se ve en la plataforma de Hotmart (quien compra crea allí su usuario);
     el sitio no da acceso a cursos. Si hotmartCheckoutUrl está vacío, el botón queda desactivado
     como «Próximamente» (sin links rotos).
   - SUSCRIPCIONES (PLANS): cada plan tiene su hotmartCheckoutUrl. Hotmart avisa del pago al webhook
     /api/hotmart/webhook, que activa el plan para el correo del comprador. Quien paga vuelve a
     mi-cuenta.html (crea su cuenta con ese mismo correo) y ve su plan y su material.

   PRECIOS Y TEXTOS DE LA SUSCRIPCIÓN: se cambian SOLO aquí (PLANS).
   Las claves internas (basico, pro, premium) no se renombran: las usa la base de datos y el webhook.

   La Academia del sitio (academia.html, mi-academia.html, leccion.html, certificado.html, ingresar.html)
   queda apagada (ACADEMIA_ENABLED = false) y redirige a cursos.html. */
(function (root) {
  function withFeatures(p) {
    const videollamada = !!p.videollamada;
    const ver_preguntas_otros = !!p.ver_preguntas_otros;
    const ebooks_gratis = !!p.ebooks_gratis;
    const biblioteca = !!p.biblioteca;
    return Object.assign({}, p, {
      videollamada,
      ver_preguntas_otros,
      ebooks_gratis,
      biblioteca,
      /* Alias que ya usa la API y Mi cuenta. */
      calls: !!(p.calls || videollamada),
      community: !!(p.community || ver_preguntas_otros),
      hotmartCheckoutUrl: p.hotmartCheckoutUrl || "",
    });
  }

  const FA_CONFIG = {
    /* false = la Academia no se usa ni se lanza. Rutas de campus/login redirigen.
       true  = se vuelve a mostrar Ingresar, Academia y el campus (el código sigue igual). */
    ACADEMIA_ENABLED: false,

    /* Curso que se muestra en los botones «Comprar curso» del menú y de las páginas. */
    DEFAULT_COURSE: "aire-acondicionado-automotriz",

    /* Cursos a la venta. hotmartCheckoutUrl vacío = botón «Próximamente» desactivado. */
    COURSES: {
      "aire-acondicionado-automotriz": {
        name: "Formación en Aire Acondicionado Automotriz: Nivel Básico a Avanzado",
        hotmartCheckoutUrl: "https://pay.hotmart.com/M101158236T",
      },
      "parte-2-profesional": {
        name: "Curso profesional de aire acondicionado: diagnóstico eléctrico y cambio de tableros",
        hotmartCheckoutUrl: "",
      },
    },

    /* Suscripción mensual para preguntarle al equipo, pagada en Hotmart.
       questionsPerPeriod: null = ilimitadas.
       hotmartCheckoutUrl: link de pago de Hotmart de cada plan. */
    PLANS: {
      basico: withFeatures({
        name: "Plan Aprendiz",
        label: "Inicial",
        amount: 5000,
        questionsPerPeriod: 3,
        tagline: "Ideal para quienes están comenzando en el mundo del aire acondicionado automotriz.",
        benefits: [
          "3 preguntas mensuales.",
          "Acceso a la plataforma digital.",
          "Resolución de dudas técnicas.",
        ],
        hotmartCheckoutUrl: "https://pay.hotmart.com/D108538114T",
      }),
      pro: withFeatures({
        name: "Plan Técnico",
        label: "Intermedio",
        amount: 10000,
        questionsPerPeriod: null,
        tagline: "Ideal para quienes quieren aprender constantemente y resolver todas sus dudas.",
        benefits: [
          "Preguntas ilimitadas.",
          "Acceso a la plataforma digital.",
          "Resolución de consultas técnicas.",
        ],
        hotmartCheckoutUrl: "https://pay.hotmart.com/F108559411V",
      }),
      premium: withFeatures({
        name: "Plan Premium",
        label: "Premium",
        amount: 20000,
        questionsPerPeriod: null,
        tagline: "Para quienes buscan capacitación continua y acompañamiento personalizado.",
        benefits: [
          "Preguntas ilimitadas.",
          "Videollamadas de asesoría.",
          "Acceso a todas las preguntas realizadas por otros usuarios.",
          "Acceso gratuito a todos los ebooks disponibles.",
          "Biblioteca de conocimientos para estudiar y profundizar.",
        ],
        videollamada: true,
        ver_preguntas_otros: true,
        ebooks_gratis: true,
        biblioteca: true,
        hotmartCheckoutUrl: "https://pay.hotmart.com/W108559868U",
      }),
    },

    /* Panel del suscriptor (login/registro) y panel del equipo.
       Página de agradecimiento de Hotmart: https://frioaustralspa.cl/mi-cuenta.html?compra=ok */
    ACCOUNT_URL: "mi-cuenta.html",
    TEAM_URL: "equipo.html",

  };

  /* Compatibilidad con código anterior. */
  FA_CONFIG.PLAN_LABELS = Object.fromEntries(Object.entries(FA_CONFIG.PLANS).map(([k, p]) => [k, p.name]));

  if (typeof module !== "undefined" && module.exports) module.exports = FA_CONFIG;
  else root.FA_CONFIG = FA_CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
