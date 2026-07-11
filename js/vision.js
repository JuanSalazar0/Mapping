// Visión por cámara — sin dependencias.
//
// Captura la webcam, detecta un "blob" de color (seguimiento por umbral en
// RGB) y devuelve su posición en coordenadas del escenario. La cámara casi
// nunca está alineada con la superficie física, así que incluimos una
// calibración por homografía: marcas 4 puntos en la imagen de la cámara que
// corresponden a las 4 esquinas del escenario y resolvemos la matriz 3x3 que
// mapea uno en otro. Es exactamente el mismo tipo de matemática que hace
// `warp.js`, pero al revés (imagen -> escena en vez de textura -> pantalla).

// Resolución del lienzo de análisis. Bajarla acelera la detección; subirla la
// hace más precisa. 160x120 es un buen compromiso para tiempo real.
const ANALYSIS_W = 160;
const ANALYSIS_H = 120;

export class Vision {
  constructor() {
    this.video = document.createElement("video");
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;

    // Lienzo pequeño donde volcamos el frame para leer sus píxeles.
    this.analysis = document.createElement("canvas");
    this.analysis.width = ANALYSIS_W;
    this.analysis.height = ANALYSIS_H;
    this.actx = this.analysis.getContext("2d", { willReadFrequently: true });

    this.stream = null;
    this.active = false;
    this.mirror = true; // las webcams suelen venir en espejo

    // Color objetivo y umbral del seguimiento.
    this.target = { r: 0, g: 229, b: 255 }; // cian por defecto
    this.tolerance = 60; // distancia máx. en RGB (0..~441)
    this.minPixels = 12;  // píxeles mínimos para dar por válida una detección

    // Homografía cam-normalizado(0..1) -> escenario(px). null = mapeo lineal.
    this.H = null;

    this.lastDetection = null; // { x, y, nx, ny, size, count } o null
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    this.active = true;
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.active = false;
    this.lastDetection = null;
  }

  // Vuelca el frame actual (aplicando espejo si toca) al lienzo de análisis.
  _grabFrame() {
    const w = ANALYSIS_W, h = ANALYSIS_H;
    this.actx.save();
    if (this.mirror) { this.actx.translate(w, 0); this.actx.scale(-1, 1); }
    this.actx.drawImage(this.video, 0, 0, w, h);
    this.actx.restore();
  }

  // Devuelve el color RGB del píxel en coordenadas normalizadas (0..1).
  pickColorAt(nx, ny) {
    if (!this.active || this.video.readyState < 2) return null;
    this._grabFrame();
    const x = Math.max(0, Math.min(ANALYSIS_W - 1, Math.round(nx * ANALYSIS_W)));
    const y = Math.max(0, Math.min(ANALYSIS_H - 1, Math.round(ny * ANALYSIS_H)));
    const d = this.actx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  // Calibración: 4 puntos en cam-normalizado (0..1) que corresponden a las 4
  // esquinas del escenario `dstQuad` (px, orden TL, TR, BR, BL).
  setCalibration(srcQuad, dstQuad) {
    this.H = computeHomography(srcQuad, dstQuad);
  }

  clearCalibration() {
    this.H = null;
  }

  // Analiza un frame y actualiza la detección. Devuelve el punto detectado en
  // coordenadas del escenario, o null. `stageW/H` sirven para el mapeo lineal
  // por defecto cuando no hay homografía de calibración.
  detect(stageW, stageH) {
    if (!this.active || this.video.readyState < 2) return null;
    this._grabFrame();
    const w = ANALYSIS_W, h = ANALYSIS_H;
    const data = this.actx.getImageData(0, 0, w, h).data;

    const { r: tr, g: tg, b: tb } = this.target;
    const tol2 = this.tolerance * this.tolerance;

    // Centroide de todos los píxeles que "casan" con el color objetivo.
    let sumX = 0, sumY = 0, count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb;
        if (dr * dr + dg * dg + db * db <= tol2) { sumX += x; sumY += y; count++; }
      }
    }

    if (count < this.minPixels) { this.lastDetection = null; return null; }

    const nx = sumX / count / w;
    const ny = sumY / count / h;
    let px, py;
    if (this.H) {
      const p = applyHomography(this.H, nx, ny);
      px = p.x; py = p.y;
    } else {
      px = nx * stageW; py = ny * stageH;
    }
    // Tamaño relativo del blob (0..1), útil para dibujar el marcador.
    const size = Math.sqrt(count / (w * h));
    this.lastDetection = { x: px, y: py, nx, ny, size, count };
    return this.lastDetection;
  }
}

// ---------- Homografía (calibración cámara -> escenario) ----------

// Resuelve la matriz 3x3 H tal que H·[x,y,1]ᵀ ~ [u,v,1]ᵀ para los 4 pares
// src->dst. Montamos el sistema lineal 8x8 (DLT) fijando el elemento h33=1.
function computeHomography(src, dst) {
  const A = [], b = [];
  for (let k = 0; k < 4; k++) {
    const { x: X, y: Y } = src[k];
    const { x: u, y: v } = dst[k];
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

// Eliminación gaussiana con pivoteo parcial para A·x = b (A n×n).
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    if (Math.abs(d) < 1e-9) continue; // sistema degenerado; seguimos igual
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}
