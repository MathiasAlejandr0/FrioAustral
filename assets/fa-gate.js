/* Desactiva la Academia en la interfaz sin borrar su código.
   Depende de window.FA_CONFIG (assets/fa-config.js). */
(function () {
  const C = window.FA_CONFIG || {};
  const enabled = C.ACADEMIA_ENABLED === true;
  const file = (location.pathname.split("/").pop() || "index.html").split("?")[0].toLowerCase() || "index.html";
  const ACADEMY_PAGES = {
    "academia.html": "cursos.html",
    "ingresar.html": "index.html",
    "mi-academia.html": "cursos.html",
    "leccion.html": "cursos.html",
    "certificado.html": "cursos.html"
  };
  const academyFile = (href) => {
    const raw = String(href || "").trim();
    if (!raw || raw.startsWith("http") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return "";
    const path = raw.split("?")[0].split("#")[0].split("/").pop().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ACADEMY_PAGES, path) ? path : "";
  };
  const isBuyCta = (a) => {
    const link = (a.getAttribute("data-link") || "").toLowerCase();
    if (link === "comprar-curso" || link === "curso-basico-avanzado") return true;
    const text = (a.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    return text.includes("comprar curso");
  };
  const hotmart = C.HOTMART_CHECKOUT_URL || "";

  if (!enabled && ACADEMY_PAGES[file]) {
    location.replace(ACADEMY_PAGES[file]);
    return;
  }

  function applyBuy(a) {
    if (!hotmart) return;
    a.href = hotmart;
    a.target = "_blank";
    a.rel = "noopener";
  }

  function hide(a) {
    a.hidden = true;
    a.setAttribute("hidden", "");
    a.setAttribute("aria-hidden", "true");
    a.style.display = "none";
  }

  function apply() {
    if (enabled) return;
    document.querySelectorAll("a[href]").forEach((a) => {
      if (isBuyCta(a)) {
        applyBuy(a);
        return;
      }
      const page = academyFile(a.getAttribute("href"));
      if (!page) return;
      const text = (a.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        a.classList.contains("nav-login") ||
        text === "academia" ||
        text === "academia online" ||
        text === "ingresar" ||
        text === "mi academia" ||
        text.startsWith("mi academia")
      ) {
        hide(a);
        return;
      }
      /* "Ver temario" u otros links al campus: la ficha pública está en Cursos. */
      a.href = "cursos.html";
    });
    document.querySelectorAll('a[data-link="comprar-curso"], a[data-link="curso-basico-avanzado"]').forEach(applyBuy);
    document.querySelectorAll("a.nav-login").forEach(hide);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();