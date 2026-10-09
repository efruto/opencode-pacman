# SPEC 03 — Power pellets y fantasmas comibles

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-07
> **Objetivo:** Cuatro power pellets que asustan a los fantasmas para que Pac-Man pueda comerlos por una cadena de puntos, con los comidos regresando al corral como ojos.

## Por qué existe este spec

SPEC 01 y SPEC 02 dejaron explícitamente fuera los power pellets ("van en su propio spec"). Hoy toda colisión Pac-Man/fantasma cuesta una vida; falta el contrajuego clásico del arcade.

## Alcance

**In:**

- 4 power pellets: carácter `'o'` en `MAZE_STR` (`src/js/maze.js`) que se parsea a valor 4, en las posiciones clásicas (1,3), (26,3), (1,23), (26,23); se comen como los dots, valen 50 pts y cuentan para `dotsRemaining` (ganar).
- Estado asustado global (`game.frightTimer` / `game.frightChain`): se asustan los 4 fantasmas, incluidos los que esperan rebotando en el corral.
- Conducta asustada: huir de Pac-Man (greedy maximizando la distancia Manhattan) a mitad de velocidad (0.05 celdas/frame); el ciclo scatter/chase se pausa mientras dura el efecto.
- Efecto de 6 s (360 frames) con parpadeo azul↔blanco los últimos 2 s (120 frames).
- Comer fantasma asustado por colisión: cadena 200/400/800/1600 pts que reinicia con cada pellet; el comido se vuelve `'eyes'`.
- Ojos: vuelven al corral (excepción a la puerta de un sentido de SPEC 02: cruzan hacia abajo), a 0.2 celdas/frame, inofensivos (la colisión con Pac-Man no hace nada), reviven al llegar al centro (13,14) y salen normales por la puerta.
- Comer otro pellet con efecto activo: reinicia el timer y la cadena; los ojos no se asustan.
- Perder una vida durante el efecto lo cancela: todos vuelven normales a sus inicios con el calendario de salidas de SPEC 01/02 intacto.

**Out of scope (para futuros specs):**

- Frutas y bonus.
- Duración escalonada del efecto por nivel o niveles múltiples.
- Inversión forzada de dirección al asustarse/acabarse el efecto.
- Timers de asustado individuales por fantasma.
- Cruise Elroy y frenado en túnel.

## Modelo de datos

`src/js/maze.js` — filas 3 y 23 de `MAZE_STR` cambian su `'.'` de las columnas 1 y 26 por `'o'`; `parseTile` mapea `'o'` → 4.

`src/js/game.js` — constantes nuevas:

```js
const FRIGHTENED_FRAMES  = 360;   // 6 s a 60 fps
const FRIGHTENED_FLASH    = 120;   // parpadeo los ultimos 2 s
const FRIGHTENED_SPEED    = 0.05;  // mitad de GHOST_SPEED
const EYES_SPEED          = 0.2;
const POWER_PELLET_POINTS = 50;
const FRIGHT_POINTS       = [ 200, 400, 800, 1600 ];
```

Estado añadido a `createGame()` y a cada fantasma:

```js
game.frightTimer = 0;  // frames restantes del efecto (0 = inactivo)
game.frightChain = 0;  // fantasmas comidos bajo el pellet actual (0..3)

// cada fantasma gana:
g.state = 'normal';     // 'normal' | 'frightened' | 'eyes'
```

Reglas:

- `movePacman()`: celda 4 → grid 0, `+POWER_PELLET_POINTS`, `dotsRemaining--`, disparo del efecto (`frightTimer = FRIGHTENED_FRAMES`, `frightChain = 0`, todo `g.state !== 'eyes'` pasa a `'frightened'`).
- `update()`: mientras `frightTimer > 0` el `modeTimer` no avanza y `frightTimer` decrementa; al llegar a 0, los `'frightened'` vuelven a `'normal'`.
- `decideGhost()`: en `'frightened'` elige la dirección que maximiza la distancia Manhattan a Pac-Man (huida); en `'eyes'` minimiza hacia (13,14) y la puerta (celda 3) es transitable hacia abajo solo para ojos (excepción a la regla de SPEC 02).
- Velocidad derivada del estado en `moveGhost()`: `'frightened'` → 0.05, `'eyes'` → 0.2, normal → `GHOST_SPEED`.
- Ojos alineados en (13,14): vuelven a `'normal'` y salen guiados hacia arriba por la puerta (misma salida de `exitPen()`).
- Colisiones en `update()`: con `'frightened'` → comer (`+FRIGHT_POINTS[frightChain++]`, `g.state = 'eyes'`); con `'normal'` → perder vida (regla actual); con `'eyes'` → nada.
- `resetPositions()`: además `frightTimer = 0`, `frightChain = 0` y todos `g.state = 'normal'`.

`src/js/render.js`:

- `drawDots()`: el valor 4 se dibuja con radio mayor (~6.5 px), mismo color.
- `drawGhost()`: `'frightened'` → cuerpo azul `#2121ff` (blanco cuando `game.frightTimer <= FRIGHTENED_FLASH`, alternando por frame); `'eyes'` → solo los ojos, sin cuerpo.
- `game.js` exporta `FRIGHTENED_FLASH` por `window` (patrón existente de `DIRS`) para que `render.js` consulte el parpadeo.

Convenciones sin cambio: coordenadas en celdas con origen arriba-izquierda; velocidades en celdas/frame.

## Plan de implementación

