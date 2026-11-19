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
  /* Botones de compra de cursos: cada curso (C.COURSES) tiene su hotmartCheckoutUrl.
     Con link: abre Hotmart en pestaña nueva. Sin link: botón desactivado «Próximamente». */
  const COURSES = C.COURSES || {};
  const isBuyCta = (a) => {
    if (a.hasAttribute("data-course")) return true;
    const link = (a.getAttribute("data-link") || "").toLowerCase();
    if (link === "comprar-curso" || link === "curso-basico-avanzado") return true;
    const text = (a.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    return text.includes("comprar curso");
  };

  if (!enabled && ACADEMY_PAGES[file]) {
    location.replace(ACADEMY_PAGES[file]);
    return;
  }

  function applyBuy(a) {
    const slug = a.getAttribute("data-course") || C.DEFAULT_COURSE || "";
    const url = (COURSES[slug] && COURSES[slug].hotmartCheckoutUrl) || "";
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.removeAttribute("aria-disabled");
      a.classList.remove("is-soon");
      return;
    }
    a.removeAttribute("href");
    a.removeAttribute("target");
    a.setAttribute("aria-disabled", "true");
    a.setAttribute("role", "link");
    a.classList.add("is-soon");
    a.classList.remove("btn-red", "btn-glass");
    a.classList.add("btn-line");
    a.textContent = "Próximamente";
    a.addEventListener("click", (e) => e.preventDefault());
  }

  function hide(a) {
    a.hidden = true;
    a.setAttribute("hidden", "");
    a.setAttribute("aria-hidden", "true");
    a.style.display = "none";
  }

  /* Enlace "Mi cuenta" (panel del suscriptor) en el menú y el drawer de todas las páginas. */
  function addAccountLink() {
    const url = C.ACCOUNT_URL || "mi-cuenta.html";
    document.querySelectorAll(".nav-links, .drawer").forEach((nav) => {
      if (nav.querySelector('a[href="' + url + '"]')) return;
      const a = document.createElement("a");
      a.href = url;
      a.textContent = "Mi cuenta";
      a.className = "fa-nav-cuenta";
      if (file === url) { a.classList.add("on"); a.setAttribute("aria-current", "page"); }
      const before = nav.classList.contains("drawer") ? nav.querySelector(".btn") : null;
      nav.insertBefore(a, before);
    });
  }

  function apply() {
    addAccountLink();
    document.querySelectorAll("a[data-course], a[data-link='comprar-curso'], a[data-link='curso-basico-avanzado']").forEach(applyBuy);
    if (enabled) return;
    document.querySelectorAll("a[href]").forEach((a) => {
      if (isBuyCta(a)) return;
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
    document.querySelectorAll("a.nav-login").forEach(hide);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();