const { test } = require("@playwright/test");
const { instalar } = require("./lib/mock");
test("shot", async ({ page }) => {
  const [w, h] = (process.env.VP || "1440x900").split("x").map(Number);
  await page.setViewportSize({ width: w, height: h });
  const errs = []; page.on("console", (m) => m.type() === "error" && errs.push(m.text())); page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await instalar(page);
  await page.goto("/equipo.html" + (process.env.R || "#/paginas/inicio")); await page.waitForTimeout(3500);
  if (process.env.JS) console.log("JS=>", JSON.stringify(await page.evaluate(process.env.JS)));
  await page.waitForTimeout(500);
  await page.screenshot({ path: process.env.OUT || "/workspace/fa-panel-equipo/_s.png" });
  console.log(errs.join("\n"));
});
