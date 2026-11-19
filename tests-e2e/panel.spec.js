/* Criterios de aceptación del panel con API simulada: mapa, tarjetas, vista previa, WebP, confirmaciones, errores, sesión. */
const { test, expect } = require("./lib/test");
const { instalar, uid } = require("./lib/mock");
const { png } = require("./lib/png");
const M = require("../assets/fa-panel-mapa.js");
const SL = require("../assets/fa-slots.js");

const FOTO = { name: "foto-nueva.png", mimeType: "image/png", buffer: png(2000, 1200, [200, 80, 40]) };
const dlg = (page) => page.getByRole("dialog");
async function abrir(page, hash, vp) {
  if (vp) await page.setViewportSize(vp);
  const S = await instalar(page);
  await page.goto("/equipo.html" + hash);
  return S;
}

for (const pg of M.PAGINAS) {
  for (const modo of ["Computador", "Celular"]) {
    test(`mapa de ${pg.nombre} (${modo}): marca todas sus zonas, fuera de las fotos`, async ({ page }) => {
      await abrir(page, "#/paginas/" + pg.slug, { width: modo === "Celular" ? 390 : 1440, height: modo === "Celular" ? 844 : 900 });
      if (modo === "Celular") { await page.getByText("Ver mapa de la página").click(); await page.getByRole("button", { name: "Celular" }).click(); }
      await expect(page.locator(".fap-map [data-note]")).not.toHaveText("Cargando la página…", { timeout: 15000 });
      await page.waitForTimeout(600);
      const ids = pg.ids.length;
      const pills = await page.locator(".fap-map .fap-mk").count();
      expect(pills, "un número por zona").toBe(ids);
      /* ningún número se dibuja sobre una foto del mapa */
      const choques = await page.evaluate(() => {
        const f = document.querySelector(".fap-map iframe"); if (!f) return [];
        const fr = f.getBoundingClientRect(), k = fr.width / f.offsetWidth, d = f.contentDocument;
        const fotos = [...d.querySelectorAll("img,video")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 20 && r.height > 20).map((r) => ({ l: fr.left + r.left * k, t: fr.top + r.top * k, r: fr.left + r.right * k, b: fr.top + r.bottom * k }));
        return [...document.querySelectorAll(".fap-map .layer .fap-mk")].map((p) => p.getBoundingClientRect()).filter((p) => fotos.some((a) => p.left < a.r - 2 && p.right > a.l + 2 && p.top < a.b - 2 && p.bottom > a.t + 2)).length;
      });
      expect(choques).toBe(0);
    });
  }
  test(`${pg.nombre}: tarjetas del mismo tamaño y fotos que llenan su caja`, async ({ page }) => {
    await abrir(page, "#/paginas/" + pg.slug, { width: 1440, height: 900 });
    const cards = page.locator(".fap-slot");
    if (pg.slug === "gratis") await expect(page.locator(".fap-rbox .fap-card, .fap-rbox .fap-skel").first()).toBeVisible();
    await expect(cards).toHaveCount(pg.ids.length);
    const r = await cards.evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(), t = e.querySelector(".fap-thumb"), m = t.querySelector("img,video"), cs = getComputedStyle(m); return [Math.round(b.width), Math.round(b.height), cs.objectFit, t.querySelectorAll("*").length]; }));
    expect(new Set(r.map((x) => x[0])).size, "mismo ancho").toBe(1);
    expect(new Set(r.map((x) => x[1])).size, "mismo alto").toBe(1);
    r.forEach((x) => { expect(x[2]).toBe("cover"); expect(x[3], "nada dibujado sobre la miniatura").toBe(1); });
  });
}

test("al elegir una foto aparece la vista previa en computador y celular antes de subir nada", async ({ page }) => {
  const S = await abrir(page, "#/paginas/taller", { width: 1440, height: 900 });
  await page.locator("#z-taller-galeria-1").getByRole("button", { name: "Cambiar foto" }).click();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), dlg(page).getByRole("button", { name: "Elegir foto" }).click()]);
  await fc.setFiles(FOTO);
  await expect(dlg(page).getByText("Así se verá en computador")).toBeVisible();
  await expect(dlg(page).getByText("Así se verá en celular")).toBeVisible();
  await expect(dlg(page).locator(".fap-previews iframe")).toHaveCount(2);
  await expect.poll(() => dlg(page).locator(".fap-previews iframe").evaluateAll((fs) => fs.filter((f) => f.contentDocument && f.contentDocument.querySelector('img[src^="blob:"]')).length), { timeout: 15000 }).toBe(2);
  expect(S.calls.filter((c) => /upload-url|-save/.test(c.action)).length).toBe(0);
  expect(S.uploads.length).toBe(0);
  await dlg(page).getByRole("button", { name: "Continuar" }).click();
  expect(S.uploads.length).toBe(0);
  await dlg(page).getByRole("button", { name: "Publicar en el sitio" }).click();
  await expect(dlg(page).getByText("¡Listo!").first()).toBeVisible();
  expect(S.uploads.length).toBe(1);
});

