const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/* Página 404 propia: se prueba en escritorio y celular, a una dirección con subcarpetas para comprobar que
   los estilos, el logo y las fuentes cargan igual (404.html lleva <base href="/">). */
const shotsDir = process.env.SHOTS_404 || path.join(__dirname, "test-results", "capturas-404");
fs.mkdirSync(shotsDir, { recursive: true });

for (const [name, viewport] of [["escritorio-1366", { width: 1366, height: 768 }], ["celular-390", { width: 390, height: 844 }]]) {
  test(`404 en ${name}: código 404, diseño del sitio, botones y sin desborde`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: name.startsWith("celular") ? 2 : 1, locale: "es-CL" });
    const page = await ctx.newPage();
    const errores = [], fallidas = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/no/existe/esta-pagina")) fallidas.push(r.status() + " " + r.url()); });
    await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, media: {} }) }));

    const resp = await page.goto("/no/existe/esta-pagina", { waitUntil: "networkidle" });
    expect(resp.status()).toBe(404);
    await expect(page).toHaveTitle(/Página no encontrada/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("No encontramos");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");

    /* mismo header y footer que el resto del sitio */
    await expect(page.locator("header.nav .brand img")).toBeVisible();
    expect(await page.locator("header.nav .brand img").evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(page.locator("footer.footer")).toContainText("Augusto Goecke 296, Puerto Montt");

    /* botones */
    const home = page.locator("main a.btn-red", { hasText: "Ir al inicio" });
    const cursos = page.locator("main a.btn-line", { hasText: "Ver cursos" });
    const wa = page.locator("main a.btn-wa");
    await expect(home).toBeVisible(); await expect(cursos).toBeVisible(); await expect(wa).toBeVisible();
    expect(await home.evaluate((a) => a.href)).toMatch(/\/index\.html$/);
    expect(await cursos.evaluate((a) => a.href)).toMatch(/\/cursos\.html$/);
    expect(await wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/56987785601/);
    await expect(wa).toContainText("+56 9 8778 5601");

    /* se ven los estilos del sitio (no es una página sin CSS) y el contenido propio de la 404 no usa vidrio ni desenfoque
       (el header, el menú y la barra móvil son los compartidos del sitio) */
    expect(await page.locator("body").evaluate((b) => getComputedStyle(b).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    const efectos = await page.evaluate(() => [...document.querySelectorAll("main, main *")].filter((e) => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== "none") || (s.filter && s.filter.includes("blur")); }).length);
    expect(efectos).toBe(0);
    /* sin desborde horizontal */
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    /* los tres botones no se salen de la pantalla */
    for (const b of [home, cursos, wa]) { const box = await b.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width); }
    expect(errores).toEqual([]);
    expect(fallidas).toEqual([]);

    await page.screenshot({ path: path.join(shotsDir, `404-${name}.png`), fullPage: false });
    await page.screenshot({ path: path.join(shotsDir, `404-${name}-completa.png`), fullPage: true });

    /* los botones llevan a páginas reales */
    await home.click();
    await expect(page).toHaveURL(/\/index\.html$|\/$/);
    expect((await page.request.get("/cursos.html")).status()).toBe(200);
    await ctx.close();
  });
}
