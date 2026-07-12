// Looks up a real photo + factual description for a named place via Wikipedia's
// free public REST API. No API key, no rate-limit concerns for this usage level.
const { haversineDistanceKm } = require("./routePlanner");

const USER_AGENT = "trip-planner/1.0 (personal hobby project)";
// A fuzzy search match is only trusted if it's roughly where the place should be —
// otherwise Wikipedia search happily returns a same-named place in a different city.
const MATCH_DISTANCE_KM = 15;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries on network failures and on transient HTTP statuses (429 rate-limited,
// 5xx server hiccups) — Wikipedia's free API occasionally blips under bursty load.
async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(300 * (attempt + 1));
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(300 * (attempt + 1));
      continue;
    }

    return res;
  }
}

async function getSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  let res;
  try {
    res = await fetchWithRetry(url);
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = await res.json();
  if (data.type === "disambiguation") return null;

  return {
    title: data.title || null,
    photoUrl: data.thumbnail?.source || null,
    description: data.extract || null,
    sourceUrl: data.content_urls?.desktop?.page || null,
    coordinates: data.coordinates ? { lat: data.coordinates.lat, lon: data.coordinates.lon } : null,
  };
}

async function searchTitle(query) {
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`;

  let res;
  try {
    res = await fetchWithRetry(url);
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = await res.json();
  return data.pages?.[0]?.title || null;
}

function normalize(text) {
  return (text || "").trim().toLowerCase();
}

// Exact-title lookup first (trustworthy, since it's not fuzzy). If that misses
// (common — AI-drafted names often don't match a Wikipedia title verbatim), fall
// back to search, but only trust the result if its real coordinates are close to
// where the place is supposed to be, to avoid attaching a wrong-city photo. Also
// rejects a match that resolves to the village/city's own overview page (search
// often falls back to that for obscure local places, which is misleadingly generic).
async function findVerifiedSummary(name, nearLat, nearLon, villageName) {
  const excluded = normalize(villageName);

  const direct = await getSummary(name);
  if (direct && normalize(direct.title) !== excluded) return direct;

  const resolvedTitle = await searchTitle(name);
  if (!resolvedTitle || normalize(resolvedTitle) === excluded) return null;

  const candidate = await getSummary(resolvedTitle);
  if (!candidate || !candidate.coordinates) return null;
  if (normalize(candidate.title) === excluded) return null;

  const distanceKm = haversineDistanceKm(candidate.coordinates, { lat: nearLat, lon: nearLon });
  return distanceKm <= MATCH_DISTANCE_KM ? candidate : null;
}

module.exports = { getSummary, findVerifiedSummary };