test("las fotos se envían como WebP (≤ 2400 px); WebP livianos y videos no se tocan", async ({ page }) => {
  const S = await abrir(page, "#/paginas/inicio");
  await page.locator("#z-inicio-final").getByRole("button", { name: "Cambiar foto" }).click();
  const grande = { name: "gran.png", mimeType: "image/png", buffer: png(3000, 2000, [10, 120, 200]) };
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), dlg(page).getByRole("button", { name: "Elegir foto" }).click()]);
  await fc.setFiles(grande);
  await dlg(page).getByRole("button", { name: "Continuar" }).click();
  await dlg(page).getByRole("button", { name: "Publicar en el sitio" }).click();
  await expect(dlg(page).getByText("¡Listo!").first()).toBeVisible();
  const up = S.api("media-upload-url")[0].body;
  expect(up.contentType).toBe("image/webp"); expect(up.fileName).toMatch(/\.webp$/); expect(up.size).toBeLessThan(grande.buffer.length);
  const r = await page.evaluate(async () => {
    const mk = (w, h, tipo) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").fillRect(0, 0, w, h); c.toBlob((b) => ok(new File([b], "x." + tipo.split("/")[1], { type: tipo })), tipo); });
    const a = await window.FAP.aWebp(await mk(3000, 2000, "image/png"));
    const dim = await createImageBitmap(a.file);
    const liviano = await window.FAP.aWebp(await mk(800, 600, "image/webp"));
    return { conv: a.converted, tipo: a.file.type, lado: Math.max(dim.width, dim.height), livianoConv: liviano.converted };
  });
  expect(r).toEqual({ conv: true, tipo: "image/webp", lado: 2400, livianoConv: false });
});

test("un video se sube tal cual (sin convertir) y con su tipo", async ({ page }) => {
  const S = await abrir(page, "#/paginas/inicio");
  await page.locator("#z-inicio-portada-video").getByRole("button", { name: "Cambiar video" }).click();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), dlg(page).getByRole("button", { name: "Elegir video" }).click()]);
  const buf = Buffer.alloc(4096, 7); await fc.setFiles({ name: "v.mp4", mimeType: "video/mp4", buffer: buf });
  await dlg(page).getByLabel(/Revisé que la cara/).check();
  await dlg(page).getByRole("button", { name: "Continuar" }).click();
  await dlg(page).getByRole("button", { name: "Publicar en el sitio" }).click();
  await expect(dlg(page).getByText("¡Listo!").first()).toBeVisible();
  const b = S.api("media-upload-url")[0].body; expect(b.contentType).toBe("video/mp4"); expect(b.size).toBe(4096);
});

test("elegir un archivo que no sirve se rechaza al instante, sin pedir nada al servidor", async ({ page }) => {
  const S = await abrir(page, "#/paginas/inicio");
  await page.locator("#z-inicio-final").getByRole("button", { name: "Cambiar foto" }).click();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), dlg(page).getByRole("button", { name: "Elegir foto" }).click()]);
  await fc.setFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
  await expect(dlg(page).getByRole("alert").filter({ hasText: "Ese tipo de archivo no sirve aquí" })).toBeVisible();
  expect(S.calls.filter((c) => /upload-url/.test(c.action)).length).toBe(0);
});

