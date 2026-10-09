# SPEC 02 — Corral con puerta de un solo sentido y rebote de espera

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-07
> **Objetivo:** Que ningún fantasma liberado vuelva a quedar atrapado en el corral — la puerta solo se cruza hacia arriba y quienes esperan su turno rebotan dentro como en el arcade antes de salir escalonadas.

## Por qué existe este spec

SPEC 01 dejó la celda-puerta (3) transitable para fantasmas en ambos sentidos (`isWall()` en `src/js/game.js`). Un fantasma liberado que patrulla la fila 11 puede elegir `down` hacia la puerta persiguiendo a Pac-Man, reingresa al corral y la elección greedy con prohibición de reversa lo deja rebotando dentro sin salir. En una simulación Node de ~11 min con el código actual, el rojo quedó atrapado 2 veces con rachas de ~1240 frames (~21 s a 60 fps). La salida inicial escalonada (0/2/5/8 s) **sí** funciona y no se toca; el arreglo ataca solo el reingreso.

## Alcance

**In:**

- Puerta de un solo sentido: en `canMove()` de `src/js/game.js`, para `actor === 'ghost'` una celda destino con valor 3 solo es transitable con `dir === 'up'`. Un fantasma liberado jamás reingresa al corral.
- Rebote arcade de espera: mientras `!released` y `game.ticks < releaseAt`, rosa/cian/naranja oscilan verticalmente en su columna de inicio entre `PEN_BOUNCE_MIN = 13.5` y `PEN_BOUNCE_MAX = 14.5` (±0.5 celdas alrededor de la fila 14), a `GHOST_SPEED`, revirtiendo `dir` al tocar cada borde.
- La salida guiada de `exitPen()` queda como está y tolera tomar el control con el fantasma a media altura del rebote: se alinea en fila 13, 14 o 15 y sigue hacia la columna 13 y arriba por la puerta.

**Out of scope (para futuros specs):**

- Power pellets, modo asustado y fantasmas comibles — incluidos los "ojos" que regresan al corral (la excepción futura a la puerta de un sentido).
- Cambios al calendario de salidas (0/120/300/480) o al ciclo scatter/chase — SPEC 01 queda intacta.
- Rebote de rojo (arranca fuera del corral y libera en el frame 0).
- Velocidades distintas por fantasma (Cruise Elroy, frenado en túnel).

## Modelo de datos

No hay estructuras nuevas: el rebote reusa `dir` (`up`/`down`) y el estado del corral ya vive en `released`/`releaseAt`. Solo se añaden dos constantes en `src/js/game.js`:

```js
const PEN_BOUNCE_MIN = 13.5; // borde superior del vaivén (celdas)
const PEN_BOUNCE_MAX = 14.5; // borde inferior
```

Y una regla nueva en `canMove()`: para fantasmas, la celda destino con valor 3 (puerta) es muro salvo cuando `dir === 'up'`. Convenciones existentes sin cambio: coordenadas en celdas, origen arriba-izquierda.

## Plan de implementación

1. `src/js/game.js`: regla de un solo sentido — en `canMove()`, si el actor es fantasma y la celda destino es puerta (3) con `dir !== 'up'`, devolver `false`. Prueba manual: jugar 1-2 min; los fantasmas patrullan la fila 11 por encima de la puerta sin meterse y nadie desaparece dentro del corral. Apoyo opcional: simulación Node en memoria (cargar `maze.js`+`game.js`, parchear `canMove`, correr `update()` ~60k ticks con Pac-Man moviéndose) — debe dar 0 reingresos al corral (x 11-16, y 12-15) de fantasmas liberados.
2. `src/js/game.js`: rebote de espera — en `update()`, mientras `!released && game.ticks < releaseAt` mover al fantasma en su `dir` vertical y revertir `dir` al alcanzar `PEN_BOUNCE_MIN`/`PEN_BOUNCE_MAX`. Prueba manual: al iniciar y tras perder una vida, rosa/cian/naranja rebotan dentro del corral y salen a los ~2/5/8 s girando hacia la columna 13 y cruzando la puerta hacia arriba.

`src/js/maze.js`, `src/js/render.js`, `src/js/main.js` y `src/index.html` no cambian.

## Criterios de aceptación

- [ ] Al cargar `src/index.html` sin errores en consola, rosa/cian/naranja rebotan verticalmente dentro del corral desde el primer segundo y el rojo no (está fuera desde el arranque).
- [ ] Jugando 2+ minutos, ningún fantasma liberado entra a las celdas de la puerta (fila 12, columnas 13-14) moviéndose hacia abajo ni al interior del corral (x 11-16, y 13-15).
- [ ] Ningún fantasma liberado queda inmóvil más de ~10 s en ninguna parte del mapa.
- [ ] Los que rebotan salen a los ~2/5/8 s de iniciada la partida (o de la última pérdida de vida), cruzando la puerta hacia arriba.
- [ ] Tras perder una vida, los 4 regresan a sus inicios, rebotan mientras esperan y vuelven a salir escalonadas.
- [ ] Ganar, perder, dots, vidas y overlays GANASTE/PERDISTE siguen intactos.
- [ ] `src/js/maze.js`, `src/js/render.js`, `src/js/main.js` y `src/index.html` quedan sin cambios.

## Decisiones

- **Sí:** puerta de un solo sentido (solo se cruza hacia arriba) — mínimo cambio en `canMove()`, reproduce el arcade y elimina el atasco. **No:** muro total para liberados con camino especial en `exitPen()` — más código, mismo resultado visible (elección del usuario).
- **Sí:** rebote arcade de espera (elección del usuario; antes quietos).
- **Sí:** vaivén de ±0.5 celdas alrededor de la fila 14 a `GHOST_SPEED` — fiel al vaivén corto del arcade y verificado en simulación: `exitPen()` retoma el control desde cualquier altura del rebote.
- **Sí:** mantener el calendario escalonado 0/120/300/480 y toda la SPEC 01 intacta (elección del usuario).
- **Sí:** `exitPen()` sin cambios — ya decide solo al estar alineado; tras el rebote se alinea en fila 13/14/15 y sigue la salida guiada.
- **Sí:** verificación manual en navegador; simulaciones Node desechables como apoyo (el proyecto no tiene infraestructura de tests).
- **No:** restringir el paso por la fila 11 (encima de la puerta) — es un corredor legítimo del mapa; el problema era cruzar hacia abajo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `requestAnimationFrame` a 120 Hz acorta los tiempos de pared (~2/5/8 s → ~1/2.5/4 s) | Ya documentado en SPEC 01; no es una regresión nueva. |
| Pérdida de vida con un fantasma cruzando la puerta | `resetPositions()` ya reubica a los 4 en sus celdas de `GHOST_STARTS`; nadie queda en la celda 3. |
| Llega `releaseAt` con el fantasma a media altura del rebote | `exitPen()` actúa solo alineado: en el peor caso barre hasta la fila 15 antes de girar a la columna 13 (verificado: sale en ≤48 ticks). |

## Lo que **no** está en este spec

- Power pellets, modo asustado y "ojos" que regresan al corral.
- Cambios al calendario de salidas o al ciclo scatter/chase.
- Velocidades distintas por fantasma.
- Rebote de rojo.

Cada uno de estos, si algún día aterriza, va en su propio spec.
