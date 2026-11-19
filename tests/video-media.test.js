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

function mvhdSeconds(file) {
  const buf = fs.readFileSync(file).subarray(0, 400000);
  const i = buf.indexOf("mvhd");
  assert.ok(i > 0, `${path.basename(file)} sin mvhd`);
  const v = buf[i + 4];
  const ts = v === 1 ? buf.readUInt32BE(i + 24) : buf.readUInt32BE(i + 16);
  const dur = v === 1 ? Number(buf.readBigUInt64BE(i + 28)) : buf.readUInt32BE(i + 20);
  return dur / ts;
}

test("las variantes 720 y 1080 de cada video duran lo mismo (los .vtt siguen calzando) y ninguna pasa de 12 MB", () => {
  for (const n of names) {
    const d1080 = mvhdSeconds(path.join(root, "media/video", `${n}-1080.mp4`));
    const d720 = mvhdSeconds(path.join(root, "media/video", `${n}-720.mp4`));
    assert.ok(Math.abs(d1080 - d720) < 0.1, `${n}: 720 y 1080 difieren (${d720} vs ${d1080})`);
    const vtt = fs.readFileSync(path.join(root, "media/video", `${n}.es.vtt`), "utf8");
    const ends = [...vtt.matchAll(/-->\s*(\d+):(\d+):(\d+\.\d+)/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3]);
    assert.ok(Math.max(...ends) <= d1080 + 0.1, `${n}: el subtítulo termina después del video`);
    for (const q of ["720", "1080"]) for (const ext of ["mp4", "webm"]) {
      assert.ok(fs.statSync(path.join(root, "media/video", `${n}-${q}.${ext}`)).size < 12 * 1024 * 1024, `${n}-${q}.${ext} pesa más de 12 MB`);
    }
  }
});
