const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const HOTMART = "https://pay.hotmart.com/M101158236T?hotfeature=51&_hi=eyJjaWQiOiIxNzg1MzgyMDM2NDM2Mzg2MzI4NTI3NDY1NzU1NjUwIiwiYmlkIjoiMTc4NTM4MjAzNjQzNjM4NjMyODUyNzQ2NTc1NTY1MCIsInNpZCI6Ijg3Mjg1YTEyOGI4MDRkNDRiNTQ0MmYzYjMwZjRkOGM1In0=.1794072662815";

test("fa-config.js deja la Academia apagada y usa la URL exacta de Hotmart", () => {
  const src = fs.readFileSync(path.join(root, "assets/fa-config.js"), "utf8");
  assert.match(src, /ACADEMIA_ENABLED:\s*false/);
  assert.ok(src.includes(HOTMART));
});

test("el código de la Academia se mantiene en el proyecto", () => {
  for (const file of ["academia.html", "ingresar.html", "mi-academia.html", "leccion.html", "certificado.html", "assets/academia.js", "assets/academia-data.js", "assets/academia-nav.js"]) {
    assert.ok(fs.existsSync(path.join(root, file)), `falta ${file}`);
  }
});

test("las páginas públicas cargan fa-config y fa-gate", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /assets\/fa-config\.js/);
  assert.match(html, /assets\/fa-gate\.js/);
  assert.match(html, /assets\/fa-flow\.js/);
});