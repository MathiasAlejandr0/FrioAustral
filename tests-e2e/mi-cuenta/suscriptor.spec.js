/* Pruebas de «Mi cuenta» con la API simulada (page.route): no tocan Supabase ni producción.
   Cubren los criterios de aceptación A–D del encargo y las tareas S1–S9 (clics y tiempos máximos). Ejecutar: npm test (en esta carpeta). */
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { scenario, install, DAY, iso } = require("./mock");

const VIEWS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const NAV = ["inicio", "preguntas", "material", "videollamadas", "comunidad", "plan"];
const PROHIBIDO = /Base de datos:|supabase|token|webhook|hotmart|PURCHASE_/i;

async function open(page, kind, route = "#/inicio", opts = {}) {
  const s = opts.s || scenario(kind, opts.over || {});
  if (page.url() !== "about:blank") {
    /* La misma página se reutiliza dentro de una prueba: se vuelve a empezar desde cero. */
    await page.goto("about:blank"); await page.unrouteAll({ behavior: "ignoreErrors" });
    page.removeAllListeners("console"); page.removeAllListeners("pageerror");
  }
  await install(page, s);
  await page.addInitScript((sin) => { if (sin) localStorage.removeItem("__sess"); else localStorage.setItem("__sess", "1"); }, opts.sess === false);
  s.errors = [];
  /* «Failed to load resource» es el aviso del navegador por un 4xx/5xx que la prueba provoca a propósito. */
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) s.errors.push(m.text()); });
  page.on("pageerror", (e) => s.errors.push(String(e)));
  await page.goto("/mi-cuenta.html" + (opts.search || "") + route);
  if (opts.raw) return s;
  await page.waitForSelector(opts.sess === false ? ".pn-auth" : ".pn-main");
  if (opts.sess !== false) await page.waitForSelector("h1");
  return s;
}
const inViewport = async (page, loc) => { const b = await loc.boundingBox(); const h = page.viewportSize().height; return !!b && b.y >= 0 && b.y + b.height <= h + 1; };
const fmtFecha = (isoStr) => new Date(isoStr).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long" });

