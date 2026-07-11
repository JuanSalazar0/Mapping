// Biblioteca de efectos.
//
// Cada efecto es una función que dibuja dentro del rectángulo unitario
// (0,0) → (1,1). El motor de mapping se encarga de deformar (warp) ese
// dibujo hacia las 4 esquinas reales de la superficie, así que aquí sólo
// hay que pensar en coordenadas normalizadas.
//
// Parámetros que recibe cada efecto:
//   ctx  : contexto 2D (ya recortado al cuadrado unitario, escalado a `res`)
//   res  : resolución en px del lienzo interno del efecto
//   t    : tiempo en segundos (afectado por la velocidad de la superficie)
//   p    : propiedades de la superficie { color, color2, scale, ... }

function clear(ctx, res) {
  ctx.clearRect(0, 0, res, res);
}

export const EFFECTS = {
  solid: {
    label: "Color sólido",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      ctx.fillStyle = p.color;
      ctx.fillRect(0, 0, res, res);
    },
  },

  gradient: {
    label: "Degradado animado",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      const shift = (Math.sin(t) * 0.5 + 0.5) * res;
      const g = ctx.createLinearGradient(shift, 0, res - shift, res);
      g.addColorStop(0, p.color);
      g.addColorStop(1, p.color2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, res, res);
    },
  },

  stripes: {
    label: "Franjas en movimiento",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      const bands = Math.round(8 * p.scale);
      const w = res / bands;
      const offset = ((t * 60) % (w * 2));
      for (let i = -1; i < bands + 1; i++) {
        ctx.fillStyle = (i % 2 === 0) ? p.color : p.color2;
        ctx.fillRect(i * w + offset - w, 0, w, res);
      }
    },
  },

  checker: {
    label: "Damero",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      const n = Math.max(2, Math.round(6 * p.scale));
      const s = res / n;
      const flip = Math.floor(t * 2) % 2;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = (x + y + flip) % 2 === 0;
          ctx.fillStyle = on ? p.color : p.color2;
          ctx.fillRect(x * s, y * s, s, s);
        }
      }
    },
  },

  rings: {
    label: "Ondas concéntricas",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      ctx.fillStyle = p.color2;
      ctx.fillRect(0, 0, res, res);
      const cx = res / 2, cy = res / 2;
      const max = res * 0.75;
      const step = res / (6 * p.scale);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = step * 0.35;
      for (let r = (t * 40) % step; r < max; r += step) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },

  grid: {
    label: "Rejilla neón",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      const n = Math.max(2, Math.round(6 * p.scale));
      const s = res / n;
      const pulse = Math.sin(t * 3) * 0.5 + 0.5;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1 + pulse * 3;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 + pulse * 12;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        ctx.moveTo(i * s, 0); ctx.lineTo(i * s, res);
        ctx.moveTo(0, i * s); ctx.lineTo(res, i * s);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
  },

  scan: {
    label: "Barrido láser",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      const y = (Math.sin(t * 1.5) * 0.5 + 0.5) * res;
      const g = ctx.createLinearGradient(0, y - res * 0.25, 0, y + res * 0.25);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, p.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, res, res);
    },
  },

  plasma: {
    label: "Plasma",
    draw(ctx, res, t, p) {
      // Plasma clásico a baja resolución para que sea barato de calcular.
      const N = 40;
      const cell = res / N;
      const c1 = hexToRgb(p.color);
      const c2 = hexToRgb(p.color2);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v =
            Math.sin(x * 0.3 + t) +
            Math.sin(y * 0.3 - t) +
            Math.sin((x + y) * 0.2 + t * 1.3);
          const m = (v + 3) / 6; // 0..1
          ctx.fillStyle = mixRgb(c1, c2, m);
          ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
        }
      }
    },
  },

  starfield: {
    label: "Campo de estrellas",
    draw(ctx, res, t, p) {
      clear(ctx, res);
      ctx.fillStyle = p.color2;
      ctx.fillRect(0, 0, res, res);
      ctx.fillStyle = p.color;
      const stars = 60;
      for (let i = 0; i < stars; i++) {
        // Posición pseudoaleatoria estable por índice.
        const sx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const sy = (Math.sin(i * 78.233) * 12543.123) % 1;
        const x = ((Math.abs(sx) + t * 0.05 * (0.5 + Math.abs(sx))) % 1) * res;
        const y = Math.abs(sy) * res;
        const r = 0.5 + Math.abs(sx) * 2;
        ctx.globalAlpha = 0.4 + Math.abs(Math.sin(t * 2 + i)) * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
};

// --- utilidades de color ---
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mixRgb(a, b, t) {
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

export function effectKeys() {
  return Object.keys(EFFECTS);
}
