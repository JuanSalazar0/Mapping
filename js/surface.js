// Modelo de una superficie de mapping.
//
// Una superficie es un cuadrilátero (4 esquinas movibles) con un efecto
// visual asignado y sus propiedades. Cada superficie mantiene su propia
// textura interna (offscreen canvas) donde se renderiza el efecto antes de
// deformarlo hacia sus esquinas.

import { EFFECTS, effectKeys } from "./effects.js";

let _id = 0;
export const TEXTURE_RES = 256;

export class Surface {
  constructor(cx, cy, size = 180) {
    this.id = ++_id;
    this.name = "Superficie " + this.id;
    this.effect = effectKeys()[0];
    this.color = "#00e5ff";
    this.color2 = "#ff2d78";
    this.speed = 1;
    this.scale = 1;
    this.opacity = 1;

    const h = size / 2;
    // Esquinas: arriba-izq, arriba-der, abajo-der, abajo-izq (horario).
    this.corners = [
      { x: cx - h, y: cy - h },
      { x: cx + h, y: cy - h },
      { x: cx + h, y: cy + h },
      { x: cx - h, y: cy + h },
    ];

    // Textura offscreen propia.
    this.tex = document.createElement("canvas");
    this.tex.width = this.tex.height = TEXTURE_RES;
    this.tctx = this.tex.getContext("2d");
  }

  center() {
    const c = this.corners;
    return {
      x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4,
      y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4,
    };
  }

  // Renderiza el efecto en la textura interna para el tiempo t (segundos).
  renderTexture(t) {
    const effect = EFFECTS[this.effect] || EFFECTS.solid;
    effect.draw(this.tctx, TEXTURE_RES, t * this.speed, this);
  }

  // Devuelve el índice de la esquina cercana a (x,y), o -1.
  hitCorner(x, y, r = 12) {
    for (let i = 0; i < 4; i++) {
      const c = this.corners[i];
      if (Math.hypot(c.x - x, c.y - y) <= r) return i;
    }
    return -1;
  }

  // ¿Está el punto (x,y) dentro del cuadrilátero?
  contains(x, y) {
    let inside = false;
    const c = this.corners;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const xi = c[i].x, yi = c[i].y, xj = c[j].x, yj = c[j].y;
      const hit =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }

  move(dx, dy) {
    for (const c of this.corners) { c.x += dx; c.y += dy; }
  }

  resetCorners() {
    const ctr = this.center();
    const h = 90;
    this.corners = [
      { x: ctr.x - h, y: ctr.y - h },
      { x: ctr.x + h, y: ctr.y - h },
      { x: ctr.x + h, y: ctr.y + h },
      { x: ctr.x - h, y: ctr.y + h },
    ];
  }

  toJSON() {
    return {
      name: this.name,
      effect: this.effect,
      color: this.color,
      color2: this.color2,
      speed: this.speed,
      scale: this.scale,
      opacity: this.opacity,
      corners: this.corners.map((c) => ({ x: c.x, y: c.y })),
    };
  }

  static fromJSON(o) {
    const s = new Surface(0, 0);
    s.name = o.name;
    s.effect = o.effect;
    s.color = o.color;
    s.color2 = o.color2;
    s.speed = o.speed;
    s.scale = o.scale;
    s.opacity = o.opacity ?? 1;
    s.corners = o.corners.map((c) => ({ x: c.x, y: c.y }));
    return s;
  }
}
