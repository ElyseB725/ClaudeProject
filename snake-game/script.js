const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const dpadCenter = document.getElementById("dpad-center");

const CELL = 20;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const START_SPEED_MS = 130;

let snake, direction, nextDirection, food, score, best, speed, timer, running, paused;

best = Number(localStorage.getItem("snake-best") || 0);
bestEl.textContent = best;

function resetState() {
  snake = [
    { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
    { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
    { x: Math.floor(COLS / 2) - 2, y: Math.floor(ROWS / 2) },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  score = 0;
  speed = START_SPEED_MS;
  scoreEl.textContent = score;
  placeFood();
  running = false;
  paused = false;
}

function placeFood() {
  let candidate;
  do {
    candidate = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === candidate.x && s.y === candidate.y));
  food = candidate;
}

function draw() {
  ctx.fillStyle = "#1e1f26";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff5f5f";
  ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);

  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? "#7CFC00" : "#4caf20";
    ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

function step() {
  if (paused) return;

  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = snake.some((seg) => seg.x === head.x && seg.y === head.y);

  if (hitWall || hitSelf) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    placeFood();
    if (speed > 60) {
      speed -= 3;
      restartTimer();
    }
  } else {
    snake.pop();
  }

  draw();
}

function restartTimer() {
  clearInterval(timer);
  timer = setInterval(step, speed);
}

function gameOver() {
  running = false;
  clearInterval(timer);
  if (score > best) {
    best = score;
    localStorage.setItem("snake-best", best);
    bestEl.textContent = best;
  }
  overlayText.innerHTML = `Game over &mdash; score ${score}<br>Press Enter to play again`;
  overlay.classList.remove("hidden");
}

function startGame() {
  resetState();
  draw();
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  dpadCenter.textContent = "⏸";
  restartTimer();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  overlayText.innerHTML = "Paused &mdash; press Space to resume";
  overlay.classList.toggle("hidden", !paused);
  dpadCenter.textContent = paused ? "▶" : "⏸";
}

function requestDirection(dir) {
  if (!running) {
    startGame();
    return;
  }
  const isReverse = dir.x === -direction.x && dir.y === -direction.y;
  if (!isReverse) nextDirection = dir;
}

const KEY_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    startGame();
    return;
  }

  if (!running) {
    if (KEY_DIRECTIONS[e.key]) startGame();
    return;
  }

  if (e.key === " ") {
    e.preventDefault();
    togglePause();
    return;
  }

  const dir = KEY_DIRECTIONS[e.key];
  if (!dir) return;

  requestDirection(dir);
});

const DPAD_DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => {
    requestDirection(DPAD_DIRECTIONS[btn.dataset.dir]);
  });
});

dpadCenter.addEventListener("click", () => {
  if (!running) {
    startGame();
  } else {
    togglePause();
  }
});

resetState();
draw();
