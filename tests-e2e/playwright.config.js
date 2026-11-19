const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: ".", testMatch: "*.spec.js", timeout: 60000, retries: 0, workers: 2, reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4599", locale: "es-CL", timezoneId: "America/Santiago", trace: "off" },
  webServer: { command: "node lib/server.js", url: "http://127.0.0.1:4599/equipo.html", reuseExistingServer: false, timeout: 20000 },
});
