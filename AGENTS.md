# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone. There is no build system, no `package.json`, no tests, and no linter — don't invent commands like `npm install`, `npm test`, or `npm run build`.

## Running

Open `src/index.html` directly in a browser. No dev server, install, or codegen step.

## Architecture

- Entry point is `src/index.html`. Scripts are classic global-sharing `<script>` tags loaded in strict order: `maze.js` → `game.js` → `render.js` → `main.js`. There are **no ES modules** — files communicate via globals, and load order is a hard dependency (don't add `import`/`export`).
  - `maze.js`: 28x31 maze written as readable strings and parsed to numbers; provides globals `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`. Cell values: 1 wall, 2 dot, 0 empty, 3 pen door. The maze is symmetric around the vertical axis between columns 13 and 14.
  - `game.js`: state and rules; provides `createGame()`, `update()`.
  - `render.js`: canvas drawing; provides `draw()`. `TILE = 20`; canvas is 560x620 (= 28x31 tiles).
  - `main.js`: `requestAnimationFrame` loop, keyboard input, overlay screens.
- Each game copies `MAZE` into `game.grid` so dots can be eaten without mutating the original. `render.js` draws from `game.grid`, never `MAZE`.

## Conventions

- Comments, UI text, and README are in Spanish — keep new ones in Spanish.

## Spec-driven workflow

The project follows spec-driven development via the `spec` and `spec-impl` skills (installed under `.agents/skills/`, pinned in `skills-lock.json`).

- Specs live in `specs/NN-slug.md` (two-digit zero-padded numbers; the folder doesn't exist yet, so the first spec starts at `01-`).
- `spec-impl` implements an approved spec on a branch named `spec-NN-slug`, step by step with pauses to review diffs.
- `specs/.spec-config.yml` (seeded automatically by the `spec` skill on first use) controls `AutoCreateBranch`.
