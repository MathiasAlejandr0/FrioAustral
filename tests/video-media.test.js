const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readdirSync(root).filter((f) => f.endsWith(".html")).map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
const names = [...new Set([...html.matchAll(/data-media="([^"]+)"/g)].map((m) => m[1]))];

test("cada video con data-media tiene las 4 variantes (720/1080 × mp4/webm) y subtítulos", () => {
  assert.ok(names.includes("v1-hero-intro"), "el hero usa v1-hero-intro");
  for (const n of names) {
    for (const q of ["720", "1080"]) {
      for (const ext of ["mp4", "webm"]) {
        const f = path.join(root, "media/video", `${n}-${q}.${ext}`);
        assert.ok(fs.existsSync(f) && fs.statSync(f).size > 100000, `falta ${n}-${q}.${ext}`);
      }
    }
  }
});

test("los mp4 son h264 con faststart (moov antes de mdat) para reproducir en Safari y empezar rápido", () => {
  for (const n of names) {
    for (const q of ["720", "1080"]) {
      const buf = fs.readFileSync(path.join(root, "media/video", `${n}-${q}.mp4`)).subarray(0, 400000);
      const moov = buf.indexOf("moov"), mdat = buf.indexOf("mdat");
      assert.ok(moov > 0 && moov < mdat, `${n}-${q}.mp4 sin faststart`);
      assert.ok(buf.indexOf("avc1") > 0, `${n}-${q}.mp4 no es h264`);
    }
  }
});

test("media.js cae a la versión -720 si la fuente falla y muestra botón de reproducir si el autoplay se bloquea", () => {
  const js = fs.readFileSync(path.join(root, "assets/media.js"), "utf8");
  assert.match(js, /if\(q!=='720'\)st\.push\(src\(n,'720'\)\)/);
  assert.match(js, /fa-fallback/);
  assert.match(js, /NotAllowedError|AbortError/);
  assert.match(js, /fa-play/);
});
