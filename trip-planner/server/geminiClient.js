const { GoogleGenAI } = require("@google/genai");
const { CATEGORIES } = require("./categories");

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const CATEGORY_IDS = CATEGORIES.map((c) => c.id).join(", ");

let client;
function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

class GeminiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function generateJson(prompt) {
  let response;
  try {
    response = await getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
  } catch (err) {
    const message = String(err?.message || "");
    if (err?.status === 429 || /429|resource_exhausted|quota|rate.?limit/i.test(message)) {
      throw new GeminiError(
        "The free AI quota for today has been used up. Please wait for it to reset (usually within a day) and try again.",
        429
      );
    }
    throw new GeminiError("Could not reach the AI service, please try again.", 502);
  }

  const text = response.text;
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError("Could not generate results, please try again.", 502);
  }
}

async function generateVillageList(country) {
  const prompt = `List 25 to 35 real, well-known touristic cities or villages to visit in ${country}, Europe.
Cover a wide variety: major cities, historic towns, and small scenic villages, spread across different regions
of the country, not just the single most famous handful.
Respond with ONLY valid JSON, no markdown fences, no extra text, matching exactly this shape:
[{ "name": string, "description": string }]
Each "description" must be a single factual sentence about why the place is worth visiting.`;

  const data = await generateJson(prompt);
  if (!Array.isArray(data)) throw new GeminiError("Could not generate results, please try again.");
  return data.filter((c) => c && typeof c.name === "string");
}

async function generateVillageDraft(country, village) {
  const prompt = `For the town/village of ${village} in ${country}, provide walking-trip planning data.

Respond with ONLY valid JSON, no markdown fences, no extra text, matching exactly this shape:
{
  "station": { "name": string, "lat": number, "lon": number },
  "places": [
    {
      "name": string,
      "description": string,
      "whyVisit": string,
      "categories": string[],
      "kidFriendly": boolean,
      "price": number or one of "Free", "Included", "Open access",
      "durationMinutes": number,
      "lat": number,
      "lon": number,
      "isLandmark": boolean
    }
  ]
}

Rules:
- "station" is the main train or bus station serving the town, with real approximate coordinates.
- Include 15 to 25 real, named touristic places in or very near the town.
- "categories" must only contain values from this fixed list: ${CATEGORY_IDS}. Use one or more per place.
- "kidFriendly" is a separate flag, true only if the place is especially suited to children; it is not one of "categories".
- "price" is the entry price in euros as a number, or one of "Free"/"Included"/"Open access" if there is no numeric entry fee.
- "durationMinutes" is a realistic estimated visit duration.
- "lat"/"lon" must be real approximate coordinates for that specific place.
- Exactly ONE place in the whole list must have "isLandmark": true — the single most iconic, must-see place in the town. All others must have "isLandmark": false.`;

  const data = await generateJson(prompt);
  if (!data || !Array.isArray(data.places)) {
    throw new GeminiError("Could not generate results, please try again.");
  }
  return data;
}

async function generateHotelDrafts(country, village) {
  const prompt = `List 3 to 6 real hotels located in or very near ${village}, ${country}.
Respond with ONLY valid JSON, no markdown fences, no extra text, matching exactly this shape:
[{ "name": string, "lat": number, "lon": number }]
"lat"/"lon" must be real approximate coordinates for each hotel.`;

  const data = await generateJson(prompt);
  if (!Array.isArray(data)) throw new GeminiError("Could not generate results, please try again.");
  return data.filter((h) => h && typeof h.name === "string");
}

module.exports = { generateVillageList, generateVillageDraft, generateHotelDrafts, GeminiError };
