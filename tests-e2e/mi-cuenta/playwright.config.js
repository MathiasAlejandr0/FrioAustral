const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 60000,
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", locale: "es-CL", timezoneId: "America/Santiago", trace: "off" },
  webServer: { command: "node serve.js", url: "http://localhost:4173/mi-cuenta.html", reuseExistingServer: true, timeout: 20000 },
});
