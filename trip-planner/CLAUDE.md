# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A mobile-friendly web app that plans a walking trip in a French city or village: pick a village → check off the tourist places you want to see, filtered by category → choose a starting point (station, hotel, or the village's main landmark) → get an auto-generated walking route (nearest-neighbor ordering, split across multiple days if needed) with a detailed budget breakdown (entry fees, meals, train, hotel).

This needs a backend (unlike a purely static site), for two reasons: the Gemini API key must never reach the browser, and the route/budget math has to run server-side against trusted, stored data rather than whatever a client claims.

## Commands

- **Install**: `npm install` (run inside `trip-planner/`)
- **Configure**: copy `.env.example` to `.env` and set `GEMINI_API_KEY` (get a free key at https://aistudio.google.com/apikey)
- **Run**: `npm start` (runs `node server.js`), then open `http://localhost:3000` (or the `PORT` set in `.env`)
- No build step, no test suite, no linter configured yet.

## Architecture

### Data sourcing: AI-drafted, Wikipedia-verified, then permanently cached

Prices, visit durations, and GPS coordinates feed directly into the budget total and route timing shown to the user as real numbers, so they can't be treated as casually as freeform AI text:

- **`server/geminiClient.js`** drafts a village's data — `generateVillageDraft()` returns the station coordinate plus 15-25 named places (categories, estimated price, estimated duration, approximate coordinates, one flagged `isLandmark`), and `generateHotelDrafts()` returns a small hotel list. All calls use `responseMimeType: "application/json"` with an explicit "respond with ONLY valid JSON matching this shape" instruction, via the shared `generateJson()` helper.
- **`server/wikipedia.js`** looks up each named place/hotel on Wikipedia's public `page/summary` endpoint. Where Wikipedia has a real photo, description, or coordinates, those override the AI's draft values — the AI is never trusted alone for the fields that carry through to money/time totals.
- **`server/villageStore.js`** ties this together: `getVillage(country, countryCode, village)` reads `data/villages/<countryCode>/<slug>.json` if it already exists; if not, it generates + enriches the data as above, writes it to that file (atomically — write `.tmp` then rename), and returns it. Every subsequent request for that village reads the file directly — no repeat AI calls, and the numbers stay consistent for a given village over time. A village is only ever generated once, on its first real request (lazy seeding), rather than pre-built for all of France. Every place/hotel record carries `verified: false`, since the underlying prices/durations are AI estimates, not fact-checked — this is intentional and documented, not a bug. These JSON files are committed to git; they *are* the curated database, just AI-seeded instead of hand-typed, and are meant to be readable/correctable by a human later.
- **`server/categories.js`** is a small fixed, static list (monuments, museums/art, nature/walks, local crafts, restaurants, bars, shows) — no AI call, since this never changes. Kid-friendliness is a separate cross-cutting tag (`kidsTag`), not one of these categories — a place can be `kidFriendly: true` in addition to its normal category.

### Route + budget: pure logic, no AI, no network

**`server/routePlanner.js`** has no dependency on Gemini or Wikipedia — it's deterministic math over whatever places the user selected:
- `buildRoute()` — nearest-neighbor greedy ordering by straight-line (Haversine) distance from the chosen starting point. No real pedestrian routing; this matches the original single-village prototype's approach and is a deliberate v1 simplification.
- `splitIntoDays()` — sequential bucketing: keeps adding stops to the current day until the next one would exceed the user's hours-per-day budget, then starts a new day. This does **not** recompute a new geographically-optimal route per day (explicitly deferred, per the original requirements doc) — it's a simple sequential split of the single generated route.
- `computeBudget()` — implements the confirmed formula: entry fees + meals + train are each × number of people; meals are also × planned days (you eat every day of the trip); hotel is × nights (`plannedDays - 1`, minimum 0, i.e. 0€ for a single-day trip) since it's a per-room cost, not per-person. Returns a pre-rendered formula string alongside the numbers so the UI never has to recompute or risk showing a formula that doesn't match the total.

**`server.js`**'s `POST /api/route` handler never trusts client-sent prices or coordinates — it re-reads the authoritative village file via `villageStore.getVillage()` and resolves the client's selected place IDs against it before running the route/budget math.

### Frontend

`public/index.html` has four `<section>` views (`#view-setup`, `#view-places`, `#view-start`, `#view-results`) toggled by `app.js` via a `.hidden` class — no router, no framework, matching the project's established plain-JS convention. `app.js` keeps module-level state (`tripSetup`, `villageData`, `selectedPlaceIds` as a `Set`, `selectedHotelId`) and a `history` array driving the back button. Each of the last three views fetches or computes its data when navigated into.

### Explicitly out of scope for now

- The "local specialties" section is a static placeholder in the UI — deliberately **not** AI-generated, since the original requirements explicitly call out that this needs real local curation with no reliable automatic source.
- Excel export, emailing the itinerary, per-day geographic route recalculation, and multi-village trips are all deferred.
- Countries other than France aren't wired up yet — `server/countries.js` has a `supported` flag per country (only France is `true`) so the structure is ready to extend without a schema change.

## Conventions

- Keep the "AI drafts, Wikipedia verifies, then it's permanently cached to a file" pipeline intact for any new AI-sourced data — don't let AI output reach the budget/route math without going through this path, and don't switch village data back to being regenerated on every request.
- New Gemini prompts should keep the "ONLY valid JSON matching this exact shape" pattern used in `geminiClient.js`.
- `server/routePlanner.js` should stay free of AI/network calls — it's meant to be simple, deterministic, and easy to hand-check.
- This is v1: minimal error handling (friendly message + retry button), no user accounts, no deployment config yet. Don't add those without discussing first.
