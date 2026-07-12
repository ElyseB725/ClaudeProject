require("dotenv").config();

const express = require("express");
const path = require("path");

const countries = require("./server/countries");
const { CATEGORIES, KIDS_TAG } = require("./server/categories");
const cache = require("./server/cache");
const gemini = require("./server/geminiClient");
const villageStore = require("./server/villageStore");
const routePlanner = require("./server/routePlanner");

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "Missing GEMINI_API_KEY — copy .env.example to .env and add your key from https://aistudio.google.com/apikey"
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function sendError(res, err) {
  const status = err.status || 500;
  const message = err.message || "Something went wrong, please try again.";
  console.error(err);
  res.status(status).json({ error: message });
}

function findCountry(name) {
  return countries.find((c) => c.name.toLowerCase() === String(name || "").trim().toLowerCase());
}

app.get("/api/countries", (req, res) => {
  res.json({ countries });
});

app.get("/api/categories", (req, res) => {
  res.json({ categories: CATEGORIES, kidsTag: KIDS_TAG });
});

app.get("/api/villages", async (req, res) => {
  const country = findCountry(req.query.country);
  if (!country) return res.status(400).json({ error: "Unknown country." });
  if (!country.supported) {
    return res.status(400).json({ error: `${country.name} isn't supported yet — only France works right now.` });
  }

  const cacheKey = `villages:${country.name}`;
  try {
    let villages = cache.get(cacheKey);
    if (!villages) {
      villages = await gemini.generateVillageList(country.name);
      cache.set(cacheKey, villages);
    }
    res.json({ country: country.name, villages });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/village-data", async (req, res) => {
  const country = findCountry(req.query.country);
  const villageName = (req.query.village || "").trim();
  if (!country) return res.status(400).json({ error: "Unknown country." });
  if (!country.supported) {
    return res.status(400).json({ error: `${country.name} isn't supported yet — only France works right now.` });
  }
  if (!villageName) return res.status(400).json({ error: "Missing village." });

  try {
    const village = await villageStore.getVillage(country.name, country.code, villageName);
    res.json({ village });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/route", async (req, res) => {
  const {
    country: countryName,
    village: villageName,
    selectedPlaceIds = [],
    startPoint = { type: "station" },
    people = 1,
    hoursPerDay = 8,
    plannedDays = 1,
    departureCity = "",
    budgetInputs = {},
  } = req.body || {};

  const country = findCountry(countryName);
  if (!country || !country.supported) {
    return res.status(400).json({ error: "Unknown or unsupported country." });
  }
  if (!villageName) return res.status(400).json({ error: "Missing village." });
  if (!Array.isArray(selectedPlaceIds) || selectedPlaceIds.length === 0) {
    return res.status(400).json({ error: "Select at least one place." });
  }

  try {
    const village = await villageStore.getVillage(country.name, country.code, villageName);

    const selectedSet = new Set(selectedPlaceIds);
    const places = village.places.filter((p) => selectedSet.has(p.id));
    if (places.length === 0) {
      return res.status(400).json({ error: "None of the selected places were found for this village." });
    }

    let start;
    if (startPoint.type === "hotel") {
      const hotel = village.hotels.find((h) => h.id === startPoint.hotelId);
      if (!hotel) return res.status(400).json({ error: "Selected hotel not found for this village." });
      start = { lat: hotel.lat, lon: hotel.lon };
    } else if (startPoint.type === "landmark") {
      const landmark = village.places.find((p) => p.isLandmark) || village.places[0];
      start = { lat: landmark.lat, lon: landmark.lon };
    } else {
      start = { lat: village.station.lat, lon: village.station.lon };
    }

    const routeStops = routePlanner.buildRoute(places, start);
    const { days, estimatedDays } = routePlanner.splitIntoDays(routeStops, Number(hoursPerDay) || 8);

    const entryFeesRaw = places.reduce((sum, p) => sum + p.entryPrice, 0);
    const budget = routePlanner.computeBudget({
      entryFeesRaw,
      people: Number(people) || 1,
      plannedDays: Number(plannedDays) || 1,
      lunchPerPerson: Number(budgetInputs.lunchPerPerson ?? 20),
      dessertPerPerson: Number(budgetInputs.dessertPerPerson ?? 8),
      trainTicket: Number(budgetInputs.trainTicket ?? 0),
      departureCity,
      hotelPerNight: Number(budgetInputs.hotelPerNight ?? 90),
    });

    res.json({
      days,
      estimatedDays,
      warning: estimatedDays > (Number(plannedDays) || 1),
      budget,
    });
  } catch (err) {
    sendError(res, err);
  }
});

app.listen(PORT, () => {
  console.log(`Trip planner running at http://localhost:${PORT}`);
});