test("«Volver a la original» funciona en los 34 espacios y siempre pide confirmación", async ({ page }) => {
  test.setTimeout(240000);
  const S = await abrir(page, "#/resumen");
  for (const s of SL.SLOTS) S.media[s.id] = { url: "https://sb.test/storage/v1/object/public/site-media/" + s.id + "/1-a.webp", alt: "", updatedAt: new Date().toISOString(), size: 1, contentType: "image/webp", hasPrevious: false };
  for (const pg of M.PAGINAS) {
    await page.evaluate((h) => { location.hash = h; }, "#/paginas/" + pg.slug);
    for (const id of pg.ids) {
      await page.evaluate(() => window.FAP.drop("media"));
      const card = page.locator("#z-" + id);
      if (!(await card.count())) { await page.evaluate((h) => { location.hash = "#/resumen"; setTimeout(() => (location.hash = h), 30); }, "#/paginas/" + pg.slug); }
      await expect(card.getByRole("button", { name: "Volver a la original" })).toBeVisible();
      await card.getByRole("button", { name: "Volver a la original" }).click();
      await expect(dlg(page).getByRole("button", { name: "Cancelar" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dlg(page)).toHaveCount(0);
      expect(S.api("media-reset").some((c) => c.body.slot === id), "Esc no borra").toBe(false);
      await card.getByRole("button", { name: "Volver a la original" }).click();
      await dlg(page).getByRole("button", { name: "Volver a la original" }).click();
      await expect(card.getByText("Original del sitio")).toBeVisible();
      expect(S.api("media-reset").at(-1).body.slot).toBe(id);
    }
  }
  expect(S.api("media-reset").length).toBe(34);
});

test("«Volver a la versión anterior» solo aparece si hay una y avisa lo que pasa", async ({ page }) => {
  const S = await abrir(page, "#/paginas/inicio");
  await expect(page.locator("#z-inicio-curso").getByRole("button", { name: "Volver a la versión anterior" })).toBeVisible();
  await expect(page.locator("#z-inicio-final").getByRole("button", { name: "Volver a la versión anterior" })).toHaveCount(0);
  await page.locator("#z-inicio-curso").getByRole("button", { name: "Volver a la versión anterior" }).click();
  await expect(dlg(page).getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dlg(page).getByRole("button", { name: "Volver a la versión anterior" }).click();
  await expect(page.locator("#z-inicio-curso").getByRole("button", { name: "Volver a la versión anterior" })).toHaveCount(0);
  expect(S.api("media-restore-previous").length).toBe(1);
});

test("borrar material, borrar recurso, quitar acceso y cancelar videollamada pasan por una confirmación con Cancelar enfocado y Esc", async ({ page }) => {
  const S = await abrir(page, "#/planes");
  await page.getByRole("button", { name: "Eliminar" }).first().click();
  await expect(dlg(page).getByRole("button", { name: "Cancelar" })).toBeFocused();
  await expect(dlg(page).getByText("Ebook de gases refrigerantes")).toBeVisible();
  await expect(dlg(page).getByRole("button", { name: "Mejor ocultarlo" })).toBeVisible();
  await page.keyboard.press("Escape"); expect(S.api("material-delete").length).toBe(0);
  await page.evaluate(() => { location.hash = "#/paginas/gratis"; });
  await page.getByRole("button", { name: "Eliminar" }).first().click();
  await expect(dlg(page).getByRole("button", { name: "Cancelar" })).toBeFocused(); await page.keyboard.press("Escape"); expect(S.api("free-delete").length).toBe(0);
  await page.evaluate(() => { location.hash = "#/accesos"; });
  await page.getByRole("button", { name: "Quitar acceso" }).first().click();
  await expect(dlg(page).getByRole("button", { name: "Cancelar" })).toBeFocused(); await page.keyboard.press("Escape"); expect(S.api("access-revoke").length).toBe(0);
  await page.evaluate(() => { location.hash = "#/mensajes/videollamadas"; });
  await page.getByRole("button", { name: "Cancelar" }).first().click();
  await expect(dlg(page).getByRole("button", { name: "No cancelar" })).toBeFocused(); await page.keyboard.press("Escape"); expect(S.api("video-cancel").length).toBe(0);
});

test("subir un archivo nuevo muestra progreso y pide revisar antes de publicar", async ({ page }) => {
  const S = await abrir(page, "#/paginas/inicio"); S.delay.upload = 700;
  await page.locator("#z-inicio-final").getByRole("button", { name: "Cambiar foto" }).click();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), dlg(page).getByRole("button", { name: "Elegir foto" }).click()]);
  await fc.setFiles(FOTO);
  await dlg(page).getByRole("button", { name: "Continuar" }).click();
  await dlg(page).getByRole("button", { name: "Publicar en el sitio" }).click();
  await expect(dlg(page).getByRole("progressbar")).toBeVisible();
  await expect(dlg(page).getByText(/No cierres esta pantalla/)).toBeVisible();
  await expect(dlg(page).getByRole("button", { name: "Cancelar subida" })).toBeVisible();
  await expect(dlg(page).getByText("¡Listo!").first()).toBeVisible();
});

