const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const dpadCenter = document.getElementById("dpad-center");
const bombBtn = document.getElementById("bomb-btn");
const characterSelect = document.getElementById("character-select");

const CELL = 32;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const PLAYER_SIZE = 24;
const ENEMY_SIZE = 24;
const PLAYER_SPEED = 3.1;
const ENEMY_SPEED = 1.5;
const FUSE_MS = 1800;
const BLAST_MS = 400;
const INVINCIBLE_MS = 2000;
const POWERUP_INVINCIBLE_MS = 10000;
const BASE_BOMB_RANGE = 1;
const BASE_MAX_BOMBS = 1;
const BLOCK_DENSITY = 0.45;
const POWERUP_DROP_CHANCE = 0.3;

const EMPTY = 0;
const WALL = 1;
const BLOCK = 2;

const POWERUP_ICONS = {
  range: "\u{1F4A5}",
  bomb: "\u{1F4A3}",
  life: "\u{2764}\u{FE0F}",
  invincible: "\u{2B50}",
};

const PLAYER_ICONS = {
  boy: "\u{1F468}\u{200D}\u{1F680}",
  girl: "\u{1F469}\u{200D}\u{1F680}",
};

const ENEMY_ICONS = [
  "\u{1F47E}",
  "\u{1F47D}",
  "\u{1F419}",
  "\u{1F991}",
  "\u{1F9A0}",
];

const ENEMY_SPAWNS = [
  [COLS - 2, 1],
  [1, ROWS - 2],
  [COLS - 2, ROWS - 2],
  [Math.floor(COLS / 2), 1],
  [Math.floor(COLS / 2), ROWS - 2],
];

let grid, player, enemies, bombs, explosions, powerups;
let playerGender = "boy";
let score, best, lives, level, running, paused, gameStatus;
let keys = { up: false, down: false, left: false, right: false };
let rafId, lastTime;

best = Number(localStorage.getItem("astro-best") || 0);
bestEl.textContent = best;

function cellCenter(col, row) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function buildGrid() {
  const g = [];
  for (let row = 0; row < ROWS; row++) {
    const r = [];
    for (let col = 0; col < COLS; col++) {
      if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) {
        r.push(WALL);
      } else if (row % 2 === 0 && col % 2 === 0) {
        r.push(WALL);
      } else {
        r.push(Math.random() < BLOCK_DENSITY ? BLOCK : EMPTY);
      }
    }
    g.push(r);
  }
  const clear = (col, row) => {
    if (g[row] && g[row][col] !== WALL) g[row][col] = EMPTY;
  };
  clear(1, 1);
  clear(2, 1);
  clear(1, 2);
  return g;
}

function makeEntity(col, row, size) {
  return {
    x: col * CELL + (CELL - size) / 2,
    y: row * CELL + (CELL - size) / 2,
    size,
  };
}

function buildLevel() {
  grid = buildGrid();
  bombs = [];
  explosions = [];
  powerups = [];

  const p = makeEntity(1, 1, PLAYER_SIZE);
  player = Object.assign(p, {
    dir: "down",
    alive: true,
    invincibleUntil: 0,
    bombRange: player ? player.bombRange : BASE_BOMB_RANGE,
    maxBombs: player ? player.maxBombs : BASE_MAX_BOMBS,
    escapeCol: null,
    escapeRow: null,
  });

  const enemyCount = Math.min(2 + level, ENEMY_SPAWNS.length);
  enemies = ENEMY_SPAWNS.slice(0, enemyCount).map(([col, row], i) => {
    if (grid[row][col] !== WALL) grid[row][col] = EMPTY;
    const e = makeEntity(col, row, ENEMY_SIZE);
    return Object.assign(e, {
      dir: randomDir(),
      alive: true,
      changeAt: 0,
      icon: ENEMY_ICONS[i % ENEMY_ICONS.length],
    });
  });
}

function newGame() {
  player = null;
  score = 0;
  lives = 3;
  level = 1;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  buildLevel();
}

