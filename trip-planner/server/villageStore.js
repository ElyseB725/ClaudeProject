const fs = require("fs/promises");
const path = require("path");

const gemini = require("./geminiClient");
const wikipedia = require("./wikipedia");

const DATA_DIR = path.join(__dirname, "..", "data", "villages");
const PRICE_LABELS = ["Free", "Included", "Open access"];

const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePrice(price) {
  if (typeof price === "number" && !Number.isNaN(price)) {
    return { entryPrice: price, entryPriceLabel: null };
  }
  if (typeof price === "string") {
    const match = PRICE_LABELS.find((label) => label.toLowerCase() === price.trim().toLowerCase());
    if (match) return { entryPrice: 0, entryPriceLabel: match };
  }
  return { entryPrice: 0, entryPriceLabel: null };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function enrichPlace(draft, index, slug, village) {
  const summary = await wikipedia.findVerifiedSummary(draft.name, draft.lat, draft.lon, village).catch(() => null);
  const { entryPrice, entryPriceLabel } = normalizePrice(draft.price);

  return {
    id: `${slug}-place-${index + 1}`,
    name: draft.name,
    description: summary?.description || draft.description || "",
    whyVisit: draft.whyVisit || "",
    categories: Array.isArray(draft.categories) ? draft.categories : [],
    kidFriendly: Boolean(draft.kidFriendly),
    entryPrice,
    entryPriceLabel,
    durationMinutes: Number(draft.durationMinutes) || 30,
    lat: summary?.coordinates?.lat ?? draft.lat,
    lon: summary?.coordinates?.lon ?? draft.lon,
    photoUrl: summary?.photoUrl || null,
    sourceUrl: summary?.sourceUrl || null,
    isLandmark: Boolean(draft.isLandmark),
    verified: false,
  };
}

async function enrichHotel(draft, index, slug, village) {
  const summary = await wikipedia.findVerifiedSummary(draft.name, draft.lat, draft.lon, village).catch(() => null);
  return {
    id: `${slug}-hotel-${index + 1}`,
    name: draft.name,
    lat: summary?.coordinates?.lat ?? draft.lat,
    lon: summary?.coordinates?.lon ?? draft.lon,
    photoUrl: summary?.photoUrl || null,
    verified: false,
  };
}

function ensureSingleLandmark(places) {
  const landmarks = places.filter((p) => p.isLandmark);
  if (landmarks.length === 1) return places;

  return places.map((p, i) => ({ ...p, isLandmark: i === 0 }));
}

async function generateVillage(country, countryCode, village, slug) {
  const [draft, hotelDrafts] = await Promise.all([
    gemini.generateVillageDraft(country, village),
    gemini.generateHotelDrafts(country, village),
  ]);

  const places = ensureSingleLandmark(
    await mapWithConcurrency(draft.places, 5, (p, i) => enrichPlace(p, i, slug, village))
  );
  const hotels = await mapWithConcurrency(hotelDrafts, 5, (h, i) => enrichHotel(h, i, slug, village));

  return {
    country,
    countryCode,
    name: village,
    slug,
    generatedAt: new Date().toISOString(),
    station: draft.station || { name: `${village} station`, lat: places[0]?.lat, lon: places[0]?.lon },
    places,
    hotels,
  };
}

async function writeVillageFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}

const inFlight = new Map();

async function getVillage(country, countryCode, village) {
  const slug = slugify(village);
  const filePath = path.join(DATA_DIR, countryCode, `${slug}.json`);
  const key = `${countryCode}:${slug}`;

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const data = await generateVillage(country, countryCode, village, slug);
    await writeVillageFile(filePath, data);
    return data;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

module.exports = { getVillage, slugify };
