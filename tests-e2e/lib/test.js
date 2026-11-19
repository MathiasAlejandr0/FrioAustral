/* test de Playwright que además falla si hay errores en la consola o excepciones sin capturar (criterio 19). */
const base = require("@playwright/test");
const test = base.test.extend({
  page: async ({ page }, use) => {
    const errs = [];
    page.on("console", (m) => { /* los errores HTTP a propósito (4xx/5xx simulados) los registra el navegador solo; no cuentan */
    if (m.type() === "error" && !/Failed to load resource: the server responded with a status of [45]\d\d/.test(m.text())) errs.push("console.error: " + m.text()); });
    page.on("pageerror", (e) => errs.push("excepción: " + e.message));
    await use(page);
    base.expect(errs, "errores en la consola").toEqual([]);
  },
});
module.exports = { test, expect: base.expect };