function randomDir() {
  const dirs = ["up", "down", "left", "right"];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

const DIR_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function isSolidCell(col, row, ignoreEscape) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  const cell = grid[row][col];
  if (cell === WALL || cell === BLOCK) return true;
  if (
    !ignoreEscape &&
    bombs.some((b) => !b.exploded && b.col === col && b.row === row)
  ) {
    return true;
  }
  return false;
}

function canOccupy(x, y, size, isPlayer) {
  const corners = [
    [x, y],
    [x + size - 0.01, y],
    [x, y + size - 0.01],
    [x + size - 0.01, y + size - 0.01],
  ];
  return corners.every(([px, py]) => {
    const col = Math.floor(px / CELL);
    const row = Math.floor(py / CELL);
    const isEscapeCell =
      isPlayer && player.escapeCol === col && player.escapeRow === row;
    return !isSolidCell(col, row, isEscapeCell);
  });
}

function moveEntity(entity, dir, speed, isPlayer) {
  const vec = DIR_VECTORS[dir];
  if (!vec) return;
  entity.dir = dir;

  if (isPlayer && player.escapeCol !== null) {
    const cellLeft = player.escapeCol * CELL;
    const cellTop = player.escapeRow * CELL;
    const stillOverlapping =
      entity.x < cellLeft + CELL &&
      entity.x + entity.size > cellLeft &&
      entity.y < cellTop + CELL &&
      entity.y + entity.size > cellTop;
    if (!stillOverlapping) {
      player.escapeCol = null;
      player.escapeRow = null;
    }
  }

  const nx = entity.x + vec.x * speed;
  const ny = entity.y + vec.y * speed;

  if (vec.x !== 0 && canOccupy(nx, entity.y, entity.size, isPlayer)) {
    entity.x = nx;
  }
  if (vec.y !== 0 && canOccupy(entity.x, ny, entity.size, isPlayer)) {
    entity.y = ny;
  }
}

function placeBomb() {
  if (!running || paused || !player.alive) return;
  const col = Math.floor((player.x + player.size / 2) / CELL);
  const row = Math.floor((player.y + player.size / 2) / CELL);
  const activeCount = bombs.filter((b) => !b.exploded).length;
  if (activeCount >= player.maxBombs) return;
  if (bombs.some((b) => !b.exploded && b.col === col && b.row === row)) return;

  bombs.push({
    col,
    row,
    range: player.bombRange,
    placedAt: performance.now(),
    exploded: false,
  });
  player.escapeCol = col;
  player.escapeRow = row;
}

function rollPowerupType() {
  const roll = Math.random();
  if (roll < 0.4) return "range";
  if (roll < 0.8) return "bomb";
  if (roll < 0.9) return "life";
  return "invincible";
}

function explodeBomb(bomb) {
  if (bomb.exploded) return;
  bomb.exploded = true;
  const now = performance.now();
  const cells = [{ col: bomb.col, row: bomb.row }];

  Object.values(DIR_VECTORS).forEach((vec) => {
    for (let i = 1; i <= bomb.range; i++) {
      const col = bomb.col + vec.x * i;
      const row = bomb.row + vec.y * i;
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) break;
      const cell = grid[row][col];
      if (cell === WALL) break;
      cells.push({ col, row });
      if (cell === BLOCK) {
        grid[row][col] = EMPTY;
        if (Math.random() < POWERUP_DROP_CHANCE) {
          powerups.push({ col, row, type: rollPowerupType() });
        }
        break;
      }
      const chained = bombs.find(
        (b) => !b.exploded && b.col === col && b.row === row
      );
      if (chained) explodeBomb(chained);
    }
  });

  cells.forEach((c) => {
    powerups = powerups.filter((p) => !(p.col === c.col && p.row === c.row));
    explosions.push({ col: c.col, row: c.row, expiresAt: now + BLAST_MS });
  });
}

function updateBombs(now) {
  bombs.forEach((b) => {
    if (!b.exploded && now - b.placedAt >= FUSE_MS) explodeBomb(b);
  });
  bombs = bombs.filter((b) => !b.exploded || explosions.some((e) => e.col === b.col && e.row === b.row));
  explosions = explosions.filter((e) => e.expiresAt > now);
}

