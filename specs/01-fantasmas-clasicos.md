# SPEC 01 — Los cuatro fantasmas con conductas clásicas

> **Estado:** Implementado
> **Depende de:** ninguno
> **Fecha:** 2026-10-07
> **Objetivo:** Cuatro fantasmas con conductas distintas del arcade clásico —el rojo agresivo que persigue directo a Pac-Man—, salidas escalonadas del corral y ciclo scatter/chase.

## Por qué existe este spec

Hoy hay solo 2 fantasmas genéricos (`hunter` y `random` en `src/js/game.js`). Se necesita el cuarteto clásico, cada uno con su forma propia de actuar, y el rojo como perseguidor agresivo.

## Alcance

**In:**

- 4 fantasmas con `kind` en español: `rojo`, `rosa`, `cian`, `naranja` (equivalentes a Blinky, Pinky, Inky, Clyde).
- Conductas clásicas: el rojo persigue directo; el rosa apunta 4 celdas delante de Pac-Man; el cian flanquea con el vector rojo→2-celdas-delante-de-Pac-Man duplicado; el naranja persigue salvo a ≤8 celdas de distancia Manhattan, donde se retira a su esquina.
- El rojo arranca fuera del corral persiguiendo de inmediato; rosa, cian y naranja salen escalonadas a los ~2 s, ~5 s y ~8 s (contador de frames en `update()`).
- Ciclo global de modos: 20 s chase → 7 s scatter, repetido infinito, arrancando en chase.
- Al perder una vida: los 4 vuelven a sus inicios, el calendario de salidas se reinicia y el rojo queda activo de inmediato.

**Out of scope (para futuros specs):**

- Power pellets y modo asustado (fantasmas comibles).
- Velocidades distintas por fantasma (Cruise Elroy, frenado en túnel).
- Inversión forzada de dirección al cambiar scatter↔chase.
- Niveles múltiples o dificultad progresiva.

## Modelo de datos

`src/js/maze.js`:

```js
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'rojo' },    // fuera del corral, sobre la puerta
  { x: 13, y: 14, kind: 'rosa' },    // interior del corral, columna de salida
  { x: 12, y: 14, kind: 'cian' },
  { x: 15, y: 14, kind: 'naranja' },
];

// Esquinas de scatter (celdas transitables de cada esquina del laberinto).
const GHOST_SCATTER = {
  rojo:    { x: 26, y: 1 },
  rosa:    { x: 1,  y: 1 },
  cian:    { x: 26, y: 29 },
  naranja: { x: 1,  y: 29 },
};
```

`GHOST_SCATTER` se exporta por `window` como el resto de constantes.

`src/js/game.js` — cada fantasma gana campos:

```js
{
  x, y, dir: 'up', speed: GHOST_SPEED,
  kind: 'rojo',               // 'rojo' | 'rosa' | 'cian' | 'naranja'
  corner: { x: 26, y: 1 },    // copia de GHOST_SCATTER[kind]
  released: false,            // false = en el corral o esperando su turno
  releaseAt: 0,               // frame de salida: 0 | 120 | 300 | 480
}
```

Estado global añadido a `createGame()`:

```js
game.mode = 'chase';    // 'chase' | 'scatter'
game.modeTimer = 0;     // frames desde el último cambio de modo
game.ticks = 0;         // frames desde inicio o último reset (calendario de salidas)
```

Constantes: `CHASE_FRAMES = 1200`, `SCATTER_FRAMES = 420` (20 s y 7 s a 60 fps). Salida del corral: mientras `!released`, si `game.ticks < releaseAt` el fantasma no se mueve; al alcanzarlo camina hacia la columna 13 y sube cruzando la puerta (celda 3, ya transitable para fantasmas); `released = true` al llegar a la fila 11.

Convenciones: coordenadas en celdas con origen arriba-izquierda (las existentes); velocidades en celdas/frame; los objetivos de persecución pueden caer fuera del laberinto — no se recortan, la distancia Manhattan funciona igual.

`src/js/render.js`: solo se reordena `GHOST_COLORS` para que coincida con el orden de `GHOST_STARTS`:

```js
const GHOST_COLORS = [ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ]; // rojo, rosa, cian, naranja
```

## Plan de implementación

