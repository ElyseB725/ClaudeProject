# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A standalone, dependency-free browser bomb-em-up: `index.html`, `style.css`, `script.js`. No build step, no bundler, no package manager, no tests. An astronaut drops bombs to clear destructible bricks and take out wandering aliens, similar in spirit to classic Bomberman/Dyna Blaster games but original content.

## Commands

- **Run it**: open `index.html` directly in a browser, or serve the folder with any static file server (e.g. `npx serve .` from within `astro-blast/`).
- There is no build, lint, or test tooling in this project — edits to `script.js`/`style.css`/`index.html` take effect on page reload.

## Architecture

Unlike `snake-game/` (grid-tick movement driven by `setInterval`), this game uses continuous pixel-based movement driven by `requestAnimationFrame` in `loop()`, because Bomberman-style movement needs to feel smooth rather than snapping cell-to-cell.

- **Grid**: `grid[row][col]` holds `EMPTY` / `WALL` (indestructible, border + even/even pillars) / `BLOCK` (destructible). `buildGrid()` generates a fresh random layout each level; `buildLevel()` clears a safe zone around the player start and places enemies from `ENEMY_SPAWNS`. `EMPTY` cells are drawn with a grass texture (`drawGrass()`) — the blade positions are derived from `col`/`row` (not `Math.random()`) so they stay put frame to frame instead of flickering.
- **Movement**: entities have pixel `x`/`y` plus a `size` smaller than `CELL`, so gaps are forgiving. `canOccupy()` checks all four bounding-box corners against `isSolidCell()` (walls, blocks, and armed bombs all block movement). `moveEntity()` moves the X and Y axes independently so entities can slide along walls.
- **Bomb escape exception**: when the player drops a bomb, `player.escapeCol`/`escapeRow` records that cell so the player can still walk off it; the exception clears itself once the player's bounding box leaves that cell. This is the one case where a bomb doesn't block movement.
- **Bombs/explosions**: `placeBomb()` queues a bomb (capped by `player.maxBombs`); `updateBombs()` triggers `explodeBomb()` after `FUSE_MS`. Explosion cells are computed per direction, stopping at a `WALL`, stopping (but still triggering) at the first `BLOCK`, and chain-reacting into any other armed bomb in the blast path. Cells are pushed into `explosions` with an expiry timestamp; `entityInBlast()` checks a bounding box against currently active explosion cells every frame, so both instant and lingering blast damage are handled the same way.
- **Enemies**: simple random-walk AI (`updateEnemies()`) — each enemy picks a random cardinal direction periodically or immediately after bumping into something solid. No pathfinding, so blocks placed between the player and an enemy genuinely provide cover. Each enemy is assigned a distinct emoji from `ENEMY_ICONS` (by spawn index) at creation, purely cosmetic.
- **Character select**: `#character-select` (two buttons in the start/game-over overlay) sets `playerGender` and calls `startGame()` in one click; `PLAYER_ICONS` maps `"boy"`/`"girl"` to the rendered emoji. The keyboard/Enter path still works without touching these buttons — it just uses whatever `playerGender` was last set to (default `"boy"`). Hidden on the "level cleared" overlay (`endGame(true)`) since the run continues with the same character; shown again on game over.
- **Power-ups**: destroying a `BLOCK` has a `POWERUP_DROP_CHANCE` chance to drop one, picked up by walking over its cell. `rollPowerupType()` weights the four kinds: `range`/`bomb` (raise `player.bombRange`/`player.maxBombs`, capped) are common; `life` (+1 life) and `invincible` (sets `player.invincibleUntil` `POWERUP_INVINCIBLE_MS` out — the same field `hitPlayer()` already checks for respawn grace, so no separate immortality flag was needed) are rarer. `BLOCK_DENSITY` controls how many interior cells become bricks.
- **Game flow**: `newGame()` resets score/lives/level; `nextLevel()` keeps score/lives and regenerates the grid with one more enemy (capped by `ENEMY_SPAWNS.length`); `endGame(won)` shows the overlay and persists best score. `gameStatus` (`ready`/`playing`/`won`/`over`) plus `running`/`paused` gate the render loop.
- Movement input is unified through the `keys` object (`up`/`down`/`left`/`right` booleans) set by both keyboard (`keydown`/`keyup` via `KEY_DIRS`) and the on-screen `.dpad-btn` touch controls (via `pointerdown`/`pointerup`, so holding a button moves continuously like a held key). The bomb button and the Space key both call `placeBomb()` directly.
- Best score persists across sessions via `localStorage` (`astro-best`).
