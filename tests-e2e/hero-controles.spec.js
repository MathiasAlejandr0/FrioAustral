const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/* Controles del video del inicio: botones redondos, pequeños y solo con ícono (sonido y subtítulos).
   Capturas de cada estado en SHOTS_404 (por defecto, test-results/capturas-404). */
const shotsDir = process.env.SHOTS_404 || path.join(__dirname, "test-results", "capturas-404");
fs.mkdirSync(shotsDir, { recursive: true });

const SIZES = [
  ["1920", { width: 1920, height: 1080 }, false],
  ["1366", { width: 1366, height: 768 }, false],
  ["celular", { width: 390, height: 844 }, true],
];

async function abrir(browser, viewport, movil) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: movil ? 2 : 1, hasTouch: movil, isMobile: movil, locale: "es-CL" });
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, media: {} }) }));
  await page.goto("/index.html", { waitUntil: "load" });
  await page.locator(".fa-ctl .fa-cc").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".fa-ctl .fa-sound:not(.fa-cc):not(.fa-play)").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const hero = (page) => page.locator("section.hero");

for (const [name, viewport, movil] of SIZES) {
  test(`hero ${name}: botones de sonido y subtítulos redondos, solo ícono, con estados y sin blur`, async ({ browser }) => {
    const { ctx, page } = await abrir(browser, viewport, movil);
    const sound = page.locator(".fa-ctl .fa-sound:not(.fa-cc):not(.fa-play)");
    const cc = page.locator(".fa-ctl .fa-cc");

    for (const b of [sound, cc]) {
      const box = await b.boundingBox();
      expect(Math.abs(box.width - box.height), "es un círculo").toBeLessThanOrEqual(0.5);
      if (movil) expect(box.width, "área táctil").toBeGreaterThanOrEqual(44);
      else { expect(box.width).toBeGreaterThanOrEqual(40); expect(box.width).toBeLessThanOrEqual(44); }
      const css = await b.evaluate((e) => { const s = getComputedStyle(e); return { r: s.borderRadius, bf: s.backdropFilter, f: s.filter, bg: s.backgroundColor, text: e.innerText.trim(), svg: !!e.querySelector("svg") }; });
      expect(css.r).toMatch(/^(50%|\d+(\.\d+)?px)$/);
      expect(css.bf === "none" || css.bf === "").toBe(true);
      expect(css.f).toBe("none");
      expect(css.bg).toMatch(/^rgba?\(5, 7, 11/);
      expect(css.text, "sin texto visible").toBe("");
      expect(css.svg).toBe(true);
      expect(await b.getAttribute("title")).toBe(await b.getAttribute("aria-label"));
    }
    /* quedan agrupados y dentro de la pantalla */
    const g = await page.locator(".fa-ctl").boundingBox();
    expect(g.x).toBeGreaterThanOrEqual(0); expect(g.x + g.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    /* sonido: apagado -> encendido -> apagado */
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await expect(sound).toHaveAttribute("aria-label", "Activar sonido");
    expect(await sound.evaluate((e) => ({ x: getComputedStyle(e.querySelector(".x")).display, w: getComputedStyle(e.querySelector(".w1")).display }))).toEqual({ x: "inline", w: "none" });
    await hero(page).screenshot({ path: path.join(shotsDir, `botones-${name}-sonido-apagado.png`) });
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await expect(sound).toHaveAttribute("aria-label", "Silenciar");
    await expect(sound).toHaveAttribute("title", "Silenciar");
    expect(await sound.evaluate((e) => ({ x: getComputedStyle(e.querySelector(".x")).display, w: getComputedStyle(e.querySelector(".w1")).display }))).toEqual({ x: "none", w: "inline" });
    await hero(page).screenshot({ path: path.join(shotsDir, `botones-${name}-sonido-encendido.png`) });
    await sound.click();
    await expect(sound).toHaveAttribute("aria-label", "Activar sonido");
    await expect(sound).toHaveAttribute("title", "Activar sonido");

    /* subtítulos: visibles -> ocultos -> visibles */
    await expect(cc).toHaveAttribute("aria-pressed", "true");
    await expect(cc).toHaveAttribute("title", "Ocultar subtítulos");
    expect(await cc.evaluate((e) => getComputedStyle(e.querySelector(".x")).display)).toBe("none");
    await hero(page).screenshot({ path: path.join(shotsDir, `botones-${name}-subtitulos-on.png`) });
    await cc.click();
    await expect(cc).toHaveAttribute("aria-pressed", "false");
    await expect(cc).toHaveAttribute("aria-label", "Mostrar subtítulos");
    await expect(cc).toHaveAttribute("title", "Mostrar subtítulos");
    expect(await cc.evaluate((e) => getComputedStyle(e.querySelector(".x")).display)).toBe("inline");
    await expect(page.locator(".fa-cap")).toHaveClass(/off/);
    await hero(page).screenshot({ path: path.join(shotsDir, `botones-${name}-subtitulos-off.png`) });
    await cc.click();
    await expect(cc).toHaveAttribute("aria-label", "Ocultar subtítulos");
    await ctx.close();
  });
}

test("hero: foco visible con teclado y hover en los botones redondos", async ({ browser }) => {
  const { ctx, page } = await abrir(browser, { width: 1366, height: 768 }, false);
  const cc = page.locator(".fa-ctl .fa-cc");
  await cc.focus();
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  expect(await cc.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
  expect(await cc.evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth))).toBeGreaterThanOrEqual(2);
  await cc.hover();
  await page.waitForTimeout(300);
  expect(await cc.evaluate((e) => getComputedStyle(e).borderColor)).not.toBe("rgba(255, 255, 255, 0.28)");
  /* se activa con el teclado */
  await page.keyboard.press("Enter");
  await expect(cc).toHaveAttribute("aria-pressed", "false");
  await ctx.close();
});

test("el panel del equipo no depende de los botones del hero", async () => {
  const panel = fs.readdirSync(path.join(__dirname, "../assets")).filter((f) => /^fa-panel.*\.js$|^fa-admin\.js$|^fa-medios\.js$/.test(f));
  for (const f of panel) {
    const src = fs.readFileSync(path.join(__dirname, "../assets", f), "utf8");
    expect(src, f).not.toMatch(/fa-sound|fa-cc\b|fa-ctl|Activar sonido|Silenciar|Mostrar subtítulos|Ocultar subtítulos/);
  }
});
