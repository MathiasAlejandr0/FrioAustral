/* Capturas con la API simulada: node shots.js <carpeta de salida> */
const { chromium } = require("@playwright/test");
const { scenario, install } = require("./mock");
const out = process.argv[2] || "/workspace/fa-mi-cuenta/capturas";
require("fs").mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
  async function shot(kind, route, name, w, steps) {
    const ctx = await b.newContext({ viewport: sizes[w], locale: "es-CL", timezoneId: "America/Santiago", deviceScaleFactor: 1, isMobile: w === 390, hasTouch: w === 390 });
    const page = await ctx.newPage(); const s = scenario(kind); await install(page, s);
    const errs = []; page.on("console", (m) => m.type() === "error" && errs.push(m.text())); page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto("http://localhost:4173/mi-cuenta.html" + route); await page.waitForSelector(".pn-main, .pn-auth");
    await page.waitForTimeout(600);
    if (steps) await steps(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: false });
    if (errs.length) console.log(name, w, "ERRORES", errs);
    await ctx.close();
  }
  const only = process.argv[3];
  for (const w of [1440, 390]) {
    const jobs = [
      ["premium", "#/inicio", "inicio-premium"],
      ["aprendiz", "#/inicio", "inicio-aprendiz"],
      ["premium", "#/preguntas", "preguntas"],
      ["tecnico", "#/material", "material"],
      ["premium", "#/inicio", "preguntar-abierto", async (p) => { await p.click("text=Preguntar al equipo"); await p.waitForSelector("dialog[open] textarea"); }],
      ["aprendiz", "#/plan", "mi-plan"],
    ];
    for (const j of jobs) if (!only || j[2].includes(only)) await shot(j[0], j[1], j[2], w, j[3]);
  }
  await b.close();
})();
