/* Editar un texto en el panel, verlo en la página y volver al original. API simulada, sin datos reales. */
const { test, expect } = require("./lib/test");
const { instalar } = require("./lib/mock");
const path = require("path");

const ORIGINAL = "Academia online · Video + PDF";
const NUEVO = "Texto de prueba del taller";
const dlg = (page) => page.getByRole("dialog");

async function abrirEditor(page, vp) {
  await page.setViewportSize(vp);
  const S = await instalar(page);
  await page.goto("/equipo.html#/paginas/inicio");
  const fila = page.locator('[data-tx="inicio.portada.1"]');
  await fila.getByRole("button", { name: "Editar texto" }).click();
  return S;
}

test("editar un texto en el panel, verlo en la página y volver al original", async ({ page }) => {
  test.setTimeout(120000);
  const S = await abrirEditor(page, { width: 1440, height: 900 });
  const caja = dlg(page).getByLabel("Texto que se verá en el sitio");
  await caja.fill(NUEVO);
  await page.screenshot({ path: path.join("/opt/cursor/artifacts", "panel-editar-texto-escritorio.png") });
  await dlg(page).getByRole("button", { name: "Revisar" }).click();
  await expect(dlg(page).getByText("Así se verá en computador")).toBeVisible();
  await expect(dlg(page).getByText("Así se verá en celular")).toBeVisible();
  await expect(dlg(page).getByText("Antes")).toBeVisible();
  await expect(dlg(page).getByText("Después")).toBeVisible();
  await dlg(page).getByRole("button", { name: "Continuar" }).click();
  await dlg(page).getByRole("button", { name: "Publicar en el sitio" }).click();
  await expect(dlg(page).getByRole("heading", { name: "¡Listo!" })).toBeVisible();
  expect(S.api("texts-save").at(-1).body.body).toBe(NUEVO);

  await page.goto("/index.html");
  await expect(page.locator("[data-edit='inicio.portada.1']")).toHaveText(NUEVO);

  await page.goto("/equipo.html#/paginas/inicio");
  const fila = page.locator('[data-tx="inicio.portada.1"]');
  await expect(fila.getByRole("button", { name: "Volver al original" })).toBeVisible();
  await fila.getByRole("button", { name: "Volver al original" }).click();
  await dlg(page).getByRole("button", { name: "Volver al original" }).click();
  await expect(fila.getByText("Original del sitio")).toBeVisible();
  expect(S.api("texts-reset").at(-1).body.id).toBe("inicio.portada.1");

  await page.goto("/index.html");
  await expect(page.locator("[data-edit='inicio.portada.1']")).toHaveText(ORIGINAL);
});

test("el editor de texto cabe en el celular", async ({ page }) => {
  await abrirEditor(page, { width: 390, height: 844 });
  await dlg(page).getByLabel("Texto que se verá en el sitio").fill(NUEVO);
  await page.screenshot({ path: path.join("/opt/cursor/artifacts", "panel-editar-texto-celular.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
