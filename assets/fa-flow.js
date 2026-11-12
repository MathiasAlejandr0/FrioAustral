/* Suscripción mensual con Flow (cobro automático con tarjeta registrada).
   - En todas las páginas: pinta los precios y cupos desde FA_CONFIG.PLANS.
   - En planes.html: crea la cuenta (o ingresa) y lleva a Flow para registrar la tarjeta. */
(function () {
  const C = window.FA_CONFIG || {};
  const PLANS = C.PLANS || {};
  const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

  function paintPrices() {
    document.querySelectorAll("[data-fa-price]").forEach((el) => {
      const p = PLANS[el.getAttribute("data-fa-price")];
      if (p) el.textContent = clp(p.amount);
    });
    document.querySelectorAll("[data-fa-quota]").forEach((el) => {
      const p = PLANS[el.getAttribute("data-fa-quota")];
      if (p) el.textContent = p.questionsPerPeriod == null ? "Ilimitadas" : String(p.questionsPerPeriod);
    });
  }

  function loadAuth() {
    if (window.FAAuth) return Promise.resolve(window.FAAuth);
    return new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "assets/fa-auth.js";
      s.onload = () => ok(window.FAAuth);
      s.onerror = () => ko(new Error("No se pudo cargar el inicio de sesión."));
      document.head.appendChild(s);
    });
  }

  function bootPlanes() {
    const form = document.getElementById("faSubForm");
    const modal = document.getElementById("faModal");
    if (!form || !modal) return;
    const acct = C.ACCOUNT_URL || "mi-cuenta.html";
    form.noValidate = true;
    form.innerHTML = `
      <h3>Suscripción <span id="faPlanName"></span></h3>
      <p class="fa-ej mono" id="faPlanPrice"></p>
      <p class="fa-sub-note">Se cobra automáticamente cada mes en tu tarjeta, a través de Flow, hasta que la canceles desde <b>Mi cuenta</b>.</p>
      <div id="faSubFields"></div>
      <p class="fa-flow-err" role="alert" hidden></p>
      <div class="fa-row"><button type="button" class="btn btn-line btn-sm" data-close>Cancelar</button><button class="btn btn-red btn-sm" type="submit" id="faSubGo">Continuar a Flow</button></div>`;
    const fields = form.querySelector("#faSubFields");
    const errBox = form.querySelector(".fa-flow-err");
    const go = form.querySelector("#faSubGo");
    let plan = null, mode = "signup", logged = false;

    const showErr = (t) => { errBox.textContent = t || ""; errBox.hidden = !t; };
    function drawFields() {
      if (logged) {
        fields.innerHTML = `<p class="fa-sub-note">Ya ingresaste con tu cuenta. Al continuar, Flow te pedirá registrar tu tarjeta.</p>`;
        return;
      }
      fields.innerHTML = mode === "signup"
        ? `<label>Nombre<input name="nombre" autocomplete="name" required></label>
           <label>Email<input name="email" type="email" autocomplete="email" required></label>
           <label>Crea una contraseña<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
           <p class="fa-sub-note">Con este email y contraseña entras a <b>Mi cuenta</b> para preguntar. <button type="button" class="fa-linkbtn" data-mode="login">¿Ya tienes cuenta? Ingresa</button></p>`
        : `<label>Email<input name="email" type="email" autocomplete="email" required></label>
           <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
           <p class="fa-sub-note"><button type="button" class="fa-linkbtn" data-mode="signup">Crear una cuenta nueva</button> · <a href="${acct}?olvide=1">Olvidé mi contraseña</a></p>`;
      fields.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { mode = b.getAttribute("data-mode"); showErr(""); drawFields(); }));
    }

    document.querySelectorAll(".fa-sub").forEach((b) => {
      b.onclick = async () => {
        plan = b.getAttribute("data-plan");
        const p = PLANS[plan] || {};
        form.querySelector("#faPlanName").textContent = p.name || plan;
        form.querySelector("#faPlanPrice").textContent = p.amount ? `${clp(p.amount)} al mes · ${p.questionsPerPeriod == null ? "preguntas ilimitadas" : p.questionsPerPeriod + " preguntas al mes"}` : "";
        showErr("");
        logged = false;
        try { const A = await loadAuth(); logged = !!(await A.session()); } catch (e) { /* sin config: se avisa al enviar */ }
        drawFields();
        modal.hidden = false;
        const first = fields.querySelector("input"); if (first) first.focus();
      };
    });
    modal.querySelector("[data-close]") && (form.querySelector("[data-close]").onclick = () => { modal.hidden = true; });
    form.addEventListener("click", (e) => { if (e.target.matches("[data-close]")) modal.hidden = true; });

    form.onsubmit = async (e) => {
      e.preventDefault();
      showErr("");
      if (!plan) return;
      const data = new FormData(form);
      const prev = go.textContent;
      go.disabled = true; go.textContent = "Conectando…";
      try {
        const A = await loadAuth();
        if (!logged) {
          const email = String(data.get("email") || "").trim();
          const password = String(data.get("password") || "");
          if (mode === "signup") {
            const nombre = String(data.get("nombre") || "").trim();
            if (!nombre || !email || password.length < 8) throw new Error("Completa nombre, email y una contraseña de al menos 8 caracteres.");
            await A.api("/api/account?action=signup", { body: { nombre, email, password } });
          }
          if (!email || !password) throw new Error("Escribe tu email y contraseña.");
          await A.signIn(email, password);
          logged = true;
        }
        go.textContent = "Abriendo Flow…";
        const out = await A.api("/api/account?action=start", { body: { plan } });
        location.href = out.redirect;
      } catch (err) {
        if (err.code === "already_subscribed") {
          showErr(err.message);
          fields.innerHTML = `<p><a class="btn btn-red btn-sm" href="${acct}">Ir a Mi cuenta</a></p>`;
        } else {
          showErr(err.message || "No pudimos conectar con Flow. Intenta de nuevo.");
          if (logged) drawFields();
        }
        go.disabled = false; go.textContent = prev;
      }
    };
  }

  function boot() {
    paintPrices();
    if (document.body && document.body.getAttribute("data-fa") === "planes") bootPlanes();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