/* ---- errores en lenguaje simple (sección 9) ---- */
const ERR = [
  [{ status: 401, code: "no_session" }, {}, "Tu sesión se cerró por seguridad. Ingresa de nuevo; lo que escribiste quedó guardado."],
  [{ status: 403, code: "not_admin" }, {}, "Esta cuenta no tiene permiso para entrar al panel. Pídele al administrador del sitio que la habilite."],
  [{ status: 413, code: "too_big" }, { max: 12 }, "El archivo pesa más de 12 MB. Reduce su peso o elige otro."],
  [{ status: 400, code: "bad_type" }, { what: "una foto JPG, PNG, WebP o AVIF" }, "Ese tipo de archivo no sirve aquí. Sube una foto JPG, PNG, WebP o AVIF."],
  [{ status: 400, code: "bad_size" }, {}, "No pudimos leer el archivo. Vuelve a elegirlo."],
  [{ status: 400, code: "not_uploaded" }, {}, "El archivo no terminó de subirse. Inténtalo de nuevo."],
  [{ status: 502, code: "storage_error" }, {}, "No pudimos subir el archivo. Revisa tu internet e inténtalo de nuevo."],
  [{ status: 400, code: "needs_cover" }, { youtube: true }, "Agrega la foto de referencia: es la imagen que muestra de qué trata el recurso."],
  [{ status: 400, code: "bad_video_url" }, {}, "Pega el enlace de un video completo de YouTube (empieza con https://)."],
  [{ status: 400, code: "title" }, {}, "Ponle un título."],
  [{ status: 400, code: "bad_plans" }, {}, "Elige al menos un plan."],
  [{ status: 400, code: "bad_plan" }, {}, "Elige al menos un plan."],
  [{ status: 400, code: "bad_email" }, {}, "Revisa el correo: parece incompleto."],
  [{ status: 400, code: "bad_until", message: "Elige hasta qué día tiene acceso." }, {}, "Elige hasta qué día tiene acceso."],
  [{ status: 400, code: "bad_until", message: "La fecha de término ya pasó." }, {}, "Esa fecha ya pasó."],
  [{ status: 400, code: "bad_until", message: "La vigencia máxima es de 13 meses; renuévala cuando corresponda." }, {}, "La vigencia máxima es de 13 meses."],
  [{ status: 400, code: "too_soon" }, {}, "Elige una hora con al menos 30 minutos de anticipación."],
  [{ status: 400, code: "too_far" }, {}, "Elige una hora dentro de los próximos 90 días."],
  [{ status: 400, code: "bad_when" }, {}, "Elige una fecha y hora válidas."],
  [{ status: 400, code: "bad_state" }, {}, "Esta solicitud ya cambió. Actualiza la lista para ver cómo quedó."],
  [{ status: 404, code: "not_found" }, {}, "Ya no encontramos eso (puede haberlo borrado otra persona del equipo). Actualiza la lista."],
  [{ status: 500, code: "db_error", message: "Base de datos: relation \"x\" does not exist (supabase token)" }, {}, "Algo falló de nuestro lado. No se perdió nada de lo que ya estaba publicado. Inténtalo en un minuto y, si sigue, avisa al administrador."],
];
test("cada error de la tabla produce el mensaje indicado y ninguno muestra jerga técnica", async ({ page }) => {
  await abrir(page, "#/resumen");
  const out = await page.evaluate((casos) => casos.map(([e, ctx]) => window.FAP.friendly(Object.assign(new Error(e.message || "x"), e), ctx)), ERR.map((x) => [x[0], x[1]]));
  out.forEach((m, i) => { expect(m, JSON.stringify(ERR[i][0])).toBe(ERR[i][2]); expect(m).not.toMatch(/Base de datos|Supabase|token|webhook/i); });
});

