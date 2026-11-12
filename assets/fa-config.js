/* Configuración pública de Frío Austral (la usan el navegador y las funciones de /api).
   Para reactivar la Academia: cambia ACADEMIA_ENABLED a true y vuelve a publicar.
   El código de la Academia (páginas, login, temario, admin) se mantiene en el repo.

   PRECIOS DE LA SUSCRIPCIÓN: se cambian SOLO aquí (PLANS[*].amount, en CLP por mes).
   Flow no deja cambiar el monto de un plan con suscriptores, así que cada monto
   genera su propio plan en Flow (id "fa-<plan>-<monto>"). Al cambiar un precio,
   los nuevos suscriptores toman el nuevo plan y los antiguos siguen con el suyo. */
(function (root) {
  const FA_CONFIG = {
    /* false = la Academia no se usa ni se lanza. Rutas de campus/login redirigen.
       true  = se vuelve a mostrar Ingresar, Academia y el campus (el código sigue igual). */
    ACADEMIA_ENABLED: false,

    /* Checkout de Hotmart para todo "Comprar curso" mientras la Academia está desactivada. */
    HOTMART_CHECKOUT_URL: "https://pay.hotmart.com/M101158236T?hotfeature=51&_hi=eyJjaWQiOiIxNzg1MzgyMDM2NDM2Mzg2MzI4NTI3NDY1NzU1NjUwIiwiYmlkIjoiMTc4NTM4MjAzNjQzNjM4NjMyODUyNzQ2NTc1NTY1MCIsInNpZCI6Ijg3Mjg1YTEyOGI4MDRkNDRiNTQ0MmYzYjMwZjRkOGM1In0=.1794072662815",

    /* Suscripción mensual para preguntarle al equipo (Guillermo). Cobro automático cada mes
       con Flow (tarjeta registrada) hasta que el cliente cancele.
       questionsPerPeriod: null = ilimitadas. */
    PLANS: {
      basico:  { name: "Consulta",   amount: 5000,  questionsPerPeriod: 3,    calls: false, community: false },
      pro:     { name: "Ilimitado",  amount: 10000, questionsPerPeriod: null, calls: false, community: false },
      premium: { name: "Taller Pro", amount: 20000, questionsPerPeriod: null, calls: true,  community: true }
    },

    /* Panel del suscriptor y panel del equipo. */
    ACCOUNT_URL: "mi-cuenta.html",
    TEAM_URL: "equipo.html",

    /* Llamadas y videollamadas del plan Taller Pro: se agendan por WhatsApp del taller. */
    CALLS_WHATSAPP_URL: "https://wa.me/56987785601?text=Hola%2C%20soy%20suscriptor%20Taller%20Pro%20y%20quiero%20agendar%20una%20llamada"
  };

  /* Compatibilidad con código anterior. */
  FA_CONFIG.PLAN_LABELS = Object.fromEntries(Object.entries(FA_CONFIG.PLANS).map(([k, p]) => [k, p.name]));

  if (typeof module !== "undefined" && module.exports) module.exports = FA_CONFIG;
  else root.FA_CONFIG = FA_CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