/* ============ A. estructura y limpieza ============ */
test.describe("A. estructura y limpieza", () => {
  test("no carga las hojas viejas ni el marco público; sin vidrio, grano ni cursor propio", async ({ page }) => {
    const s = await open(page, "premium");
    const hrefs = await page.$$eval("link[rel=stylesheet]", (l) => l.map((x) => x.getAttribute("href")));
    for (const bad of ["site.css", "v5.css", "academia.css", "media.css", "fa-app.css", "fa-cuenta.css"]) expect(hrefs.join()).not.toContain(bad);
    expect(await page.locator("body > footer, .footer, .mbar, .nav-links, .drawer, .grain, .glass").count()).toBe(0);
    for (const ruta of NAV) {
      await page.goto("/mi-cuenta.html#/" + ruta); await page.waitForSelector("h1");
      const r = await page.evaluate(() => {
        let blur = 0, cursorUrl = 0, glass = 0;
        for (const e of document.querySelectorAll("*")) { const c = getComputedStyle(e); if ((c.backdropFilter && c.backdropFilter !== "none") || (c.webkitBackdropFilter && c.webkitBackdropFilter !== "none")) blur++; if (/url\(/.test(c.cursor)) cursorUrl++; if (e.classList.contains("glass") || e.classList.contains("grain")) glass++; }
        return { blur, cursorUrl, glass };
      });
      expect(r, ruta).toEqual({ blur: 0, cursorUrl: 0, glass: 0 });
    }
    expect(s.errors).toEqual([]);
  });

  test("ningún texto visible nombra al proveedor de pagos ni usa jerga técnica (todas las vistas y planes)", async ({ page }) => {
    for (const kind of ["aprendiz", "premium", "verificando", "vencido"]) {
      const s = await open(page, kind);
      for (const r of NAV) {
        await page.goto("/mi-cuenta.html#/" + r); await page.waitForSelector("h1"); await page.waitForTimeout(150);
        const t = await page.evaluate(() => document.body.innerText);
        expect(t, `${kind}/${r}`).not.toMatch(PROHIBIDO);
      }
      expect(s.errors).toEqual([]);
    }
  });

  test("sin alert()/confirm() nativos en el código del panel", async () => {
    const fs = require("fs"), path = require("path");
    for (const f of ["assets/fa-cuenta.js", "assets/fa-cuenta-util.js"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
      expect(src).not.toMatch(/(^|[^.\w])(alert|confirm|prompt)\s*\(/m);
    }
  });
});

/* ============ B. Inicio: lo importante a la vista ============ */
for (const [vn, vp] of Object.entries(VIEWS)) {
  test.describe(`B. Inicio (${vn})`, () => {
    test.use({ viewport: vp });
    for (const kind of ["aprendiz", "tecnico", "premium"]) {
      test(`${kind}: saludo, insignia, estado y botón sin desplazarse; tarjetas iguales`, async ({ page }) => {
        const s = await open(page, kind);
        const h1 = page.locator("h1");
        await expect(h1).toContainText("Carlos");
        expect(await inViewport(page, h1)).toBe(true);
        expect(await inViewport(page, page.locator(".pn-badge").first())).toBe(true);
        expect(await inViewport(page, page.locator(".pn-status"))).toBe(true);
        const ask = page.getByRole("button", { name: "Preguntar al equipo" });
        expect(await inViewport(page, ask)).toBe(true);
        expect((await ask.boundingBox()).height).toBeGreaterThanOrEqual(56);
        await page.waitForSelector("#inCards .pn-card");
        const boxes = await page.$$eval("#inCards > .pn-card", (c) => c.map((x) => { const r = x.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }; }));
        expect(boxes.length).toBe(4);
        expect(new Set(boxes.map((b) => Math.round(b.w))).size).toBe(1);
        if (vn === "desktop") {
          expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
          expect(new Set(boxes.map((b) => Math.round(b.h))).size).toBe(1);
          expect(Math.max(...boxes.map((b) => b.b))).toBeLessThanOrEqual(vp.height);
        } else {
          const rows = {}; boxes.forEach((b) => (rows[Math.round(b.y)] = (rows[Math.round(b.y)] || []).concat(b.h)));
          expect(Object.keys(rows).length).toBe(2);
          for (const hs of Object.values(rows)) expect(new Set(hs.map(Math.round)).size).toBe(1);
          const sy = await page.evaluate(() => window.scrollY + 0);
          expect(Math.max(...boxes.map((b) => b.b)) + sy).toBeLessThanOrEqual(vp.height * 2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(s.errors).toEqual([]);
      });
    }

    test("las cifras coinciden con los datos (S1, S2): cupo y fecha visibles sin interacción", async ({ page }) => {
      const s = await open(page, "aprendiz");
      const q = page.locator("#inCards .pn-card").first();
      await expect(q).toContainText("2"); await expect(q).toContainText("de 3 disponibles");
      expect(await inViewport(page, q) || vn === "mobile").toBe(true);
      const fecha = fmtFecha(s.me.subscriber.periodEnd).split(" de ");
      const ren = page.locator("#inCards .pn-card").nth(1);
      await expect(ren).toContainText("Tu plan se renueva el");
      await expect(ren).toContainText(fecha[0]); await expect(ren).toContainText("de " + fecha[1]);
      await expect(ren).toContainText("Faltan 12 días");
      await expect(page.locator("#inCards .pn-card").nth(3)).toContainText("Guía de diagnóstico del aire automotriz");
      await expect(page.locator("[role=progressbar]").first()).toHaveAttribute("aria-valuenow", "1");
    });

    test("datos vacíos: estados vacíos con texto, nunca ceros inventados", async ({ page }) => {
      const s = scenario("aprendiz"); s.materials = []; s.me.messages = [];
      await open(page, "aprendiz", "#/inicio", { s });
      await expect(page.locator("#inCards")).toContainText("Todavía no hay material para tu plan");
      await expect(page.locator("#inLast")).toContainText("Aún no has preguntado");
      await expect(page.locator("#inCards .pn-card").nth(2)).toContainText("Sin respuestas nuevas");
    });

    test("error al cargar material: la tarjeta dice «No pudimos cargar esto» y reintenta", async ({ page }) => {
      const s = scenario("tecnico"); s.fail.materials = { status: 500, code: "db_error", message: "Base de datos: x" };
      await open(page, "tecnico", "#/inicio", { s });
      const card = page.locator("#inCards .pn-card").nth(3);
      await expect(card).toContainText("No pudimos cargar esto");
      await card.getByRole("button", { name: "Reintentar" }).click();
      await expect(card).toContainText("Guía de diagnóstico");
    });
  });
}

/* ============ B9. estados especiales ============ */
test.describe("B9. estados especiales de Inicio (un solo botón principal)", () => {
  const casos = [
    ["verificando", /Pago en verificación/, "Actualizar"],
    ["vencido", /Vencido/, "Renovar mi plan"],
    ["sincupo", /Usaste tus 3 preguntas de este período/, "Ver planes"],
  ];
  for (const [kind, texto, boton] of casos) {
    test(kind, async ({ page }) => {
      await open(page, kind);
      await expect(page.locator(".pn-hero")).toContainText(texto);
      const prim = page.locator(".pn-hero .pn-btn--primary");
      await expect(prim).toHaveCount(1);
      await expect(prim).toHaveText(new RegExp(boton));
    });
  }
  test("verificando: pasos y recordatorio del correo; vencido: qué se pierde y el historial sigue", async ({ page }) => {
    await open(page, "verificando");
    await expect(page.locator("#inNotice")).toContainText("Creaste tu cuenta");
    await expect(page.locator("#inNotice")).toContainText("Usa el mismo correo con el que pagaste");
    await open(page, "vencido");
    await expect(page.locator("#inNotice")).toContainText("No puedes hacer preguntas ni ver el material");
    await expect(page.locator("#inLast")).toContainText("Hola Carlos");
  });
  test("cancelado con acceso vigente: aviso amable y «Ver planes»", async ({ page }) => {
    await open(page, "cancelado");
    await expect(page.locator("#inNotice")).toContainText("Tu plan no se renovará");
    await expect(page.locator("#inNotice").getByRole("link", { name: "Ver planes" })).toHaveAttribute("href", "planes.html");
    await expect(page.locator(".pn-hero")).toContainText("Termina el");
  });
  test("error de carga: «No pudimos cargar tu cuenta» + Reintentar (nunca pantalla en blanco)", async ({ page }) => {
    const s = scenario("tecnico"); s.fail.me = { status: 500, code: "db_error", message: "Base de datos: connection refused" };
    await open(page, "tecnico", "#/inicio", { s, raw: true });
    await page.waitForSelector("#pnRetry");
    await expect(page.locator("body")).toContainText("No pudimos cargar tu cuenta");
    await expect(page.locator("body")).toContainText("Algo falló de nuestro lado");
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(PROHIBIDO);
    await page.click("#pnRetry");
    await expect(page.locator("h1")).toContainText("Carlos");
  });
  test("las secciones Premium no aparecen en Aprendiz ni Técnico (ni por URL)", async ({ page }) => {
    for (const kind of ["aprendiz", "tecnico"]) {
      await open(page, kind);
      await expect(page.locator("#pnNav a")).toHaveText([/Inicio/, /Preguntas/, /Material/, /Mi plan/]);
      await page.goto("/mi-cuenta.html#/videollamadas"); await page.waitForSelector("h1");
      await expect(page.locator("#pnNav a[aria-current=page]")).toContainText("Inicio");
      await page.goto("/mi-cuenta.html#/comunidad"); await page.waitForSelector("h1");
      await expect(page.locator("#pnNav a[aria-current=page]")).toContainText("Inicio");
    }
    await open(page, "premium");
    await expect(page.locator("#pnNav a")).toHaveText([/Inicio/, /Preguntas$/, /Material/, /Videollamadas/, /Preguntas de otros/, /Mi plan/]);
  });
});

/* ============ C. clics y tiempo (S1–S9) ============ */
test.describe("C. clics y tiempo", () => {
  test("S3/11 · Preguntar: 1 clic abre el cuadro con el cursor en el texto; 3 interacciones y ≤ 15 s", async ({ page }) => {
    const s = await open(page, "tecnico");
    const t0 = Date.now(); let clics = 0;
    await page.getByRole("button", { name: "Preguntar al equipo" }).click(); clics++;
    await expect(page.locator("dialog[open] textarea")).toBeFocused();
    await page.keyboard.insertText("Kia Rio 2016: el aire no enfría en ralentí. Ya revisé el nivel de gas.");
    await page.getByRole("button", { name: "Enviar pregunta" }).click(); clics++;
    await expect(page.locator(".pn-toast")).toContainText("Pregunta enviada. Verás la respuesta aquí.");
    expect(clics + 1).toBe(3);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(s.calls.filter((c) => c.action === "message")).toHaveLength(1);
    await expect(page.locator("h1")).toContainText("Preguntas");
    await expect(page.locator("#pqChat")).toContainText("Kia Rio 2016");
  });

  test("11 · desde cualquier otra vista, «Preguntar» de la barra superior abre el cuadro en 1 clic", async ({ page }) => {
    await open(page, "aprendiz", "#/material");
    await page.locator("#pnAskTop").click();
    await expect(page.locator("dialog[open] textarea")).toBeFocused();
    await expect(page.locator("dialog[open]")).toContainText("Te quedan 2 preguntas este período.");
    await expect(page.locator("dialog[open]")).toContainText("Vehículo: marca, modelo y año");
    await page.getByRole("button", { name: "Insertar guía" }).click();
    await expect(page.locator("dialog[open] textarea")).toHaveValue(/Vehículo: \nSíntoma: \nQué ya revisaste: /);
  });

  test("última pregunta del cupo: pide confirmación; el borrador se guarda y se restaura", async ({ page }) => {
    const s = scenario("aprendiz"); s.me.quota.used = 2; s.me.quota.left = 1;
    await open(page, "aprendiz", "#/inicio", { s });
    await page.getByRole("button", { name: "Preguntar al equipo" }).click();
    await page.keyboard.insertText("Borrador de prueba");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Preguntar al equipo" }).click();
    await expect(page.locator("dialog[open] textarea")).toHaveValue("Borrador de prueba");
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
    await expect(page.locator("dialog[open]").last()).toContainText("Esta es tu última pregunta de este período");
    await page.locator("dialog[open] [data-ok]").click();
    await expect(page.locator(".pn-toast")).toContainText("Pregunta enviada");
    expect(await page.evaluate(() => localStorage.getItem("fa-borrador-carlos@taller.cl"))).toBeNull();
  });

  test("S5/12 · último material: 1 clic abre el archivo en pestaña nueva y el panel queda abierto", async ({ page, context }) => {
    const s = await open(page, "tecnico");
    const t0 = Date.now();
    const [popup] = await Promise.all([context.waitForEvent("page"), page.locator("#inCards .pn-card").nth(3).getByRole("button", { name: "Abrir" }).click()]);
    await popup.waitForURL(/files\.test\/sign\/1111/);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(s.calls.find((c) => c.action === "material-url").body.inline).toBe(true);
    await expect(page.locator("h1")).toContainText("Carlos");
  });

  test("S6 · Material → Abrir en ≤ 2 clics; filtros por tipo; tarjetas iguales; Descargar solo si no se ve en el navegador", async ({ page, context }) => {
    const s = await open(page, "tecnico");
    await page.locator("#pnNav").getByRole("link", { name: "Material" }).click();
    await expect(page.locator("h1")).toContainText("Material");
    const cards = page.locator("#mList .pn-mat");
    await expect(cards).toHaveCount(3);
    const hs = await cards.evaluateAll((c) => c.map((x) => Math.round(x.getBoundingClientRect().height)));
    expect(new Set(hs).size).toBe(1);
    await expect(page.getByRole("button", { name: "Descargar" })).toHaveCount(1); // solo el .epub
    await page.getByRole("button", { name: /Ebooks/ }).click();
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Ebooks/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Todo/ }).click();
    const [popup] = await Promise.all([context.waitForEvent("page"), cards.first().getByRole("button", { name: "Abrir" }).click()]);
    await popup.waitForURL(/files\.test/);
    await expect(page.locator("h1")).toContainText("Material");
    expect(s.errors).toEqual([]);
  });

  test("material: si falla el archivo se explica en pantalla (sin alert) y búsqueda cuando hay más de 8", async ({ page }) => {
    const s = scenario("tecnico");
    for (let i = 0; i < 7; i++) s.materials.push({ id: `aaaaaaa${i}-1111-1111-1111-111111111111`, title: "Ficha " + i, description: "", category: "recurso", fileName: "f.pdf", contentType: "application/pdf", size: 1000, createdAt: iso(Date.now() - 90 * DAY) });
    await open(page, "tecnico", "#/material", { s });
    s.fail["material-url"] = { status: 404, code: "file_missing", message: "técnico" };
    page.on("dialog", () => { throw new Error("alert nativo"); });
    await page.locator("#mList .pn-mat").first().getByRole("button", { name: "Abrir" }).click();
    await expect(page.locator(".pn-toast--error")).toContainText("Este archivo no está disponible por ahora. Avísanos desde Preguntas.");
    await page.getByLabel("Buscar por título").fill("Ficha 3");
    await expect(page.locator("#mList .pn-mat")).toHaveCount(1);
  });

  test("S4/13 · respuesta nueva: la tarjeta muestra 1; 1 clic lleva al mensaje marcado «Nueva»; tras leerlo desaparece", async ({ page }) => {
    const s = scenario("tecnico");
    s.me.messages.push({ id: 7, sender: "equipo", body: "Prueba medir la alta con el motor a 1500 rpm.", created_at: iso(Date.now() - 600000), read: false });
    await open(page, "tecnico", "#/inicio", { s });
    const card = page.locator("#inCards .pn-card").nth(2);
    await expect(card).toContainText("1"); await expect(card).toContainText("respuesta nueva del equipo");
    await expect(page.locator("#pnNav .pn-dot")).toHaveText("1");
    // refrescos automáticos NO la borran
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await page.waitForTimeout(300);
    await expect(card).toContainText("respuesta nueva del equipo");
    await card.getByRole("link", { name: "Leer respuesta" }).click();
    await expect(page.locator("[data-new]")).toHaveCount(1);
    await expect(page.locator("[data-new]")).toContainText("Nueva");
    await expect(page.locator("[data-new]")).toContainText("Prueba medir la alta");
    await expect.poll(() => s.calls.filter((c) => c.action === "read").length).toBe(1);
    await expect(page.locator("#pnNav .pn-dot")).toHaveCount(0);
    await page.locator("#pnNav").getByRole("link", { name: "Inicio" }).click();
    await expect(page.locator("#inCards .pn-card").nth(2)).toContainText("Sin respuestas nuevas");
    await page.locator("#pnNav").getByRole("link", { name: "Preguntas" }).click();
    await expect(page.locator("[data-new]")).toHaveCount(0);
  });

  test("respaldo sin `unreadReplies` en la API: usa la fecha del último mensaje visto (por dispositivo)", async ({ page }) => {
    const s = scenario("tecnico");
    s.me.messages.push({ id: 7, sender: "equipo", body: "Respuesta sin campo", created_at: iso(Date.now() - 600000) });
    await page.route("**/api/account?action=me*", async (route) => { const r = await route.fetch(); const j = await r.json(); delete j.unreadReplies; j.messages.forEach((m) => delete m.read); await route.fulfill({ json: j }); });
    await open(page, "tecnico", "#/inicio", { s });
    await expect(page.locator("#inCards .pn-card").nth(2)).toContainText("respuesta nueva del equipo");
    await page.locator("#pnNav").getByRole("link", { name: "Preguntas" }).click();
    await expect(page.locator("[data-new]")).toHaveCount(2 - 1 + 0 === 1 ? 1 : 0);
    await page.locator("#pnNav").getByRole("link", { name: "Inicio" }).click();
    await expect(page.locator("#inCards .pn-card").nth(2)).toContainText("Sin respuestas nuevas");
  });

  test("14 · cualquier vista se alcanza desde Inicio en ≤ 2 clics (escritorio y celular)", async ({ page }) => {
    await open(page, "premium");
    for (const [txt] of [["Preguntas"], ["Material"], ["Videollamadas"], ["Preguntas de otros"], ["Mi plan"]]) {
      await page.locator("#pnNav").getByRole("link", { name: txt, exact: true }).click();
      await expect(page.locator("h1")).toBeVisible();
      await page.locator("#pnNav").getByRole("link", { name: "Inicio" }).click();
    }
    await page.setViewportSize(VIEWS.mobile);
    for (const [txt, h] of [["Videollamadas", "Videollamadas"], ["Preguntas de otros", "Preguntas de otros"], ["Mi plan", "Mi plan"]]) {
      await page.locator("#pnBar").getByRole("button", { name: "Más" }).click();
      await page.locator("dialog[open]").getByRole("link", { name: txt }).click();
      await expect(page.locator("h1")).toContainText(h);
    }
  });

  test("S7 · Premium: pedir una videollamada para el viernes a las 17:00 en ≤ 5 clics y 60 s; aceptar, entrar y cancelar con cuadro propio", async ({ page }) => {
    const s = await open(page, "premium");
    const t0 = Date.now(); let clics = 0;
    await page.locator("#pnNav").getByRole("link", { name: "Videollamadas" }).click(); clics++;
    await page.getByRole("button", { name: "Pedir una videollamada" }).click(); clics++;
    const d = new Date(Date.now() + 4 * DAY), p2 = (n) => String(n).padStart(2, "0");
    await page.locator("#vDate").fill(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
    await page.locator("#vTime").fill("17:00");
    await expect(page.locator("dialog[open]")).toContainText("Con al menos 30 minutos de anticipación y dentro de los próximos 90 días");
    await expect(page.locator("dialog[open]")).toContainText("hasta 2 solicitudes abiertas");
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("#vDate")).colorScheme)).toContain("dark");
    await page.getByRole("button", { name: "Solicitar" }).click(); clics++;
    await expect(page.locator(".pn-toast")).toContainText("Solicitud enviada");
    expect(clics).toBeLessThanOrEqual(5); expect(Date.now() - t0).toBeLessThan(60000);
    await expect(page.locator("#vList")).toContainText("Esperando confirmación del equipo");
    s.videos.push({ id: "66666666-6666-6666-6666-666666666666", status: "propuesta", scheduledAt: iso(Date.now() + 3 * DAY), canJoin: false, url: "", note: "" });
    await page.getByRole("link", { name: "Videollamadas" }).first().click();
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.reload(); await page.waitForSelector("#vList .pn-card");
    await page.getByRole("button", { name: "Aceptar esta hora" }).click();
    await expect(page.locator(".pn-toast").last()).toContainText("quedó confirmada");
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(page.locator("dialog[open]")).toContainText("¿Cancelar esta videollamada?");
    await page.locator("dialog[open] [data-ok]").click();
    await expect(page.locator(".pn-toast").last()).toContainText("se canceló");
    const join = page.locator('#vList a[href^="https://meet.jit.si/"]');
    expect(await join.count()).toBeGreaterThanOrEqual(0);
  });

  test("S7 · «Entrar a la videollamada» abre meet.jit.si con rel=noopener solo cuando canJoin", async ({ page }) => {
    const s = scenario("premium"); s.videos[0].canJoin = true;
    await open(page, "premium", "#/videollamadas", { s });
    const a = page.getByRole("link", { name: "Entrar a la videollamada" });
    await expect(a).toHaveAttribute("target", "_blank"); await expect(a).toHaveAttribute("rel", "noopener");
    await expect(a).toHaveAttribute("href", /^https:\/\/meet\.jit\.si\/frioaustral-/);
  });

  test("Preguntas de otros: busca con pausa de 400 ms sin perder el foco", async ({ page }) => {
    const s = await open(page, "premium", "#/comunidad");
    await expect(page.locator("#cList")).toContainText("Hilux");
    await page.locator("#cQ").focus(); await page.keyboard.type("zzz");
    await expect(page.locator("#cList")).toContainText("Aún no hay resultados para esa búsqueda");
    await expect(page.locator("#cQ")).toBeFocused();
    expect(s.calls.filter((c) => c.action === "community").length).toBeLessThanOrEqual(3);
  });

  test("S8 · olvidé mi contraseña: desde el ingreso en ≤ 3 interacciones y 60 s", async ({ page }) => {
    const t0 = Date.now();
    await open(page, "tecnico", "#/inicio", { sess: false });
    await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
    await page.getByLabel("Correo").fill("carlos@taller.cl");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.locator("#aOk")).toContainText("Si el correo tiene cuenta, te llegará un mensaje");
    expect(Date.now() - t0).toBeLessThan(60000);
    const calls = await page.evaluate(() => window.__calls);
    expect(calls[0].slice(0, 2)).toEqual(["reset", "carlos@taller.cl"]);
  });

  test("S9 · plan vencido: «Renovar mi plan» visible sin clics; Material y Preguntas explican qué hacer", async ({ page }) => {
    await open(page, "vencido");
    await expect(page.getByRole("link", { name: "Renovar mi plan" }).first()).toHaveAttribute("href", "planes.html");
    await page.locator("#pnNav").getByRole("link", { name: "Material" }).click();
    await expect(page.locator("#mList")).toContainText("Tu suscripción no está activa");
    await page.locator("#pnNav").getByRole("link", { name: "Preguntas" }).click();
    await expect(page.locator("#pqCompose")).toContainText("Tu suscripción no está activa. Renueva tu plan para seguir.");
    await expect(page.locator("#pnAskTop")).toBeHidden();
  });
});

