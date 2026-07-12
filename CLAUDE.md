# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repository currently contains two unrelated projects side by side:

- **`snake-game/`** — a standalone, dependency-free browser Snake game (HTML/CSS/JS). This is where all actual development has happened so far.
- **Spring Boot skeleton** (`pom.xml`, `src/`) — a generated, untouched Spring Boot 4.1.0 / Java 26 project (`com.claude.test.claudeproject`). It has no application code beyond the default `@SpringBootApplication` entry point and has not been modified since the initial commit.

When making changes, check which project the request actually concerns — they don't share code or build tooling.

## Snake game (`snake-game/`)

Plain static site: `index.html`, `style.css`, `script.js`, no build step, no dependencies, no bundler.

- **Run it**: open `snake-game/index.html` directly in a browser, or serve the folder with any static file server (e.g. `npx serve snake-game`).
- **Architecture**: all game state and logic lives in `script.js` as module-level variables (`snake`, `direction`, `food`, `score`, etc.) manipulated by a small set of functions:
  - `resetState()` / `placeFood()` set up a new game.
  - `step()` advances the game one tick (movement, collision, food pickup) and is driven by `setInterval` in `restartTimer()`; interval speed decreases as score increases.
  - `draw()` renders the whole board to the `<canvas>` each tick — there is no diffing, the canvas is fully redrawn.
  - Input is unified through `requestDirection(dir)`, called from both keyboard handlers (arrow keys / WASD) and the on-screen `.dpad-btn` touch controls, so keyboard and touch share the same direction/reverse-prevention logic.
  - Best score persists via `localStorage` (`snake-best`).

## Spring Boot skeleton (`pom.xml`, `src/`)

Standard Maven Wrapper project (Maven 3.9.16 via `.mvn/wrapper`).

- **Run**: `./mvnw spring-boot:run` (or `mvnw.cmd spring-boot:run` on Windows)
- **Build**: `./mvnw package`
- **Run all tests**: `./mvnw test`
- **Run a single test**: `./mvnw test -Dtest=ClaudeProjectApplicationTests#contextLoads`

There is no controller, service, or repository code yet — just the default `ClaudeProjectApplication` main class and a placeholder `contextLoads()` test. Treat this as an empty scaffold rather than an established architecture to follow.