1. `src/js/maze.js` (`'o'` → 4) + `src/js/game.js` (contar `v === 4` en los dots de `createGame()`) + `src/js/render.js` (pellet grande). Prueba manual: 4 pellets grandes visibles en las esquinas del laberinto; comerlos da 50 pts, los borra y siguen contando para ganar.
2. `src/js/game.js`: estado asustado — disparo al comer pellet (los 4), huida greedy a 0.05, pausa del `modeTimer`, fin del efecto a los 360 frames. Prueba manual: al comer pellet todos huyen a mitad de velocidad ~6 s (aún letales y con color normal).
3. `src/js/render.js`: azul asustado y parpadeo blanco final (exporta `FRIGHTENED_FLASH` desde `game.js`). Prueba manual: azules al comer pellet, parpadean los últimos ~2 s y vuelven a su color.
4. `src/js/game.js` + `src/js/render.js`: comer fantasma — colisión con `'frightened'` suma la cadena y lo vuelve `'eyes'`; ojos navegan a (13,14) a 0.2 cruzando la puerta hacia abajo, reviven y salen; render dibuja solo ojos. Prueba manual: comer 1-2 fantasmas y verlos volver, entrar al corral y reemerger normales.
5. `src/js/game.js`: interacciones — colisión con ojos no hace nada; pellet con efecto activo reinicia timer y cadena (ojos excluidos); perder vida cancela el efecto y resetea la cadena. Prueba manual: encadenar 200/400/800/1600 bajo un mismo pellet; perder una vida a mitad del efecto.

`src/js/main.js` y `src/index.html` no cambian.

## Criterios de aceptación

- [ ] Al cargar `src/index.html` sin errores de consola, se ven 4 pellets grandes en (1,3), (26,3), (1,23) y (26,23).
- [ ] Comer un power pellet suma exactamente 50 pts y lo borra del tablero.
- [ ] Los 4 fantasmas (corral incluido) se pintan azul y huyen de Pac-Man a mitad de velocidad.
- [ ] El ciclo scatter/chase queda pausado durante el efecto y retoma donde iba al terminar.
- [ ] Los últimos ~2 s los asustados parpadean azul↔blanco y al expirar vuelven a su color y conducta normales.
- [ ] Tocar un fantasma asustado lo come: suma 200 el 1.º, 400 el 2.º, 800 el 3.º y 1600 el 4.º bajo un mismo pellet.
- [ ] El comido se vuelve ojos (solo ojos visibles), atraviesa a Pac-Man sin efecto, entra al corral bajando por la puerta, revive y vuelve a salir normal.
- [ ] Comer otro pellet con efecto activo reinicia los 6 s y la cadena a 200; un fantasma en `'eyes'` no se asusta.
- [ ] Perder una vida durante el efecto lo cancela: los 4 vuelven normales a sus inicios y el calendario de salidas se reinicia (SPEC 01/02 intactas).
- [ ] Ganar, perder, dots, vidas y overlays GANASTE/PERDISTE siguen intactos; los pellets cuentan para ganar.
- [ ] `src/js/main.js` y `src/index.html` quedan sin cambios.

## Decisiones

- **Sí:** valor 4 en el grid (carácter `'o'` en `MAZE_STR`) — reusa la copia de `MAZE` y el conteo de dots sin estado duplicado. **No:** lista aparte de coordenadas.
- **Sí:** huir de Pac-Man con greedy maximizando la distancia Manhattan — determinista, reusa `decideGhost()` y es verificable. **No:** aleatorio en intersecciones del arcade.
- **Sí:** ojos que vuelven al corral cruzando la puerta hacia abajo — la excepción que SPEC 02 dejó prevista. **No:** respawn instantáneo en el inicio.
- **Sí:** cadena 200/400/800/1600 que reinicia con cada pellet (arcade) y pellet a 50 pts. **No:** 200 plano por fantasma.
- **Sí:** se asustan los 4, incluidos los no liberados (arcade).
- **Sí:** 6 s fijos con parpadeo los últimos 2 s. **No:** duración escalada por nivel — no hay niveles.
- **Sí:** pausar el `modeTimer` durante el efecto (arcade, costo trivial). **No:** dejarlo correr.
- **Sí:** asustados a 0.05, ojos a 0.2, normales a `GHOST_SPEED`.
- **Sí:** ojos inofensivos (atravieszan a Pac-Man sin colisión) — como el arcade.
- **Sí:** los ojos reviven normales aunque quede efecto activo — simplificación consciente (en el arcade saldrían azules si aún durara).
- **Sí:** perder una vida cancela el efecto y resetea la cadena — consistente con `resetPositions()`.
- **Sí:** exportar `FRIGHTENED_FLASH` por `window` desde `game.js` — patrón existente de `DIRS`.
- **No:** inversión de dirección al asustarse/acabarse el efecto — SPEC 01 ya la descartó para cambios de modo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| SPEC 02 figura "Implementado" en el working tree pero `game.js` de `main` no contiene la regla de un sentido (el commit 8098374 solo añadió los .md) | La excepción de ojos se define sobre la regla de SPEC 02: si al implementar SPEC 03 la regla aún no existe, los ojos cruzan igual (la puerta hoy es transitable en ambos sentidos para fantasmas). No hay bloqueo; comprobar ambos casos. |
| Colisión el mismo frame en que expira el efecto | El timer decrementa antes del chequeo de colisiones en `update()`: el fantasma ya `'normal'` ese frame es letal, como en el arcade. |
| `requestAnimationFrame` a 120 Hz acorta el efecto (~6 s → ~3 s) | Ya documentado en SPEC 01/02; no es una regresión nueva. |

## Lo que **no** está en este spec

- Frutas y bonus.
- Duración escalonada por nivel o niveles múltiples.
- Inversión forzada de dirección al asustarse/acabarse.
- Timers de asustado individuales por fantasma.
- Cruise Elroy y frenado en túnel.

Cada uno de estos, si algún día aterriza, va en su propio spec.
