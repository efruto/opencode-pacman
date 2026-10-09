// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const POWER_PELLET_POINTS = 50;

// Modo asustado (power pellet): 6 s a 60 fps, huida a mitad de velocidad,
// parpadeo de aviso en los ultimos 2 s.
const FRIGHTENED_FRAMES = 360;
const FRIGHTENED_FLASH = 120;
const FRIGHTENED_SPEED = 0.05;
const EYES_SPEED = 0.2;
const FRIGHT_POINTS = [ 200, 400, 800, 1600 ];

// Centro del corral: destino de los ojos y celda donde reviven.
const PEN_CENTER = { x: 13, y: 14 };

// Ciclo de modos (frames a 60 fps): 20 s chase -> 7 s scatter, repetido
// infinito, arrancando en chase. Salidas del corral: rojo 0 (ya fuera),
// rosa 2 s, cian 5 s, naranja 8 s.
const CHASE_FRAMES = 1200;
const SCATTER_FRAMES = 420;
const RELEASE_FRAMES = { rojo: 0, rosa: 120, cian: 300, naranja: 480 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    mode: 'chase',
    modeTimer: 0,
    ticks: 0,
    frightTimer: 0, // frames restantes del modo asustado (0 = inactivo)
    frightChain: 0, // fantasmas comidos bajo el pellet actual (0..3)
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      state: 'normal', // 'normal' | 'frightened' | 'eyes'
      kind: g.kind,
      corner: { ...GHOST_SCATTER[ g.kind ] },
      released: false,
      releaseAt: RELEASE_FRAMES[ g.kind ],
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Re-alinea al centro de celda mas cercano. Obligatorio al cambiar de
// velocidad (asustado 0.05 -> ojos 0.2 / normal 0.1): desde un offset
// fraccional los pasos nuevos no siempre vuelven a un entero y sin centro
// exacto decideGhost() nunca corre.
function snapToCell( a ) {
  a.x = Math.round( a.x );
  a.y = Math.round( a.y );
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  // Ojos: la puerta nunca es muro — regresan al corral hacia abajo
  // (excepcion a la regla de un sentido de SPEC 02).
  if ( v === 3 && actor === 'eyes' ) return false;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 || cell === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += cell === 4 ? POWER_PELLET_POINTS : 10;
      game.dotsRemaining--;
      // Power pellet: se asustan todos (los ojos no).
      if ( cell === 4 ) {
        game.frightTimer = FRIGHTENED_FRAMES;
        game.frightChain = 0;
        for ( const g of game.ghosts ) {
          if ( g.state !== 'eyes' ) g.state = 'frightened';
        }
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo (celda) del fantasma segun el modo global y su conducta.
// Los objetivos pueden caer fuera del laberinto: la distancia Manhattan
// funciona igual y no hace falta recortar.
function computeTarget( game, g ) {
  const p = game.pacman;

  // En scatter todos se repliegan a su esquina.
  if ( game.mode === 'scatter' ) return g.corner;

  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ];

  if ( g.kind === 'rojo' ) {
    // Persecucion directa y agresiva.
    return { x: px, y: py };
  }

  if ( g.kind === 'rosa' ) {
    // Emboscada: 4 celdas delante de la direccion de Pac-Man.
    return { x: px + pd.x * 4, y: py + pd.y * 4 };
  }

  if ( g.kind === 'cian' ) {
    // Flanqueo: vector rojo -> 2-delante-de-Pac-Man, duplicado desde el rojo.
    const rojo = game.ghosts.find( ( o ) => o.kind === 'rojo' );
    const rx = Math.round( rojo.x );
    const ry = Math.round( rojo.y );
    const ax = px + pd.x * 2;
    const ay = py + pd.y * 2;
    return { x: rx + 2 * ( ax - rx ), y: ry + 2 * ( ay - ry ) };
  }

  // naranja: persigue lejos; a <= 8 celdas se retira a su esquina.
  const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
  if ( dist > 8 ) return { x: px, y: py };
  return g.corner;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  // Ojos: regreso al corral. Huida: el objetivo es Pac-Man pero se maximiza
  // la distancia. Normal: conducta propia segun el modo.
  const flee = g.state === 'frightened';
  const eyes = g.state === 'eyes';
  const target = eyes
    ? PEN_CENTER
    : flee
      ? { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) }
      : computeTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, eyes ? 'eyes' : 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Greedy: la direccion que mas reduce la distancia Manhattan al objetivo
  // (en huida, la que mas la aumenta respecto de Pac-Man).
  let best = choices[ 0 ];
  let bestDist = flee ? -Infinity : Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( flee ? dist > bestDist : dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Velocidad del fantasma segun su estado (solo moveGhost; la salida guiada
// del corral sigue usando g.speed).
function ghostSpeed( g ) {
  if ( g.state === 'frightened' ) return FRIGHTENED_SPEED;
  if ( g.state === 'eyes' ) return EYES_SPEED;
  return GHOST_SPEED;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    // Ojos al centro del corral: reviven y salen guiados por exitPen().
    if ( g.state === 'eyes' && g.x === PEN_CENTER.x && g.y === PEN_CENTER.y ) {
      g.state = 'normal';
      g.released = false;
      return;
    }

    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g.state === 'eyes' ? 'eyes' : 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = ghostSpeed( g );
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

// Salida guiada del corral: hacia la columna 13 (la de la puerta) y luego
// arriba cruzando la puerta (celda 3, transitable para fantasmas).
// released al llegar a la fila 11.
function exitPen( game, g ) {
  const grid = game.grid;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    if ( g.y <= 11 ) {
      g.released = true;
      return;
    }
    if ( g.x < 13 ) g.dir = 'right';
    else if ( g.x > 13 ) g.dir = 'left';
    else g.dir = 'up';
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = false;
    g.releaseAt = RELEASE_FRAMES[ g.kind ];
    g.state = 'normal';
  } );
  // Se reinician el calendario de salidas y el ciclo de modos.
  game.ticks = 0;
  game.mode = 'chase';
  game.modeTimer = 0;
  // Se cancela el modo asustado y su cadena de puntos.
  game.frightTimer = 0;
  game.frightChain = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.ticks++;

  // Modo asustado: corre el timer con el ciclo scatter/chase pausado. Corre
  // antes de mover y de las colisiones: al expirar, ese frame ya es letal.
  if ( game.frightTimer > 0 ) {
    game.frightTimer--;
    if ( game.frightTimer === 0 ) {
      for ( const g of game.ghosts ) {
        if ( g.state === 'frightened' ) {
          g.state = 'normal';
          snapToCell( g ); // 0.05 -> 0.1: realinear al centro
        }
      }
    }
  } else {
    // Ciclo de modos: 20 s chase -> 7 s scatter, repetido infinito.
    game.modeTimer++;
    if ( game.mode === 'chase' && game.modeTimer >= CHASE_FRAMES ) {
      game.mode = 'scatter';
      game.modeTimer = 0;
    } else if ( game.mode === 'scatter' && game.modeTimer >= SCATTER_FRAMES ) {
      game.mode = 'chase';
      game.modeTimer = 0;
    }
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    // Ojos: regreso directo al corral (moveGhost decide por estado).
    if ( g.state === 'eyes' ) {
      moveGhost( game, g );
      return;
    }
    if ( !g.released ) {
      // Calendario de salidas: quieto hasta su frame, luego salida guiada.
      if ( game.ticks >= g.releaseAt ) exitPen( game, g );
      return;
    }
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;
    // Ojos: inofensivos, se atraviesan.
    if ( g.state === 'eyes' ) continue;
    // Asustado: Pac-Man se lo come (cadena de puntos) y vuelve como ojos.
    if ( g.state === 'frightened' ) {
      game.score += FRIGHT_POINTS[ game.frightChain ];
      game.frightChain++;
      g.state = 'eyes';
      snapToCell( g ); // 0.05 -> 0.2: realinear al centro
      continue;
    }
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHTENED_FLASH = FRIGHTENED_FLASH;