function entityInBlast(entity) {
  const corners = [
    [entity.x, entity.y],
    [entity.x + entity.size - 0.01, entity.y],
    [entity.x, entity.y + entity.size - 0.01],
    [entity.x + entity.size - 0.01, entity.y + entity.size - 0.01],
  ];
  return corners.some(([px, py]) => {
    const col = Math.floor(px / CELL);
    const row = Math.floor(py / CELL);
    return explosions.some((e) => e.col === col && e.row === row);
  });
}

function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + a.size > b.x &&
    a.y < b.y + b.size &&
    a.y + a.size > b.y
  );
}

function hitPlayer(now) {
  if (now < player.invincibleUntil) return;
  lives -= 1;
  livesEl.textContent = lives;
  if (lives <= 0) {
    endGame(false);
    return;
  }
  const start = makeEntity(1, 1, PLAYER_SIZE);
  player.x = start.x;
  player.y = start.y;
  player.escapeCol = null;
  player.escapeRow = null;
  player.invincibleUntil = now + INVINCIBLE_MS;
}

function updateEnemies(now) {
  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    if (now >= enemy.changeAt) {
      enemy.dir = randomDir();
      enemy.changeAt = now + 600 + Math.random() * 900;
    }
    const before = { x: enemy.x, y: enemy.y };
    moveEntity(enemy, enemy.dir, ENEMY_SPEED, false);
    if (enemy.x === before.x && enemy.y === before.y) {
      enemy.dir = randomDir();
      enemy.changeAt = now + 200;
    }

    if (entityInBlast(enemy)) {
      enemy.alive = false;
      score += 100;
      scoreEl.textContent = score;
    } else if (player.alive && aabbOverlap(enemy, player)) {
      hitPlayer(now);
    }
  });
  enemies = enemies.filter((e) => e.alive);
}

function updatePlayer(now) {
  if (!player.alive) return;
  let dir = null;
  if (keys.up) dir = "up";
  else if (keys.down) dir = "down";
  else if (keys.left) dir = "left";
  else if (keys.right) dir = "right";
  if (dir) moveEntity(player, dir, PLAYER_SPEED, true);

  if (entityInBlast(player)) {
    hitPlayer(now);
  }

  const col = Math.floor((player.x + player.size / 2) / CELL);
  const row = Math.floor((player.y + player.size / 2) / CELL);
  const picked = powerups.find((p) => p.col === col && p.row === row);
  if (picked) {
    if (picked.type === "range") {
      player.bombRange = Math.min(player.bombRange + 1, 4);
    } else if (picked.type === "bomb") {
      player.maxBombs = Math.min(player.maxBombs + 1, 3);
    } else if (picked.type === "life") {
      lives += 1;
      livesEl.textContent = lives;
    } else if (picked.type === "invincible") {
      player.invincibleUntil = now + POWERUP_INVINCIBLE_MS;
    }
    powerups = powerups.filter((p) => p !== picked);
  }
}

