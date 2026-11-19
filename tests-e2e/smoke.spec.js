const { test, expect } = require("@playwright/test");
const { instalar } = require("./lib/mock");
test("el panel abre y muestra el resumen", async ({ page }) => {
  const errs = []; page.on("console", (m) => m.type() === "error" && errs.push(m.text())); page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  const S = await instalar(page);
  await page.goto("/equipo.html");
  await expect(page.locator("h1")).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: "/workspace/fa-panel-equipo/_dbg_resumen.png", fullPage: true });
  console.log(errs.join("\n"));
  console.log(S.calls.map((c) => c.action).join(","));
});
