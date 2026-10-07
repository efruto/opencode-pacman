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
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    mode: 'chase',
    modeTimer: 0,
    ticks: 0,
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

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
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
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
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
  const target = computeTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Greedy: la direccion que mas reduce la distancia Manhattan al objetivo.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
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
  } );
  // Se reinician el calendario de salidas y el ciclo de modos.
  game.ticks = 0;
  game.mode = 'chase';
  game.modeTimer = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.ticks++;

  // Ciclo de modos: 20 s chase -> 7 s scatter, repetido infinito.
  game.modeTimer++;
  if ( game.mode === 'chase' && game.modeTimer >= CHASE_FRAMES ) {
    game.mode = 'scatter';
    game.modeTimer = 0;
  } else if ( game.mode === 'scatter' && game.modeTimer >= SCATTER_FRAMES ) {
    game.mode = 'chase';
    game.modeTimer = 0;
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    if ( !g.released ) {
      // Calendario de salidas: quieto hasta su frame, luego salida guiada.
      if ( game.ticks >= g.releaseAt ) exitPen( game, g );
      return;
    }
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
