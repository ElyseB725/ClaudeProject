# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repository currently contains four unrelated projects side by side:

- **`snake-game/`** — a standalone, dependency-free browser Snake game (HTML/CSS/JS).
- **`astro-blast/`** — a standalone, dependency-free browser bomb-em-up (HTML/CSS/JS). See `astro-blast/CLAUDE.md` for details.
- **`trip-planner/`** — a Node.js/Express + AI-assisted Europe trip-planning web app. See `trip-planner/CLAUDE.md` for details.
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

## Astro Blast (`astro-blast/`)

Plain static site: `index.html`, `style.css`, `script.js`, no build step, no dependencies, no bundler. An astronaut drops bombs to clear destructible bricks and take out wandering aliens.

- **Run it**: open `astro-blast/index.html` directly in a browser, or serve the folder with any static file server (e.g. `npx serve astro-blast`).
- **Architecture**: continuous pixel-based movement via `requestAnimationFrame`, unlike Snake's grid-tick `setInterval` loop — see `astro-blast/CLAUDE.md` for the full breakdown (grid generation, bomb/explosion/chain-reaction logic, enemy AI, power-ups).

## Trip planner (`trip-planner/`)

Node.js/Express app that plans a walking trip in a French village: pick places to visit, choose a starting point, get an auto-generated walking route (split across multiple days if needed) plus a budget breakdown. Village data (places, prices, durations, GPS) is AI-drafted via the Gemini API, verified/enriched against Wikipedia's public REST API for real photos and facts, and then permanently cached to a JSON file per village the first time it's requested — the route and budget math itself is plain deterministic logic, not AI. Needs a backend (unlike `snake-game/`) because the Gemini API key can't be exposed to the browser, and because the route/budget math must run against trusted, stored data. Full architecture and conventions are documented in `trip-planner/CLAUDE.md` — read that before working in this folder.

- **Install**: `npm install` (inside `trip-planner/`)
- **Configure**: copy `trip-planner/.env.example` to `trip-planner/.env` and set `GEMINI_API_KEY`
- **Run**: `npm start` inside `trip-planner/`, then open `http://localhost:3000`

## Spring Boot skeleton (`pom.xml`, `src/`)

Standard Maven Wrapper project (Maven 3.9.16 via `.mvn/wrapper`).

- **Run**: `./mvnw spring-boot:run` (or `mvnw.cmd spring-boot:run` on Windows)
- **Build**: `./mvnw package`
- **Run all tests**: `./mvnw test`
- **Run a single test**: `./mvnw test -Dtest=ClaudeProjectApplicationTests#contextLoads`

There is no controller, service, or repository code yet — just the default `ClaudeProjectApplication` main class and a placeholder `contextLoads()` test. Treat this as an empty scaffold rather than an established architecture to follow.
