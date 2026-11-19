const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* Ejecuta assets/media.js con un DOM mínimo para probar el hero sin navegador.
   Reproduce el caso del PC de escritorio de Mathias: Windows con "Efectos de animación" apagado
   => prefers-reduced-motion: reduce. Antes el hero quedaba solo con el poster y sin botón. */
const code = fs.readFileSync(path.join(__dirname, "..", "assets/media.js"), "utf8");

function el(tag) {
  const e = {
    tagName: tag, hidden: false, className: "", innerHTML: "", style: {}, dataset: {}, children: [], attrs: {}, listeners: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); }, contains(c) { return this.s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
    dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach((f) => f(ev)); },
    querySelector(sel) { if (sel === "span") return { textContent: "" }; return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0 }; },
    closest() { return null; },
  };
  return e;
}

function setup({ reduce, playImpl }) {
  const hero = el("section"), ph = el("div"), btn = el("button"), poster = { currentSrc: "poster.webp" };
  btn.querySelector = () => ({ textContent: "" });
  let sources = [];
  const v = el("video");
  Object.assign(v, {
    dataset: { media: "v1-hero-intro" }, paused: true, currentTime: 0, muted: false, autoplay: false, textTracks: [], loads: 0, plays: 0,
    closest: (s) => (s === ".hero" ? hero : ph),
    querySelector: (s) => (s === "track" ? null : null),
    querySelectorAll: (s) => (s === "source" ? sources.map((src) => ({ src, remove() { sources = sources.filter((x) => x !== src); }, addEventListener() {} })) : []),
    insertAdjacentHTML: (_, html) => { sources = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]); },
    load() { this.loads++; },
    play() { this.plays++; return playImpl(this); },
  });
  const document = {
    readyState: "complete", hidden: false,
    addEventListener() {},
    querySelector(sel) {
      if (sel.startsWith(".hero video.hero-vid")) return v;
      if (sel === ".hero .fa-sound") return btn;
      if (sel === ".fa-hero-poster img") return poster;
      return null;
    },
    querySelectorAll: () => [],
    createElement: (t) => el(t),
  };
  const ctx = {
    window: {}, document, navigator: {}, console,
    matchMedia: (q) => ({ matches: q.includes("reduced-motion") ? reduce : false }),
    addEventListener() {}, setTimeout, setInterval, clearInterval,
    Event: class { constructor(type) { this.type = type; } },
    Promise,
  };
  ctx.window = ctx;
  vm.runInNewContext(code, ctx);
  const play = () => hero.children[0].children.find((c) => c.className.includes("fa-play"));
  return { v, hero, play, sources: () => sources };
}

test("reduced-motion (Windows sin animaciones): el hero NO queda solo con el poster; aparece 'Reproducir video' y al hacer clic reproduce", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const s = setup({ reduce: true, playImpl: (v) => { v.paused = false; return Promise.resolve(); } });
    await Promise.resolve(); mock.timers.tick(700); await Promise.resolve();
    assert.equal(s.v.autoplay, false, "con reduced-motion no se hace autoplay");
    assert.equal(s.v.plays, 0, "no se llama play() sin acción del usuario");
    assert.ok(s.play(), "se crea el botón de reproducir");
    assert.equal(s.play().hidden, false, "el botón 'Reproducir video' está visible");
    assert.ok(s.hero.classList.contains("fa-blocked"));
    s.play().listeners.click[0]();
    assert.equal(s.v.plays, 1, "el clic reproduce el video");
  } finally { mock.timers.reset(); }
});

test("si el video no avanza (~3 s) aunque play() no responda, aparece el botón y se prueba la otra fuente", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const s = setup({ reduce: false, playImpl: (v) => { v.paused = false; return new Promise(() => {}); } }); // promesa que nunca resuelve, currentTime fijo
    await Promise.resolve(); mock.timers.tick(700); await Promise.resolve();
    assert.equal(s.v.autoplay, true);
    assert.equal(s.play().hidden, true, "al inicio no se muestra el botón");
    const first = s.sources()[0];
    mock.timers.tick(3600);
    assert.equal(s.play().hidden, false, "el botón aparece aunque el video figure como no pausado");
    assert.notEqual(s.sources()[0], first, "se cambia a la siguiente fuente");
    assert.match(s.sources()[0], /-720\.mp4$/);
  } finally { mock.timers.reset(); }
});

test("si el video avanza normal, el botón de reproducir sigue oculto", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const s = setup({ reduce: false, playImpl: (v) => { v.paused = false; return Promise.resolve(); } });
    await Promise.resolve(); mock.timers.tick(700); await Promise.resolve();
    s.v.dispatchEvent({ type: "playing" });
    for (let i = 0; i < 6; i++) { s.v.currentTime += 1; mock.timers.tick(1000); }
    assert.equal(s.play().hidden, true);
  } finally { mock.timers.reset(); }
});

test("el CSS ya no oculta el video ni los controles del hero con reduced-motion", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "assets/media.css"), "utf8");
  assert.doesNotMatch(css, /prefers-reduced-motion:\s*reduce\)\s*\{[^}]*hero-vid\{display:none/);
  assert.doesNotMatch(css, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.fa-sound\{display:none/);
});