test("un error del servidor en una subida se muestra en palabras simples dentro del flujo", async ({ page }) => {
  const S = await abrir(page, "#/paginas/inicio");
  S.fail["media-upload-url"] = { status: 413, code: "too_big", message: "El archivo pesa más de 12 MB." };
  await page.locator("#z-inicio-final").getByRole("button", { name: "Cambiar foto" }).click();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), dlg(page).getByRole("button", { name: "Elegir foto" }).click()]);
  await fc.setFiles(FOTO);
  await dlg(page).getByRole("button", { name: "Continuar" }).click();
  await dlg(page).getByRole("button", { name: "Publicar en el sitio" }).click();
  await expect(dlg(page).getByRole("alert").filter({ hasText: "El archivo pesa más de 12 MB. Reduce su peso o elige otro." })).toBeVisible();
  await expect(dlg(page).getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("si falla la carga de videollamadas se muestra el error con «Reintentar», no el texto de vacío", async ({ page }) => {
  const S = await abrir(page, "#/mensajes/videollamadas");
  S.fail.videos = { status: 500, code: "db_error", message: "Base de datos: x" };
  await page.reload();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByText(/No hay (solicitudes|videollamadas)/i)).toHaveCount(0);
  S.fail = {};
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("Ana Rojas").first()).toBeVisible();
});

test("con la sesión vencida el panel vuelve al ingreso y conserva lo que se escribía", async ({ page }) => {
  const S = await abrir(page, "#/mensajes");
  await page.getByRole("button", { name: /Ana Rojas/ }).click();
  await page.getByLabel(/Tu respuesta/).fill("Respuesta a medias que no se debe perder");
  S.expire = true;
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByText("Tu sesión se cerró por seguridad")).toBeVisible();
  S.expire = false;
  await page.getByLabel("Correo").fill("equipo@frioaustral.cl");
  await page.getByLabel("Contraseña").fill("clave-ok");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Ana Rojas/ }).click();
  await expect(page.getByLabel(/Tu respuesta/)).toHaveValue("Respuesta a medias que no se debe perder");
});

test("abrir una conversación no la marca como leída; responder sí", async ({ page }) => {
  const S = await abrir(page, "#/mensajes");
  await page.getByRole("button", { name: /Luis Soto/ }).click();
  await expect(page.getByText("¿Sirve el gas R134a")).toBeVisible();
  expect(S.api("thread")[0].query.mark).toBe("0");
  expect(S.msgs[uid(2)][0].read).toBe(false);
  await page.getByRole("button", { name: "Marcar como atendida" }).click();
  await expect.poll(() => S.api("mark-read").length).toBe(1);
});

test("ningún texto visible usa términos prohibidos en ninguna vista", async ({ page }) => {
  await abrir(page, "#/resumen");
  const PROH = /hotmart|webhook|hottok|token|PURCHASE_|SUBSCRIPTION_|\bslot\b|\bbucket\b|\bjson\b|\bapi\b|supabase|base de datos:/i;
  const vistas = ["#/resumen", "#/mensajes", "#/mensajes/videollamadas", "#/planes", "#/accesos", ...M.PAGINAS.map((p) => "#/paginas/" + p.slug)];
  for (const v of vistas) {
    await page.evaluate((h) => { location.hash = h; }, v); await page.waitForTimeout(700);
    const t = await page.evaluate(() => document.body.innerText);
    expect(t.match(PROH), v).toBeNull();
  }
  await page.evaluate(() => { location.hash = "#/accesos"; }); await page.getByText("Últimos pagos recibidos").click();
  const t2 = await page.evaluate(() => document.body.innerText);
  expect(t2).toContain("Pago confirmado"); expect(t2).toContain("Otro aviso de pago"); expect(t2).toContain("Listo: el plan se actualizó"); expect(t2).not.toMatch(PROH);
});

test("sin pagos en línea configurados se avisa en palabras simples", async ({ page }) => {
  const S = await abrir(page, "#/resumen"); S.hottokConfigured = false;
  await page.evaluate(() => { window.FAP.drop("access"); location.hash = "#/accesos"; });
  await expect(page.getByText("Los pagos en línea todavía no activan los planes solos")).toBeVisible();
});

test("teclado: el cuadro atrapa el foco, Esc lo cierra y el foco vuelve al botón", async ({ page }) => {
  await abrir(page, "#/paginas/inicio");
  const b = page.locator("#z-inicio-final").getByRole("button", { name: "Cambiar foto" });
  await b.focus(); await page.keyboard.press("Enter");
  await expect(dlg(page)).toBeVisible();
  for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true); }
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(b).toBeFocused();
});
