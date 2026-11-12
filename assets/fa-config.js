/* Configuración pública de Frío Austral.
   Para reactivar la Academia: cambia ACADEMIA_ENABLED a true y vuelve a publicar.
   El código de la Academia (páginas, login, temario, admin) se mantiene en el repo. */
window.FA_CONFIG = {
  /* false = la Academia no se usa ni se lanza. Rutas de campus/login redirigen.
     true  = se vuelve a mostrar Ingresar, Academia y el campus (el código sigue igual). */
  ACADEMIA_ENABLED: false,

  /* Checkout de Hotmart para todo "Comprar curso" mientras la Academia está desactivada. */
  HOTMART_CHECKOUT_URL: "https://pay.hotmart.com/M101158236T?hotfeature=51&_hi=eyJjaWQiOiIxNzg1MzgyMDM2NDM2Mzg2MzI4NTI3NDY1NzU1NjUwIiwiYmlkIjoiMTc4NTM4MjAzNjQzNjM4NjMyODUyNzQ2NTc1NTY1MCIsInNpZCI6Ijg3Mjg1YTEyOGI4MDRkNDRiNTQ0MmYzYjMwZjRkOGM1In0=.1794072662815",

  FLOW_CREATE_URL: "/api/flow/create",

  /* Etiquetas de la maqueta actual. Los montos que se cobran salen de FLOW_PLAN_AMOUNTS en el servidor.
     TODO: confirmar con Mathias/Guillermo precio, si es mensual recurrente o pago único, y qué recibe la persona después de pagar. */
  PLAN_LABELS: {
    basico: "Consulta",
    pro: "Ilimitado",
    premium: "Taller Pro"
  }
};