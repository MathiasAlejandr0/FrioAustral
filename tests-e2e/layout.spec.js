/* Celular (390×844) y escritorio (1440×900): sin desplazamiento horizontal, objetivos táctiles ≥ 44 px, la barra inferior no tapa contenido y axe sin problemas graves. */
const { test, expect } = require("./lib/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { instalar } = require("./lib/mock");
const M = require("../assets/fa-panel-mapa.js");

const VISTAS = ["#/resumen", "#/mensajes", "#/mensajes/videollamadas", "#/planes", "#/accesos"].concat(M.PAGINAS.map((p) => "#/paginas/" + p.slug));
const VPS = [{ n: "celular", width: 390, height: 844 }, { n: "escritorio", width: 1440, height: 900 }];

for (const vp of VPS) {
  test(`${vp.n}: sin desplazamiento horizontal${vp.n === "celular" ? ", objetivos táctiles ≥ 44 px y el final de cada vista alcanzable" : ""}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await instalar(page);
    await page.goto("/equipo.html#/resumen");
    for (const v of VISTAS) {
      await page.evaluate((h) => { location.hash = h; }, v);
      await page.waitForTimeout(900);
      const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      expect(d.sw, `${v} desborda a lo ancho`).toBeLessThanOrEqual(d.iw);
      if (vp.n !== "celular") continue;
      const chicos = await page.evaluate(() => [...document.querySelectorAll("button,a[href],select,textarea,summary,input:not([type=hidden])")]
        .filter((e) => !e.closest(".fap-map") && !(e.matches("input") && (e.closest("label") || e.classList.contains("fap-sr"))))
        .map((e) => [e, e.getBoundingClientRect()]).filter(([e, r]) => r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden")
        .filter(([e, r]) => r.height < 43.5 || r.width < 43.5).map(([e, r]) => `${e.tagName} «${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}» ${Math.round(r.width)}×${Math.round(r.height)}`));
      expect(chicos, `${v}: objetivos táctiles chicos`).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const f = await page.evaluate(() => {
        const nav = document.querySelector(".fap-bnav"), n = nav ? nav.getBoundingClientRect().top : innerHeight;
        const last = [...document.querySelectorAll("main *")].filter((e) => e.checkVisibility() && e.getBoundingClientRect().height > 0).map((e) => e.getBoundingClientRect().bottom).sort((a, b) => b - a)[0];
        return { n, last };
      });
      expect(f.last, `${v}: el final queda tapado por la barra inferior`).toBeLessThanOrEqual(f.n + 1);
    }
  });

  test(`${vp.n}: axe sin problemas graves ni críticos (todas las vistas y un cuadro abierto)`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await instalar(page);
    await page.goto("/equipo.html#/resumen");
    const revisar = async (nombre) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).disableRules(["region"]).analyze();
      const graves = r.violations.filter((x) => ["serious", "critical"].includes(x.impact)).map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(graves, nombre).toEqual([]);
    };
    for (const v of VISTAS) { await page.evaluate((h) => { location.hash = h; }, v); await page.waitForTimeout(1500); await revisar(v); }
    await page.evaluate(() => { location.hash = "#/paginas/inicio"; }); await page.waitForTimeout(1200);
    await page.locator("#z-inicio-final").getByRole("button", { name: "Cambiar foto" }).click();
    await revisar("cuadro «Cambiar foto»");
  });
}

test("el ingreso se ve y se usa en celular sin desbordar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await instalar(page, { session: false });
  await page.goto("/equipo.html");
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((x) => ["serious", "critical"].includes(x.impact)).map((x) => x.id)).toEqual([]);
  await page.getByLabel("Correo").fill("equipo@frioaustral.cl"); await page.getByLabel("Contraseña").fill("mala");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /no coinciden/ })).toBeVisible();
  await page.getByLabel("Contraseña").fill("clave-ok"); await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Resumen" })).toBeVisible();
});
