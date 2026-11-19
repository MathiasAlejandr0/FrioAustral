/* Genera las capturas de revisión en /workspace/fa-panel-equipo (no es una prueba). Se ejecuta con: npx playwright test capturas.spec.js */
const { test } = require("@playwright/test");
const { instalar } = require("./lib/mock"); const { png } = require("./lib/png");
const OUT = process.env.CAPTURAS || "/workspace/fa-panel-equipo";
test.skip(!process.env.CAPTURAS, "solo con CAPTURAS=ruta");
const FOTO = { name: "foto.png", mimeType: "image/png", buffer: png(2000, 1200, [200, 80, 40]) };
test("capturas", async ({ page }) => {
  test.setTimeout(120000);
  await instalar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/equipo.html#/resumen"); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-escritorio-resumen.png` });
  await page.goto("/equipo.html#/paginas/taller"); await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/02-escritorio-pagina-taller-mapa.png` });
  await page.locator("#z-taller-galeria-1").getByRole("button", { name: "Cambiar foto" }).click();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("dialog").getByRole("button", { name: "Elegir foto" }).click()]);
  await fc.setFiles(FOTO); await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/03-escritorio-cambiar-foto-revisar.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/equipo.html#/paginas/inicio"); await page.reload(); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/04-celular-pagina-inicio.png` });
  await page.locator("#pMapD > summary").click(); await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/05-celular-mapa.png` });
  await page.goto("/equipo.html#/planes"); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/06-celular-material-planes.png` });
});
