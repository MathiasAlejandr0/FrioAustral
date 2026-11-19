/* Google Analytics 4 de frioaustralspa.cl.
   Para activarlo, pega el ID de medición de GA4 (empieza con "G-") en MEASUREMENT_ID.
   Mientras esté vacío este archivo no carga nada ni envía ningún dato. */
(function () {
  "use strict";

  var MEASUREMENT_ID = ""; // <- ID de medición de GA4, por ejemplo "G-XXXXXXXXXX"

  if (!/^G-[A-Z0-9]{4,}$/.test(MEASUREMENT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { anonymize_ip: true });

  /* Eventos útiles: clic en WhatsApp, en comprar curso y en suscribirse. */
  function eventFor(link) {
    var href = link.getAttribute("href") || "";
    var text = (link.textContent || "").replace(/\s+/g, " ").trim();
    if (/^https?:\/\/wa\.me\//i.test(href)) return ["whatsapp_click", { link_text: text }];
    if (link.hasAttribute("data-course") || /comprar curso/i.test(text)) {
      return ["comprar_curso_click", { course: link.getAttribute("data-course") || "curso", link_text: text }];
    }
    if (/^suscribirme/i.test(text)) return ["suscripcion_click", { link_text: text }];
    return null;
  }

  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!link) return;
    var ev = eventFor(link);
    if (ev) gtag("event", ev[0], Object.assign({ page_path: location.pathname }, ev[1]));
  });
})();
