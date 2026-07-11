// Deformación de una textura cuadrada hacia un cuadrilátero arbitrario.
//
// Canvas 2D no soporta transformaciones de perspectiva directas, así que
// subdividimos el cuadrado origen en una rejilla de NxN celdas, calculamos
// dónde cae cada vértice dentro del cuadrilátero destino (interpolación
// bilineal de las 4 esquinas) y dibujamos cada celda como dos triángulos
// con transformación afín. Con N suficiente el resultado se aproxima muy
// bien a una proyección real.

const N = 10; // subdivisiones por lado; más = más preciso, más costoso

// Interpola bilinealmente dentro del quad [p0,p1,p2,p3] (orden horario:
// arriba-izq, arriba-der, abajo-der, abajo-izq) con u,v en [0,1].
function bilerp(corners, u, v) {
  const [p0, p1, p2, p3] = corners;
  const top = { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u };
  const bot = { x: p3.x + (p2.x - p3.x) * u, y: p3.y + (p2.y - p3.y) * u };
  return {
    x: top.x + (bot.x - top.x) * v,
    y: top.y + (bot.y - top.y) * v,
  };
}

// Dibuja `tri` de la textura (coordenadas fuente s0,s1,s2 en px) en el
// destino (d0,d1,d2 en px) resolviendo la transformación afín.
function drawTriangle(ctx, tex, s0, s1, s2, d0, d1, d2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  // Resolver matriz afín tal que mapee source -> dest.
  const denom =
    s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y;
  if (denom === 0) { ctx.restore(); return; }

  const m11 = -(s0.y * (d2.x - d1.x) - s1.y * d2.x + s2.y * d1.x + (s1.y - s2.y) * d0.x) / denom;
  const m12 =  (s1.y * d2.y + s0.y * (d1.y - d2.y) - s2.y * d1.y + (s2.y - s1.y) * d0.y) / denom;
  const m21 =  (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / denom;
  const m22 = -(s1.x * d2.y + s0.x * (d1.y - d2.y) - s2.x * d1.y + (s2.x - s1.x) * d0.y) / denom;
  const dx =
    (s0.x * (s2.y * d1.x - s1.y * d2.x) +
      s0.y * (s1.x * d2.x - s2.x * d1.x) +
      (s2.x * s1.y - s1.x * s2.y) * d0.x) / denom;
  const dy =
    (s0.x * (s2.y * d1.y - s1.y * d2.y) +
      s0.y * (s1.x * d2.y - s2.x * d1.y) +
      (s2.x * s1.y - s1.x * s2.y) * d0.y) / denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(tex, 0, 0);
  ctx.restore();
}

// Dibuja la textura `tex` (cuadrada, res x res) deformada hacia `corners`
// (4 puntos en px del lienzo destino) con opacidad dada.
export function warp(ctx, tex, corners, res, opacity = 1) {
  ctx.globalAlpha = opacity;
  const step = res / N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const u0 = i / N, u1 = (i + 1) / N;
      const v0 = j / N, v1 = (j + 1) / N;

      // Fuente (px dentro de la textura).
      const sA = { x: u0 * res, y: v0 * res };
      const sB = { x: u1 * res, y: v0 * res };
      const sC = { x: u1 * res, y: v1 * res };
      const sD = { x: u0 * res, y: v1 * res };

      // Destino (px dentro del quad).
      const dA = bilerp(corners, u0, v0);
      const dB = bilerp(corners, u1, v0);
      const dC = bilerp(corners, u1, v1);
      const dD = bilerp(corners, u0, v1);

      // Ligero solape para evitar costuras entre celdas.
      drawTriangle(ctx, tex, sA, sB, sC, dA, dB, dC);
      drawTriangle(ctx, tex, sA, sC, sD, dA, dC, dD);
    }
  }
  ctx.globalAlpha = 1;
}