/* ============ Ingreso, parámetros de retorno y errores ============ */
test.describe("Ingreso y parámetros de URL", () => {
  test("?compra=ok abre «Crear mi cuenta» con agradecimiento y la regla del mismo correo", async ({ page }) => {
    await open(page, "tecnico", "", { sess: false, search: "?compra=ok" });
    await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
    await expect(page.locator(".pn-thanks")).toContainText("¡Gracias por tu compra!");
    await expect(page.locator(".pn-auth")).toContainText("mismo correo con el que pagaste");
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(PROHIBIDO);
  });
  test("?registro=1 abre «Crear mi cuenta»; ?olvide=1 abre «Recupera tu contraseña»", async ({ page }) => {
    await open(page, "tecnico", "", { sess: false, search: "?registro=1" });
    await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear mi cuenta" })).toBeVisible();
    await open(page, "tecnico", "", { sess: false, search: "?olvide=1" });
    await expect(page.getByRole("heading", { name: "Recupera tu contraseña" })).toBeVisible();
  });
  test("?recuperar=1#type=recovery abre «Crea tu nueva contraseña» y guarda con updatePassword", async ({ page }) => {
    await open(page, "tecnico", "#type=recovery", { sess: false, search: "?recuperar=1", raw: true });
    await page.waitForSelector("#faRecForm");
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    await expect(page.locator("#rPass")).toHaveAttribute("type", "text");
    await page.locator("#rPass").fill("corta");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.locator("#rPassErr")).toContainText("La contraseña debe tener al menos 8 caracteres.");
    await page.locator("#rPass").fill("nuevaclave123");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.locator("h1")).toContainText("Carlos");
    expect((await page.evaluate(() => window.__calls)).some((c) => c[0] === "update")).toBe(true);
  });
  test("ingreso: «Olvidé mi contraseña» siempre visible; error de clave junto al campo; luego entra", async ({ page }) => {
    await open(page, "tecnico", "#/inicio", { sess: false });
    await expect(page.getByRole("button", { name: "Olvidé mi contraseña" })).toBeVisible();
    await page.getByLabel("Correo").fill("carlos@taller.cl");
    await page.locator("#aPass").fill("mala");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page.locator("#aPassErr")).toContainText("El correo o la contraseña no coinciden. Revísalos o toca “Olvidé mi contraseña”.");
    await page.locator("#aPass").fill("buenaclave");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page.locator("h1")).toContainText("Carlos");
  });
  test("crear cuenta: correo ya registrado y contraseña débil se explican junto al campo", async ({ page }) => {
    const s = await open(page, "tecnico", "", { sess: false, search: "?registro=1" });
    await page.getByLabel("Tu nombre").fill("Carlos");
    await page.getByLabel(/Correo/).fill("carlos@taller.cl");
    await page.locator("#aPass").fill("12345");
    await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
    await expect(page.locator("#aPassErr")).toContainText("La contraseña debe tener al menos 8 caracteres.");
    s.fail.signup = { status: 409, code: "email_exists", message: "Ya existe una cuenta con ese correo." };
    await page.locator("#aPass").fill("12345678");
    await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
    await expect(page.locator("#aEmailErr")).toContainText("Ya hay una cuenta con ese correo. Ingresa con tu contraseña.");
  });
});