function drawGrass(x, y, col, row) {
  ctx.fillStyle = "#213a1f";
  ctx.fillRect(x, y, CELL, CELL);
  ctx.strokeStyle = "#3c6438";
  ctx.lineWidth = 1.5;
  const seed = (col * 31 + row * 17) % 7;
  for (let i = 0; i < 3; i++) {
    const bx = x + 6 + ((seed + i * 9) % (CELL - 12));
    const by = y + CELL - 4;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 2 + (i % 2) * 4, by - 8 - (i % 3));
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = "#1e1f26";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = grid[row][col];
      const x = col * CELL;
      const y = row * CELL;
      if (cell === WALL) {
        ctx.fillStyle = "#3a3f4d";
        ctx.fillRect(x, y, CELL, CELL);
      } else if (cell === BLOCK) {
        ctx.fillStyle = "#a05a3a";
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = "#7a4128";
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      } else {
        drawGrass(x, y, col, row);
      }
    }
  }

  ctx.font = `${CELL - 6}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  powerups.forEach((p) => {
    const c = cellCenter(p.col, p.row);
    ctx.fillText(POWERUP_ICONS[p.type], c.x, c.y);
  });

  bombs.forEach((b) => {
    if (b.exploded) return;
    const c = cellCenter(b.col, b.row);
    const pulse = Math.sin(performance.now() / 100) * 2;
    ctx.font = `${CELL - 6 + pulse}px sans-serif`;
    ctx.fillText("\u{1F4A3}", c.x, c.y);
  });

  ctx.font = `${CELL - 4}px sans-serif`;
  explosions.forEach((e) => {
    const c = cellCenter(e.col, e.row);
    ctx.fillText("\u{1F4A5}", c.x, c.y);
  });

  ctx.font = `${ENEMY_SIZE + 6}px sans-serif`;
  enemies.forEach((e) => {
    ctx.fillText(e.icon, e.x + e.size / 2, e.y + e.size / 2);
  });

  if (player.alive) {
    const now = performance.now();
    const blinking = now < player.invincibleUntil && Math.floor(now / 100) % 2 === 0;
    if (!blinking) {
      ctx.font = `${PLAYER_SIZE + 6}px sans-serif`;
      ctx.fillText(PLAYER_ICONS[playerGender], player.x + player.size / 2, player.y + player.size / 2);
    }
  }
}

function loop(timestamp) {
  if (!running || paused) return;
  const now = performance.now();
  updatePlayer(now);
  updateEnemies(now);
  updateBombs(now);
  draw();

  if (enemies.length === 0 && gameStatus === "playing") {
    endGame(true);
    return;
  }

  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function startGame() {
  newGame();
  gameStatus = "playing";
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  dpadCenter.textContent = "⏸";
  draw();
  startLoop();
}

function nextLevel() {
  level += 1;
  levelEl.textContent = level;
  buildLevel();
  gameStatus = "playing";
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  dpadCenter.textContent = "⏸";
  draw();
  startLoop();
}

function endGame(won) {
  running = false;
  gameStatus = won ? "won" : "over";
  cancelAnimationFrame(rafId);
  if (score > best) {
    best = score;
    localStorage.setItem("astro-best", best);
    bestEl.textContent = best;
  }
  if (won) {
    overlayText.innerHTML = `Level ${level} cleared &mdash; score ${score}<br>Press Enter for the next level`;
    characterSelect.classList.add("hidden");
  } else {
    overlayText.innerHTML = `Game over &mdash; score ${score}<br>Press Enter to play again`;
    characterSelect.classList.remove("hidden");
  }
  overlay.classList.remove("hidden");
  dpadCenter.textContent = "▶";
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) {
    overlayText.innerHTML = "Paused &mdash; press P to resume";
    overlay.classList.remove("hidden");
    dpadCenter.textContent = "▶";
    cancelAnimationFrame(rafId);
  } else {
    overlay.classList.add("hidden");
    dpadCenter.textContent = "⏸";
    startLoop();
  }
}

function handleEnter() {
  if (gameStatus === "won") {
    nextLevel();
  } else {
    startGame();
  }
}

const KEY_DIRS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleEnter();
    return;
  }
  if (!running && gameStatus !== "playing") {
    return;
  }
  if (e.key === " ") {
    e.preventDefault();
    placeBomb();
    return;
  }
  if (e.key === "p" || e.key === "P") {
    togglePause();
    return;
  }
  const dir = KEY_DIRS[e.key];
  if (dir) {
    e.preventDefault();
    keys[dir] = true;
  }
});

document.addEventListener("keyup", (e) => {
  const dir = KEY_DIRS[e.key];
  if (dir) keys[dir] = false;
});

const DPAD_DIRS = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
  const dir = DPAD_DIRS[btn.dataset.dir];
  const press = (e) => {
    e.preventDefault();
    keys[dir] = true;
  };
  const release = (e) => {
    e.preventDefault();
    keys[dir] = false;
  };
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});

dpadCenter.addEventListener("click", () => {
  if (!running && gameStatus !== "playing") {
    handleEnter();
  } else {
    togglePause();
  }
});

bombBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  placeBomb();
});

const charButtons = document.querySelectorAll(".char-btn");
charButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    playerGender = btn.dataset.gender;
    charButtons.forEach((b) => b.classList.toggle("selected", b === btn));
    startGame();
  });
});
charButtons[0].classList.add("selected");

gameStatus = "ready";
running = false;
paused = false;
newGame();
draw();
