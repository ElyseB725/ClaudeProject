// Simple in-memory cache with a time-to-live, so repeated identical queries
// (e.g. two users both picking "France") don't re-hit Gemini's rate limit.
const store = new Map();

const DAY_MS = 24 * 60 * 60 * 1000;

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs = DAY_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

module.exports = { get, set };