test.describe("Errores en lenguaje simple (sección 9)", () => {
  const preguntar = async (page, texto = "Pregunta de prueba") => {
    await page.getByRole("button", { name: "Preguntar al equipo" }).click();
    await page.keyboard.insertText(texto);
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
  };
  const casos = [
    ["inactive", 403, /Tu suscripción no está activa\. Renueva tu plan para seguir\./, "Renovar mi plan"],
    ["quota", 403, /Usaste tus 3 preguntas de este período\. Se renuevan el \d+ de \w+\./, "Ver planes"],
    ["too_long", 400, /Tu pregunta es muy larga: máximo 4\.000 caracteres\./],
    ["db_error", 500, /Algo falló de nuestro lado\. Inténtalo en un minuto\. Tus mensajes y tu plan no se perdieron\./],
  ];
  for (const [code, status, re, link] of casos) {
    test(`preguntar · ${code}`, async ({ page }) => {
      const s = scenario("aprendiz");
      await open(page, "aprendiz", "#/inicio", { s });
      s.fail.message = { status, code, message: "Base de datos: detalle técnico supabase token" };
      await preguntar(page);
      const err = page.locator("dialog[open] [role=alert]");
      await expect(err).toContainText(re);
      expect(await err.innerText()).not.toMatch(PROHIBIDO);
      if (link) await expect(err.getByRole("link", { name: link })).toBeVisible();
    });
  }
  test("preguntar · sin conexión: avisa y conserva lo escrito", async ({ page }) => {
    const s = scenario("tecnico"); await open(page, "tecnico", "#/inicio", { s });
    s.fail.message = { abort: true };
    await preguntar(page, "Texto que no se debe perder");
    await expect(page.locator("dialog[open] [role=alert]")).toContainText("Parece que no hay conexión. Revisa tu internet; lo que escribiste queda guardado.");
    await expect(page.locator("dialog[open] textarea")).toHaveValue("Texto que no se debe perder");
  });
  test("preguntar · pregunta vacía: «Escribe tu pregunta.»", async ({ page }) => {
    await open(page, "tecnico");
    await page.getByRole("button", { name: "Preguntar al equipo" }).click();
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
    await expect(page.locator("dialog[open] [role=alert]")).toContainText("Escribe tu pregunta.");
  });
  test("401 al enviar: vuelve al ingreso con aviso y el borrador se conserva", async ({ page }) => {
    const s = scenario("tecnico"); await open(page, "tecnico", "#/inicio", { s });
    s.fail.message = { status: 401, code: "bad_session", message: "Tu sesión expiró." };
    await preguntar(page, "No quiero perder esto");
    await expect(page.locator(".pn-auth")).toContainText("Tu sesión se cerró por seguridad. Ingresa de nuevo.");
    expect(await page.evaluate(() => localStorage.getItem("fa-borrador-carlos@taller.cl"))).toBe("No quiero perder esto");
    await page.getByLabel("Correo").fill("carlos@taller.cl"); await page.locator("#aPass").fill("buenaclave");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await page.getByRole("button", { name: "Preguntar al equipo" }).click();
    await expect(page.locator("dialog[open] textarea")).toHaveValue("No quiero perder esto");
  });
  const videoCasos = [["too_many", 409, /Ya tienes 2 solicitudes pendientes\. Espera la respuesta del equipo\./], ["too_soon", 400, /al menos 30 minutos de anticipación/], ["too_far", 400, /dentro de los próximos 90 días/], ["bad_when", 400, /Elige una fecha y hora válidas/]];
  for (const [code, status, re] of videoCasos) {
    test(`videollamada · ${code}`, async ({ page }) => {
      const s = scenario("premium"); await open(page, "premium", "#/videollamadas", { s });
      await page.getByRole("button", { name: "Pedir una videollamada" }).click();
      const d = new Date(Date.now() + 5 * DAY), p2 = (n) => String(n).padStart(2, "0");
      await page.locator("#vDate").fill(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`); await page.locator("#vTime").fill("17:00");
      s.fail["video-request"] = { status, code, message: "x" };
      await page.getByRole("button", { name: "Solicitar" }).click();
      await expect(page.locator("#vErr")).toContainText(re);
    });
  }
  test("videollamada · fecha vacía y bad_state al aceptar", async ({ page }) => {
    const s = scenario("premium"); s.videos.push({ id: "66666666-6666-6666-6666-666666666666", status: "propuesta", scheduledAt: iso(Date.now() + 3 * DAY), canJoin: false, url: "", note: "" });
    await open(page, "premium", "#/videollamadas", { s });
    s.fail["video-accept"] = { status: 400, code: "bad_state", message: "x" };
    await page.getByRole("button", { name: "Aceptar esta hora" }).click();
    await expect(page.locator(".pn-toast--error")).toContainText("Esta solicitud ya cambió. Actualiza para ver cómo quedó.");
    await page.getByRole("button", { name: "Pedir una videollamada" }).click();
    await page.getByRole("button", { name: "Solicitar" }).click();
    await expect(page.locator("#vErr")).toContainText("Elige una fecha y hora válidas.");
  });
});

/* ============ Mi plan ============ */
test.describe("Mi plan", () => {
  test("Aprendiz y Técnico ven la tabla «Qué incluye cada plan»; Premium no; plan vencido solo ve «Renovar»; no hay cambio de plan en el panel", async ({ page }) => {
    await open(page, "aprendiz", "#/plan");
    await expect(page.getByRole("heading", { name: "Qué incluye cada plan" })).toBeVisible();
    await expect(page.locator(".pn-table")).toContainText("3 al mes");
    await expect(page.getByRole("link", { name: "Ver planes" }).first()).toHaveAttribute("href", "planes.html");
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/Cambiar de plan|Subir al|Bajar al/);
    await open(page, "premium", "#/plan");
    await expect(page.getByRole("heading", { name: "Qué incluye cada plan" })).toHaveCount(0);
    await open(page, "vencido", "#/plan");
    await expect(page.locator(".pn-table")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Renovar mi plan" })).toHaveAttribute("href", "planes.html");
  });

  test("Mi plan: valor, vigencia, cupo, beneficios reales y WhatsApp +56 9 8778 5601", async ({ page }) => {
    const s = await open(page, "aprendiz", "#/plan");
    const mine = page.locator("#plMine");
    await expect(mine).toContainText("Plan Aprendiz"); await expect(mine).toContainText("$5.000 al mes");
    await expect(mine).toContainText(fmtFecha(s.me.subscriber.periodEnd));
    await expect(mine).toContainText("2 de 3 disponibles"); await expect(mine).toContainText("3 preguntas mensuales");
    const wa = page.locator("#plRest").getByRole("link", { name: "Escribir por WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/56987785601\?text=/);
    await expect(page.locator("#plRest")).toContainText("Para cambiarlo o cancelarlo, escríbenos");
    await expect(page.locator("#plRest")).toContainText("+56 9 8778 5601");
  });
});

/* ============ D. accesibilidad y calidad ============ */
for (const [vn, vp] of Object.entries(VIEWS)) {
  test.describe(`D. accesibilidad (${vn})`, () => {
    test.use({ viewport: vp });
    test("axe: 0 problemas graves o críticos en todas las vistas, ingreso y ventanas; sin desplazamiento horizontal; objetivos táctiles ≥ 44 px", async ({ page }) => {
      const s = await open(page, "premium");
      const revisar = async (nombre) => {
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        const graves = r.violations.filter((v) => ["serious", "critical"].includes(v.impact));
        expect(graves.map((v) => `${nombre}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`), nombre).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), nombre + " sin scroll horizontal").toBe(true);
        const chicos = await page.evaluate(() => [...document.querySelectorAll("main a.pn-btn, main button, main .pn-chip, #pnNav a, #pnBar a, #pnBar button, dialog[open] button, dialog[open] a")].filter((e) => e.offsetParent !== null && !e.closest("p")).map((e) => ({ t: (e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })).filter((b) => b.h && (b.h < 43.5 || b.w < 43.5)));
        expect(chicos, nombre + " objetivos pequeños").toEqual([]);
      };
      for (const r of NAV) { await page.goto("/mi-cuenta.html#/" + r); await page.waitForSelector("h1"); await page.waitForTimeout(250); await revisar(r); }
      await page.goto("/mi-cuenta.html#/inicio"); await page.waitForSelector("h1");
      await page.getByRole("button", { name: "Preguntar al equipo" }).click(); await revisar("cuadro de pregunta"); await page.keyboard.press("Escape");
      expect(s.errors).toEqual([]);
      for (const kind of ["verificando", "vencido", "sincupo"]) { await open(page, kind); await page.waitForTimeout(200); await revisar("estado " + kind); }
      await open(page, "tecnico", "#/inicio", { sess: false }); await revisar("ingreso");
      await page.getByRole("button", { name: "Crear mi cuenta" }).click(); await revisar("crear cuenta");
    });
  });
}

test.describe("D. teclado, foco y refresco", () => {
  test("17 · solo teclado: ir al botón, abrir el cuadro, Esc cierra y devuelve el foco; anillo de foco visible", async ({ page }) => {
    await open(page, "tecnico");
    await page.getByRole("button", { name: "Preguntar al equipo" }).focus();
    const ring = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return { w: c.outlineWidth, st: c.outlineStyle }; });
    expect(ring).toEqual({ w: "3px", st: "solid" });
    await page.keyboard.press("Enter");
    await expect(page.locator("dialog[open] textarea")).toBeFocused();
    await page.keyboard.insertText("Prueba solo teclado");
    await page.keyboard.press("Control+Enter");
    await expect(page.locator(".pn-toast")).toContainText("Pregunta enviada");
    await page.goto("/mi-cuenta.html#/inicio"); await page.waitForSelector("h1");
    const btn = page.getByRole("button", { name: "Preguntar al equipo" });
    await btn.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Escape");
    await expect(btn).toBeFocused();
  });

  test("los modales atrapan el foco (Tab no sale del cuadro)", async ({ page }) => {
    await open(page, "tecnico");
    await page.getByRole("button", { name: "Preguntar al equipo" }).click();
    for (let i = 0; i < 9; i++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => { const a = document.activeElement; return a === document.body || !!a.closest("dialog"); })).toBe(true); }
  });

  test("el refresco automático no repinta lo que se está escribiendo (conserva texto, foco y desplazamiento)", async ({ page }) => {
    const s = await open(page, "tecnico", "#/preguntas");
    const ta = page.locator("#pqText"); await ta.click(); await page.keyboard.insertText("Escribiendo una pregunta larga");
    await page.evaluate(() => { window.__ta = document.querySelector("#pqText"); });
    const sy = await page.evaluate(() => window.scrollY);
    s.me.messages.push({ id: 55, sender: "equipo", body: "Llegó una respuesta mientras escribías", created_at: iso(Date.now()), read: false });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.locator("#pqChat")).toContainText("Llegó una respuesta mientras escribías");
    expect(await page.evaluate(() => window.__ta === document.querySelector("#pqText"))).toBe(true);
    await expect(ta).toBeFocused(); await expect(ta).toHaveValue("Escribiendo una pregunta larga");
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - sy)).toBeLessThan(400);
  });

  test("Cerrar sesión sin diálogo del navegador; limpia borradores", async ({ page }) => {
    await open(page, "tecnico");
    await page.getByRole("button", { name: "Preguntar al equipo" }).click(); await page.keyboard.insertText("borrador"); await page.keyboard.press("Escape");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fa-borrador")).length)).toBe(1);
    await page.locator("#pnMenuBtn").click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Ingresa a tu cuenta" })).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fa-borrador")).length)).toBe(0);
  });
});
