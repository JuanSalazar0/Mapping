// Heavy Mapper — app principal.
// Gestiona el lienzo de edición, la interacción con superficies, el
// inspector, el bucle de animación y la salida de proyección.

import { Surface, TEXTURE_RES } from "./surface.js";
import { EFFECTS } from "./effects.js";
import { warp } from "./warp.js";

const stage = document.getElementById("stage");
const ctx = stage.getContext("2d");

/** @type {Surface[]} */
let surfaces = [];
let selected = null;
let playing = true;
let showGrid = false;
let projecting = false;

// Estado de arrastre: { type: 'corner'|'move', cornerIndex, lastX, lastY }
let drag = null;

// ---------- Reloj de animación (con pausa) ----------
// El tiempo de animación acumula sólo mientras `playing` es true.
let animTime = 0;
let lastFrame = performance.now();
function tickClock() {
  const t = performance.now();
  if (playing) animTime += (t - lastFrame) / 1000;
  lastFrame = t;
  return animTime;
}

// ---------- Tamaño del lienzo ----------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = stage.clientWidth, h = stage.clientHeight;
  stage.width = w * dpr;
  stage.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

function mousePos(e, el = stage) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ---------- Bucle de render ----------
function render() {
  const t = tickClock();
  const w = stage.clientWidth, h = stage.clientHeight;
  ctx.clearRect(0, 0, w, h);

  if (showGrid) drawGrid(ctx, w, h);

  for (const s of surfaces) {
    s.renderTexture(t);
    warp(ctx, s.tex, s.corners, TEXTURE_RES, s.opacity);
  }
  // Overlays de edición (no van a la proyección).
  for (const s of surfaces) drawOutline(ctx, s, s === selected);

  if (projecting) renderProjection();
  requestAnimationFrame(render);
}

function drawGrid(c, w, h) {
  c.strokeStyle = "rgba(255,255,255,0.05)";
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x < w; x += 40) { c.moveTo(x, 0); c.lineTo(x, h); }
  for (let y = 0; y < h; y += 40) { c.moveTo(0, y); c.lineTo(w, y); }
  c.stroke();
}

