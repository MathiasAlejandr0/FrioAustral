/* Las diez tareas de la prueba de uso (T1–T10), automatizadas con API simulada.
   Siguen solo elementos visibles por su texto, cuentan los clics desde «Resumen», miden el tiempo y fallan si superan el máximo. */
const { test, expect } = require("./lib/test");
const { instalar } = require("./lib/mock");
const { png } = require("./lib/png");

const FOTO = { name: "foto-nueva.png", mimeType: "image/png", buffer: png(2000, 1200, [200, 80, 40]) };
const PDF = { name: "ebook-gases.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%fake\n") };
const VIDEO = { name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048, 1) };

async function iniciar(page) {
  const S = await instalar(page);
  await page.goto("/equipo.html#/resumen");
  await expect(page.getByRole("heading", { level: 1, name: "Resumen" })).toBeVisible();
  const t = { n: 0, t0: Date.now() };
  t.click = async (loc) => { t.n++; await loc.click(); };
  t.elegir = async (loc, file) => { const [fc] = await Promise.all([page.waitForEvent("filechooser"), t.click(loc)]); await fc.setFiles(file); };
  t.fin = (maxClics, maxMs, nombre) => { expect(t.n, `${nombre}: clics`).toBeLessThanOrEqual(maxClics); expect(Date.now() - t.t0, `${nombre}: tiempo`).toBeLessThanOrEqual(maxMs); };
  return { S, t };
}
const dlg = (page) => page.getByRole("dialog");

test("T1 · cambiar la foto grande de Inicio (≤ 6 clics, 1 min)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Cambiar una foto del sitio" }));
  await t.click(page.locator("#z-inicio-portada-foto").getByRole("button", { name: "Cambiar foto" }));
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir foto" }), FOTO);
  await t.click(dlg(page).getByLabel(/Revisé que la cara/));
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  expect(S.api("media-upload-url").length, "no se sube nada antes de Publicar").toBe(0);
  await t.click(dlg(page).getByRole("button", { name: "Publicar en el sitio" }));
  await expect(dlg(page).getByText("¡Listo!").first()).toBeVisible();
  expect(S.api("media-save")[0].body.slot).toBe("inicio-portada-foto");
  expect(S.api("media-upload-url")[0].body.contentType).toBe("image/webp");
  t.fin(6, 60000, "T1");
});

test("T2 · cambiar la tercera foto de la galería del taller (≤ 7 clics, 90 s)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Cambiar una foto del sitio" }));
  await t.click(page.getByRole("navigation", { name: "Páginas del sitio" }).getByRole("link", { name: "Taller" }));
  const card = page.locator(".fap-slot", { hasText: "Galería · foto 3 de 6" });
  await expect(card).toHaveCount(1);
  await t.click(card.getByRole("button", { name: "Cambiar foto" }));
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir foto" }), FOTO);
  const ack = dlg(page).getByLabel(/Revisé que la cara/);
  if (await ack.count()) await t.click(ack);
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  await t.click(dlg(page).getByRole("button", { name: "Publicar en el sitio" }));
  await expect(dlg(page).getByText("¡Listo!").first()).toBeVisible();
  expect(S.api("media-save")[0].body.slot).toBe("taller-galeria-1") /* el orden visual de la galería es 5, 6, 1, 2, 3, 4 (igual que taller.html) */;
  t.fin(7, 90000, "T2");
});

test("T3 · subir un ebook para el Plan Premium (≤ 8 clics, 2 min)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Subir un archivo" }).or(page.getByRole("button", { name: "Subir un archivo" })));
  await t.click(dlg(page).getByRole("link", { name: /Material para suscriptores/ }));
  await t.click(page.locator(".fap-plan", { hasText: "Plan Premium" }).getByRole("button", { name: "Subir archivo para este plan" }));
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir archivo" }), PDF);
  await dlg(page).getByLabel("Título").fill("Ebook de gases refrigerantes 2");
  await t.click(dlg(page).getByLabel("Ebook"));
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  await t.click(dlg(page).getByRole("button", { name: "Publicar ahora" }));
  await expect(dlg(page).getByText("¡Listo!")).toBeVisible();
  const s = S.api("material-save")[0].body;
  expect(s.plans).toEqual(["premium"]); expect(s.published).toBe(true); expect(s.category).toBe("ebook");
  t.fin(8, 120000, "T3");
});

test("T4 · agregar un video de YouTube a los recursos gratis (≤ 8 clics, 2 min)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Subir un archivo" }).or(page.getByRole("button", { name: "Subir un archivo" })));
  await t.click(dlg(page).getByRole("link", { name: /Recurso gratis/ }));
  await t.click(page.getByRole("button", { name: "Agregar video de YouTube" }));
  await dlg(page).getByLabel("Link del video").fill("https://youtu.be/dQw4w9WgXcQ");
  await dlg(page).getByLabel("Título").fill("Presiones en alta");
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  await t.click(dlg(page).getByRole("button", { name: "Publicar ahora" }));
  await expect(dlg(page).getByText("¡Listo!")).toBeVisible();
  const b = S.api("free-save")[0].body; expect(b.kind).toBe("video_externo"); expect(b.published).toBe(true);
  t.fin(8, 120000, "T4");
});

