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
`G` rejilla · `C` cámara · `F` proyectar · `Esc` salir de proyección.

## Cámara + colisiones (experimental)

Pulsa **👁 Cámara** (o `C`) para activar la webcam y detectar objetos por
color, de modo que la escena reaccione al mundo físico.

1. Da permiso a la cámara. Aparece una vista en miniatura abajo a la izquierda.
2. **Haz clic en el vídeo** sobre el objeto que quieras seguir: toma ese color
   como objetivo. Ajusta la **Tolerancia** si lo pierde o detecta de más.
3. (Opcional pero recomendado) Pulsa **🎯 Calibrar** y haz clic en las **4
   esquinas** del área proyectada dentro de la imagen de la cámara
   (arriba-izq, arriba-der, abajo-der, abajo-izq). Así la posición de la
   cámara se mapea a la posición real en el escenario.
4. Mueve el objeto: verás un marcador verde siguiéndolo. Cuando entra en una
   superficie, esta se resalta (**▲ COLISIÓN**) y emite un destello.

### Cómo funciona (`js/vision.js`)

- **Captura**: `getUserMedia` vuelca cada frame en un lienzo pequeño (160×120)
  para leer sus píxeles rápido.
- **Detección**: se recorren los píxeles y se toma el **centroide** de los que
  están dentro de la tolerancia del color objetivo (seguimiento de blob por
  color, sin librerías).
- **Calibración**: una **homografía** 3×3 mapea la posición en la cámara
  (0..1) a coordenadas del escenario. Es la misma matemática de perspectiva
  que `warp.js`, pero al revés (imagen → escena). Se resuelve con los 4 puntos
  que marcas.
- **Colisión**: el punto ya en coordenadas del escenario se prueba contra cada
  superficie con `Surface.contains()` (point-in-polygon, que ya existía).

### Definir tus propias reglas

En `js/app.js`, la función `onSurfaceHit(s)` se ejecuta cada vez que un objeto
**entra** en una superficie. Ahí defines la lógica: cambiar de efecto, de
color, disparar un sonido, contar impactos, etc. Trae un ejemplo comentado
(pasar al siguiente efecto al recibir un impacto).

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
├── vision.js    Cámara + detección de objetos por color + calibración por
│                homografía (para las colisiones con el mundo físico).
└── app.js       UI, interacción con el ratón, inspector, bucle de render,
                 guardar/cargar, colisiones y salida de proyección.
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
