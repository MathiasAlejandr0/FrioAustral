/* Pago de la suscripción para preguntar / hablar con el equipo, a través de Flow.
   Reemplaza el pago simulado de la maqueta. Si el servidor no está configurado,
   muestra un mensaje claro y no inventa un cobro. */
(function () {
  const boot = () => {
    if (!document.body || document.body.getAttribute("data-fa") !== "planes") return;
    const C = window.FA_CONFIG || {};
    const form = document.getElementById("faSubForm");
    const modal = document.getElementById("faModal");
    if (!form || !modal) return;

    const ej = form.querySelector(".fa-ej");
    if (ej) ej.textContent = "El pago se hace a través de Flow, la pasarela chilena. Te vamos a redirigir para completarlo.";

    let plan = null;
    document.querySelectorAll(".fa-sub").forEach((b) => {
      b.onclick = () => {
        plan = b.getAttribute("data-plan");
        const labels = C.PLAN_LABELS || {};
        const nameEl = document.getElementById("faPlanName");
        if (nameEl) nameEl.textContent = labels[plan] || plan || "";
        modal.hidden = false;
      };
    });
    const close = modal.querySelector("[data-close]");
    if (close) close.onclick = () => { modal.hidden = true; };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button.btn-red, button[type='submit']");
      const data = new FormData(form);
      const payload = {
        plan,
        nombre: String(data.get("nombre") || "").trim(),
        email: String(data.get("email") || "").trim()
      };
      if (!payload.plan || !payload.nombre || !payload.email) return;
      if (btn) { btn.disabled = true; btn.dataset.prev = btn.textContent; btn.textContent = "Conectando con Flow…"; }
      const errBox = form.querySelector(".fa-flow-err") || (function () {
        const p = document.createElement("p");
        p.className = "fa-flow-err";
        p.style.color = "#ff7b75";
        p.style.margin = "8px 0 0";
        form.appendChild(p);
        return p;
      })();
      errBox.textContent = "";
      try {
        const res = await fetch(C.FLOW_CREATE_URL || "/api/flow/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.redirectUrl) {
          errBox.textContent = out.message || "El pago con Flow todavía no está listo. Falta completar la configuración (cuenta, precios o lo que ocurre después de pagar).";
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.prev || "Confirmar suscripción"; }
          return;
        }
        location.href = out.redirectUrl;
      } catch (err) {
        errBox.textContent = "No pudimos conectar con Flow. Inténtalo de nuevo en un momento.";
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.prev || "Confirmar suscripción"; }
      }
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();