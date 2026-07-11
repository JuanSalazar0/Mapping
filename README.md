# Heavy Mapper

Un clon educativo y de código abierto de un software de **video mapping**
(projection mapping) al estilo de HeavyM. Está hecho con HTML + Canvas 2D
puro, **sin dependencias**: se abre en cualquier navegador moderno.

El objetivo no es copiar el producto comercial, sino mostrar cómo funciona
por dentro el video mapping para que puedas entenderlo y hacer tus propias
modificaciones.

## Cómo se usa

1. Abre `index.html` en el navegador (doble clic, o sírvelo con un servidor
   estático — ver más abajo).
2. Pulsa **＋ Superficie** para crear un cuadrilátero.
3. Arrastra las **esquinas** (círculos azules) para deformarlo y ajustarlo
   a la cara física donde proyectarías. Arrastra el **centro** para moverlo.
4. En el **Inspector** (derecha) elige un efecto, colores, velocidad, etc.
5. Pulsa **▶ Proyectar** para enviar el resultado a pantalla completa
   (sin las guías de edición) — eso es lo que mandarías al proyector.

### Atajos
`A` nueva superficie · `Supr` borrar · `Espacio` play/pausa ·
`G` rejilla · `F` proyectar · `Esc` salir de proyección.

## Cómo funciona (arquitectura)

El flujo de un pixel es: **efecto → textura → warp → pantalla**.

```
js/
├── effects.js   Biblioteca de efectos. Cada efecto dibuja dentro de un
│                cuadrado unitario (256×256). No sabe nada de perspectiva.
├── surface.js   Modelo de "Superficie": 4 esquinas + propiedades + una
│                textura offscreen propia donde se renderiza su efecto.
├── warp.js      El corazón del mapping. Deforma la textura cuadrada hacia
│                los 4 puntos reales de la superficie (perspectiva).
└── app.js       UI, interacción con el ratón, inspector, bucle de render,
                 guardar/cargar y salida de proyección.
```

### La clave: el warp (`warp.js`)

Canvas 2D no sabe hacer transformaciones de perspectiva. El truco clásico
—y el que usa este proyecto— es **subdividir** el cuadrado origen en una
rejilla de NxN celdas. Cada vértice de la rejilla se coloca dentro del
cuadrilátero destino mediante **interpolación bilineal** de las 4 esquinas,
y cada celda se dibuja como 2 triángulos con transformación afín. Con N
suficientemente grande el resultado se ve como una proyección real.

Sube o baja la constante `N` en `warp.js` para cambiar el compromiso entre
precisión y rendimiento.

## Cómo añadir tu propio efecto

Es lo más fácil de modificar. En `js/effects.js`, añade una entrada al
objeto `EFFECTS`:

```js
miEfecto: {
  label: "Mi efecto",
  draw(ctx, res, t, p) {
    // ctx: contexto 2D del cuadrado de la textura
    // res: tamaño en px (256)
    // t:   tiempo en segundos (ya multiplicado por la velocidad)
    // p:   { color, color2, scale, opacity, ... }
    ctx.clearRect(0, 0, res, res);
    ctx.fillStyle = p.color;
    // ...dibuja lo que quieras en coordenadas 0..res...
  },
},
```

Aparecerá automáticamente en el desplegable del inspector. No tienes que
tocar nada más: el motor se encarga de deformarlo hacia las esquinas.

## Ideas para modificar (siguiente nivel)

- **Máscaras / recortes**: superficies con más de 4 lados (polígonos).
- **Secuencias**: una línea de tiempo que cambie efectos automáticamente.
- **Entrada de vídeo/imagen**: usar un `<video>` como textura en lugar de
  un efecto generado.
- **Bezier warp**: bordes curvos en vez de rectos, subdividiendo con curvas.
- **Audio-reactivo**: usar la Web Audio API para que los efectos reaccionen
  al sonido (muy típico en VJ).
- **Exportar/importar** el proyecto como archivo `.json` (ahora se guarda en
  `localStorage`).

## Servir en local (recomendado)

Como usa módulos ES, algunos navegadores bloquean `import` con `file://`.
Sírvelo con cualquier servidor estático:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Licencia

Proyecto educativo. Úsalo y modifícalo libremente.