1. `src/js/maze.js`: ampliar `GHOST_STARTS` a 4 entradas, añadir `GHOST_SCATTER` y exportarlo; reordenar `GHOST_COLORS` en `src/js/render.js`. Prueba manual: abrir `src/index.html`, ver los 4 fantasmas en sus inicios (rojo fuera del corral) sin errores en consola; el juego sigue jugable con la conducta aleatoria heredada.
2. `src/js/game.js`: en `createGame()` añadir `corner`, `released`, `releaseAt`, `game.mode`, `game.modeTimer`, `game.ticks`; implementar el calendario y la salida guiada del corral en `update()`/`moveGhost()`. Prueba manual: rosa/cian/naranja quietas hasta salir a los ~2/5/8 s; el rojo activo desde el inicio.
3. `src/js/game.js`: implementar `computeTarget(game, g)` (las 4 conductas + scatter) y reescribir `decideGhost()` como elección greedy hacia el objetivo, manteniendo la prohibición de reversa actual. Prueba manual: el rojo converge, el rosa corta el paso, el cian llega por el flanco, el naranja se retira al acercarse.
4. `src/js/game.js`: ciclo de modos en `update()` (chase↔scatter según `modeTimer`) y extender `resetPositions()` (posiciones, `released`, `releaseAt`, `game.ticks`, `game.mode`). Prueba manual: repliegues periódicos a las esquinas; al morir Pac-Man el calendario se reinicia.

`src/js/main.js` y `src/index.html` no cambian.

## Criterios de aceptación

- [ ] Al cargar `src/index.html` no hay errores en consola y se ven 4 fantasmas: rojo fuera del corral y rosa/cian/naranja dentro, cada uno con su color.
- [ ] El rojo persigue directo a Pac-Man desde el primer segundo de juego.
- [ ] El rosa dirige su rumbo hacia 4 celdas delante de la dirección de Pac-Man (le corta el paso).
- [ ] El cian se aproxima por el flanco opuesto al rojo respecto de Pac-Man.
- [ ] El naranja persigue lejos y se retira a su esquina inferior izquierda al estar a ≤8 celdas de Pac-Man.
- [ ] Rosa, cian y naranja salen del corral escalonadas (~2 s, ~5 s, ~8 s tras iniciar).
- [ ] Los cuatro repliegan hacia sus esquinas a intervalos regulares (7 s) y vuelven a perseguir (20 s).
- [ ] Al perder una vida, los 4 regresan a sus inicios, el rojo queda activo y el calendario de salidas se reinicia.
- [ ] Ganar y perder siguen funcionando (dots, vidas, overlays GANASTE/PERDISTE intactos).
- [ ] `src/js/main.js` y `src/index.html` quedan sin cambios.

## Decisiones

- **Sí:** kinds en español por color (`rojo`/`rosa`/`cian`/`naranja`) — elección del usuario; equivalen 1:1 a Blinky/Pinky/Inky/Clyde.
- **No:** nombres por rol (`agresivo`/`emboscador`/...) — descartados por el usuario.
- **Sí:** conductas clásicas con elección greedy por distancia Manhattan, reutilizando la regla de no-reversa de `decideGhost()`.
- **Sí:** salidas escalonadas por contador de frames (120/300/480). **No:** contador de dots comidos — depende del jugador y es más difícil de verificar.
- **Sí:** ciclo fijo 20 s chase → 7 s scatter infinito, arrancando en chase para que el rojo persiga desde el primer segundo. **No:** la secuencia clásica 7/20/7/20/5/20/5 con chase permanente final.
- **Sí:** velocidad uniforme (`GHOST_SPEED`) para los 4. **No:** Cruise Elroy.
- **Sí:** al perder vida, todos vuelven al corral y el calendario se reinicia — consistente con `resetPositions()` y da respiro al jugador.
- **Sí:** objetivos de persecución pueden caer fuera del laberinto (incluye el famoso desvío de Pinky hacia arriba) — no hace falta recortar.
- **No:** power pellets y modo asustado — van en su propio spec.
- **No:** inversión de dirección forzada al cambiar de modo — simplificación consciente.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `requestAnimationFrame` no garantiza 60 fps (en pantallas de 120 Hz todo el juego corre al doble, incluidos los temporizadores) | Ya ocurre en el juego actual; los tiempos ~2/5/8 s y 20/7 s se documentan como "a 60 fps". No se introduce una regresión nueva. |
| El cian necesita la posición del rojo | El rojo nunca muere ni desaparece (no hay modo asustado); se localiza por `kind`, no por índice. |

## Lo que **no** está en este spec

- Power pellets y modo asustado (fantasmas comibles).
- Velocidades distintas por fantasma (Cruise Elroy).
- Inversión de dirección al cambiar de modo.
- Niveles múltiples o dificultad progresiva.

Cada uno de estos, si algún día aterriza, va en su propio spec.
