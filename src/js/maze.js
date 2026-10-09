// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · ' ' vacio transitable(0) · '-' puerta pen(3)
//   'o' power pellet(4)
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

const MAZE_STR = [
  '############################', // 0  borde
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#o####.#####.##.#####.####o#', // 3  power pellets
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '######.##..........##.######', // 11
  '######.##.###--###.##.######', // 12  puerta pen cols 13-14
  '######.##.#      #.##.######', // 13  interior pen
  '          #      #          ', // 14  tunel (extremos abiertos) + pen
  '######.##.#      #.##.######', // 15  interior pen
  '######.##.########.##.######', // 16  fondo pen
  '######.##..........##.######', // 17
  '######.#####.##.#####.######', // 18
  '######.#####.##.#####.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#o..##................##..o#', // 23  fila inicio Pacman (13,23) + power pellets
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30  borde
];

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4; // power pellet
  return 0; // espacio = vacio transitable
}

// Matriz numerica pristina (no se muta; cada partida copia esto).
const MAZE = MAZE_STR.map( ( row ) => row.split( '' ).map( parseTile ) );

const TUNNEL_ROW = 14;
const PACMAN_START = { x: 13, y: 23 };
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'rojo' },    // fuera del corral, sobre la puerta
  { x: 13, y: 14, kind: 'rosa' },    // interior del corral, columna de salida
  { x: 12, y: 14, kind: 'cian' },    // interior del corral
  { x: 15, y: 14, kind: 'naranja' }, // interior del corral
];

// Esquinas de scatter (celdas transitables de cada esquina del laberinto).
const GHOST_SCATTER = {
  rojo:    { x: 26, y: 1 },
  rosa:    { x: 1,  y: 1 },
  cian:    { x: 26, y: 29 },
  naranja: { x: 1,  y: 29 },
};

window.MAZE = MAZE;
window.TUNNEL_ROW = TUNNEL_ROW;
window.PACMAN_START = PACMAN_START;
window.GHOST_STARTS = GHOST_STARTS;
window.GHOST_SCATTER = GHOST_SCATTER;
