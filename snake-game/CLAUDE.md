# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A standalone, dependency-free browser Snake game: `index.html`, `style.css`, `script.js`. No build step, no bundler, no package manager, no tests.

## Commands

- **Run it**: open `index.html` directly in a browser, or serve the folder with any static file server (e.g. `npx serve .` from within `snake-game/`).
- There is no build, lint, or test tooling in this project — edits to `script.js`/`style.css`/`index.html` take effect on page reload.

## Architecture

All game state and logic lives in `script.js` as module-level variables (`snake`, `direction`, `nextDirection`, `food`, `score`, `best`, `speed`, `timer`, `running`, `paused`), manipulated by a small set of functions:

- `resetState()` / `placeFood()` set up a new game and pick a food cell that doesn't overlap the snake.
- `step()` advances the game one tick: applies `nextDirection`, checks wall/self collision, grows or moves the snake, and awards score. It's driven by `setInterval` in `restartTimer()`; interval speed decreases (game speeds up) as score increases, and `restartTimer()` is called again each time speed changes.
- `draw()` renders the whole board to the `<canvas>` every tick — full redraw, no diffing.
- `requestDirection(dir)` is the single entry point for direction changes, called from both the keyboard handler (arrow keys / WASD, via the `KEY_DIRECTIONS` map) and the on-screen `.dpad-btn` touch controls (via the `DPAD_DIRECTIONS` map). It blocks 180° reversals and auto-starts the game on first input.
- `startGame()` / `gameOver()` / `togglePause()` manage the `running`/`paused` flags and the `#overlay` UI (start prompt, pause message, game-over message).
- Best score persists across sessions via `localStorage` (`snake-best`).

Keyboard and touch controls are unified through the same `requestDirection`/direction-map pattern — when adding a new input method, follow that pattern rather than duplicating movement logic.