function drawOutline(c, s, isSel) {
  const cn = s.corners;
  c.strokeStyle = isSel ? "#00e5ff" : "rgba(255,255,255,0.35)";
  c.lineWidth = isSel ? 2 : 1;
  c.beginPath();
  c.moveTo(cn[0].x, cn[0].y);
  for (let i = 1; i < 4; i++) c.lineTo(cn[i].x, cn[i].y);
  c.closePath();
  c.stroke();

  if (isSel) {
    for (const p of cn) {
      c.fillStyle = "#00e5ff";
      c.beginPath(); c.arc(p.x, p.y, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#04121a";
      c.beginPath(); c.arc(p.x, p.y, 2.5, 0, Math.PI * 2); c.fill();
    }
    const ctr = s.center();
    c.fillStyle = "rgba(0,229,255,0.9)";
    c.font = "12px system-ui";
    c.textAlign = "center";
    c.fillText(s.name, ctr.x, ctr.y);
  }
}

// ---------- Proyección (segundo lienzo, sin overlays) ----------
const projEl = document.getElementById("projection");
const projCanvas = document.getElementById("projection-canvas");
const pctx = projCanvas.getContext("2d");

function renderProjection() {
  const w = projCanvas.clientWidth, h = projCanvas.clientHeight;
  if (projCanvas.width !== w || projCanvas.height !== h) {
    projCanvas.width = w; projCanvas.height = h;
  }
  const sx = w / stage.clientWidth;
  const sy = h / stage.clientHeight;
  pctx.clearRect(0, 0, w, h);
  pctx.fillStyle = "#000";
  pctx.fillRect(0, 0, w, h);
  for (const s of surfaces) {
    const scaled = s.corners.map((c) => ({ x: c.x * sx, y: c.y * sy }));
    warp(pctx, s.tex, scaled, TEXTURE_RES, s.opacity);
  }
}

// ---------- Interacción con el ratón ----------
stage.addEventListener("mousedown", (e) => {
  const { x, y } = mousePos(e);
  if (selected) {
    const ci = selected.hitCorner(x, y);
    if (ci >= 0) { drag = { type: "corner", cornerIndex: ci }; return; }
  }
  for (let i = surfaces.length - 1; i >= 0; i--) {
    if (surfaces[i].contains(x, y)) {
      select(surfaces[i]);
      drag = { type: "move", lastX: x, lastY: y };
      return;
    }
  }
  select(null);
});

window.addEventListener("mousemove", (e) => {
  if (!drag) return;
  const { x, y } = mousePos(e);
  if (drag.type === "corner") {
    selected.corners[drag.cornerIndex].x = x;
    selected.corners[drag.cornerIndex].y = y;
  } else {
    selected.move(x - drag.lastX, y - drag.lastY);
    drag.lastX = x; drag.lastY = y;
  }
});
window.addEventListener("mouseup", () => { drag = null; });

// ---------- Inspector ----------
const inspector = {
  none: document.getElementById("no-selection"),
  props: document.getElementById("props"),
  name: document.getElementById("prop-name"),
  effect: document.getElementById("prop-effect"),
  color: document.getElementById("prop-color"),
  color2: document.getElementById("prop-color2"),
  speed: document.getElementById("prop-speed"),
  scale: document.getElementById("prop-scale"),
  opacity: document.getElementById("prop-opacity"),
  valSpeed: document.getElementById("val-speed"),
  valScale: document.getElementById("val-scale"),
  valOpacity: document.getElementById("val-opacity"),
};

for (const [key, def] of Object.entries(EFFECTS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = def.label;
  inspector.effect.appendChild(opt);
}

function select(s) {
  selected = s;
  if (!s) {
    inspector.none.hidden = false;
    inspector.props.hidden = true;
    return;
  }
  inspector.none.hidden = true;
  inspector.props.hidden = false;
  inspector.name.value = s.name;
  inspector.effect.value = s.effect;
  inspector.color.value = s.color;
  inspector.color2.value = s.color2;
  inspector.speed.value = s.speed;
  inspector.scale.value = s.scale;
  inspector.opacity.value = s.opacity;
  updateLabels();
}

function updateLabels() {
  inspector.valSpeed.textContent = Number(inspector.speed.value).toFixed(1) + "×";
  inspector.valScale.textContent = Number(inspector.scale.value).toFixed(1) + "×";
  inspector.valOpacity.textContent = Math.round(inspector.opacity.value * 100) + "%";
}

inspector.name.addEventListener("input", () => { if (selected) selected.name = inspector.name.value; });
inspector.effect.addEventListener("change", () => { if (selected) selected.effect = inspector.effect.value; });
inspector.color.addEventListener("input", () => { if (selected) selected.color = inspector.color.value; });
inspector.color2.addEventListener("input", () => { if (selected) selected.color2 = inspector.color2.value; });
inspector.speed.addEventListener("input", () => { if (selected) selected.speed = +inspector.speed.value; updateLabels(); });
inspector.scale.addEventListener("input", () => { if (selected) selected.scale = +inspector.scale.value; updateLabels(); });
inspector.opacity.addEventListener("input", () => { if (selected) selected.opacity = +inspector.opacity.value; updateLabels(); });

document.getElementById("prop-duplicate").addEventListener("click", () => {
  if (!selected) return;
  const copy = Surface.fromJSON(selected.toJSON());
  copy.name = selected.name + " copia";
  copy.move(30, 30);
  surfaces.push(copy);
  select(copy);
});
document.getElementById("prop-reset").addEventListener("click", () => {
  if (selected) selected.resetCorners();
});

// ---------- Barra de herramientas ----------
function addSurface() {
  const s = new Surface(stage.clientWidth / 2, stage.clientHeight / 2);
  surfaces.push(s);
  select(s);
  hideHint();
}
function deleteSelected() {
  if (!selected) return;
  surfaces = surfaces.filter((s) => s !== selected);
  select(null);
}

document.getElementById("btn-add").addEventListener("click", addSurface);
document.getElementById("btn-delete").addEventListener("click", deleteSelected);

const btnPlay = document.getElementById("btn-play");
btnPlay.addEventListener("click", () => {
  playing = !playing;
  btnPlay.textContent = playing ? "⏸ Pausa" : "▶ Play";
});

const btnGrid = document.getElementById("btn-grid");
btnGrid.addEventListener("click", () => {
  showGrid = !showGrid;
  btnGrid.classList.toggle("active", showGrid);
});

document.getElementById("btn-project").addEventListener("click", enterProjection);

// ---------- Guardar / cargar (localStorage) ----------
const STORE_KEY = "heavy-mapper-project";
document.getElementById("btn-save").addEventListener("click", () => {
  localStorage.setItem(STORE_KEY, JSON.stringify(surfaces.map((s) => s.toJSON())));
  flash("Proyecto guardado ✓");
});
document.getElementById("btn-load").addEventListener("click", () => {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) { flash("No hay proyecto guardado"); return; }
  surfaces = JSON.parse(raw).map(Surface.fromJSON);
  select(null);
  hideHint();
  flash("Proyecto cargado ✓");
});

function flash(msg) {
  const hint = document.getElementById("hint");
  hint.hidden = false;
  hint.innerHTML = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { if (surfaces.length) hint.hidden = true; }, 1500);
}
function hideHint() {
  const hint = document.getElementById("hint");
  if (surfaces.length) hint.hidden = true;
}

// ---------- Proyección fullscreen ----------
function enterProjection() {
  projEl.hidden = false;
  projecting = true;
  if (projEl.requestFullscreen) projEl.requestFullscreen().catch(() => {});
}
function exitProjection() {
  projecting = false;
  projEl.hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && projecting) exitProjection();
});

// ---------- Teclado ----------
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  switch (e.key.toLowerCase()) {
    case "a": addSurface(); break;
    case "delete": case "backspace": deleteSelected(); break;
    case "g": btnGrid.click(); break;
    case "f": enterProjection(); break;
    case " ": e.preventDefault(); btnPlay.click(); break;
    case "escape": if (projecting) exitProjection(); break;
  }
});

// ---------- Arranque ----------
resize();
render();