test("T5 · subir un documento PDF a los recursos gratis (≤ 9 clics, 2 min 30 s)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Subir un archivo" }).or(page.getByRole("button", { name: "Subir un archivo" })));
  await t.click(dlg(page).getByRole("link", { name: /Recurso gratis/ }));
  await t.click(page.getByRole("button", { name: "Subir documento" }));
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir documento" }), PDF);
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir foto" }), FOTO);
  await dlg(page).getByLabel("Título").fill("Tabla de gases");
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  await t.click(dlg(page).getByRole("button", { name: "Publicar ahora" }));
  await expect(dlg(page).getByText("¡Listo!")).toBeVisible();
  expect(S.api("free-save")[0].body.kind).toBe("archivo");
  t.fin(9, 150000, "T5");
});

test("T6 · subir un video corto a los recursos gratis (≤ 10 clics, 3 min)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Subir un archivo" }).or(page.getByRole("button", { name: "Subir un archivo" })));
  await t.click(dlg(page).getByRole("link", { name: /Recurso gratis/ }));
  await t.click(page.getByRole("button", { name: "Subir video corto" }));
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir video" }), VIDEO);
  await t.elegir(dlg(page).getByRole("button", { name: "Elegir foto" }), FOTO);
  await dlg(page).getByLabel("Título").fill("Cómo cargar gas");
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  await t.click(dlg(page).getByRole("button", { name: "Publicar ahora" }));
  await expect(dlg(page).getByText("¡Listo!")).toBeVisible();
  expect(S.api("free-save")[0].body.kind).toBe("video_corto");
  t.fin(10, 180000, "T6");
});

test("T7 · dar el Plan Técnico por un mes (≤ 6 clics, 90 s)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Dar acceso a una persona" }));
  await expect(dlg(page)).toBeVisible();
  await dlg(page).getByLabel(/Correo/).fill("nuevo@correo.cl");
  await t.click(dlg(page).getByText("Plan Técnico"));
  await t.click(dlg(page).getByRole("button", { name: "1 mes" }));
  await t.click(dlg(page).getByRole("button", { name: "Continuar" }));
  await expect(dlg(page).getByText(/Vas a dar el/)).toContainText("Plan Técnico");
  await t.click(dlg(page).getByRole("button", { name: "Confirmar" }));
  await expect(page.getByText("nuevo@correo.cl").first()).toBeVisible();
  const b = S.api("access-grant")[0].body; expect(b.plan).toBe("pro"); expect(b.email).toBe("nuevo@correo.cl");
  t.fin(6, 90000, "T7");
});

test("T8 · responder la pregunta que está esperando (≤ 4 clics, 60 s)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("navigation", { name: "Accesos rápidos" }).getByRole("link", { name: "Responder mensajes" }));
  await t.click(page.getByRole("button", { name: /Ana Rojas/ }));
  await page.getByLabel(/Tu respuesta/).fill("Hola Ana, revisa primero que no haya fugas y mide la presión en reposo.");
  await t.click(page.getByRole("button", { name: "Enviar respuesta" }));
  await expect(page.getByText("revisa primero que no haya fugas")).toBeVisible();
  expect(S.api("reply")[0].body.user).toContain("000000000001");
  t.fin(4, 60000, "T8");
});

test("T9 · confirmar la videollamada que pidió un cliente (≤ 4 clics, 45 s)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Ver videollamadas" }));
  await t.click(page.getByRole("button", { name: "Confirmar" }).first());
  await t.click(dlg(page).getByRole("button", { name: "Confirmar" }));
  await expect(page.getByText("Videollamada confirmada.").first()).toBeVisible();
  expect(S.api("video-confirm").length).toBe(1);
  t.fin(4, 45000, "T9");
});

test("T10 · volver a poner la foto original (≤ 4 clics, 45 s)", async ({ page }) => {
  const { S, t } = await iniciar(page);
  await t.click(page.getByRole("link", { name: "Cambiar una foto del sitio" }));
  await t.click(page.locator("#z-inicio-curso").getByRole("button", { name: "Volver a la original" }));
  await expect(dlg(page).getByRole("button", { name: "Cancelar" })).toBeFocused();
  await t.click(dlg(page).getByRole("button", { name: "Volver a la original" }));
  await expect(page.locator("#z-inicio-curso").getByText("Original del sitio")).toBeVisible();
  expect(S.api("media-reset")[0].body.slot).toBe("inicio-curso");
  t.fin(4, 45000, "T10");
});
