const views = {
  setup: document.getElementById("view-setup"),
  places: document.getElementById("view-places"),
  start: document.getElementById("view-start"),
  results: document.getElementById("view-results"),
};

const statusEl = document.getElementById("status");
const backBtn = document.getElementById("back-btn");

// Setup screen
const countrySelect = document.getElementById("country-select");
const villageInput = document.getElementById("village-input");
const villageOptionsEl = document.getElementById("village-options");
const departureCityInput = document.getElementById("departure-city");
const peopleMinusBtn = document.getElementById("people-minus");
const peoplePlusBtn = document.getElementById("people-plus");
const peopleValueEl = document.getElementById("people-value");
const hoursPerDayInput = document.getElementById("hours-per-day");
const plannedDaysInput = document.getElementById("planned-days");
const setupNextBtn = document.getElementById("setup-next-btn");

// Places screen
const placesVillageName = document.getElementById("places-village-name");
const categoryChipsEl = document.getElementById("category-chips");
const placeListEl = document.getElementById("place-list");
const placesNextBtn = document.getElementById("places-next-btn");

// Start screen
const stationNameHint = document.getElementById("station-name-hint");
const hotelSublist = document.getElementById("hotel-sublist");
const generateBtn = document.getElementById("generate-btn");

// Results screen
const resultsVillageName = document.getElementById("results-village-name");
const warningBanner = document.getElementById("warning-banner");
const estimatedDaysLine = document.getElementById("estimated-days-line");
const daysListEl = document.getElementById("days-list");
const budgetPanelEl = document.getElementById("budget-panel");

let allCategories = [];
let kidsTag = null;
let villageData = null;
let selectedPlaceIds = new Set();
let selectedCategoryFilters = new Set();
let selectedHotelId = null;

const tripSetup = {
  country: null,
  village: "",
  departureCity: "Paris",
  people: 1,
  hoursPerDay: 8,
  plannedDays: 1,
};

const history = ["setup"];

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  backBtn.classList.toggle("hidden", name === "setup");
  clearStatus();
}

function goBack() {
  if (history.length <= 1) return;
  history.pop();
  showView(history[history.length - 1]);
}

function navigateTo(name) {
  history.push(name);
  showView(name);
}

backBtn.addEventListener("click", goBack);

function setStatus(text, isError = false, onRetry = null) {
  statusEl.classList.remove("hidden");
  statusEl.classList.toggle("error", isError);
  statusEl.textContent = "";
  statusEl.append(text);
  if (isError && onRetry) {
    const btn = document.createElement("button");
    btn.className = "retry-btn";
    btn.type = "button";
    btn.textContent = "Try again";
    btn.addEventListener("click", onRetry);
    statusEl.appendChild(btn);
  }
}

function clearStatus() {
  statusEl.classList.add("hidden");
  statusEl.textContent = "";
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong, please try again.");
  }
  return data;
}

// ---- Setup screen ----

async function loadCountries() {
  setStatus("Loading countries…");
  try {
    const data = await fetchJson("/api/countries");
    clearStatus();
    countrySelect.innerHTML = "";
    data.countries.forEach((country) => {
      const opt = document.createElement("option");
      opt.value = country.name;
      opt.textContent = `${country.flag} ${country.name}${country.supported ? "" : " (coming soon)"}`;
      opt.disabled = !country.supported;
      countrySelect.appendChild(opt);
    });
    const france = data.countries.find((c) => c.supported);
    if (france) {
      countrySelect.value = france.name;
      loadVillages(france.name);
    }
  } catch (err) {
    setStatus(err.message, true, loadCountries);
  }
}

async function loadVillages(countryName) {
  villageInput.disabled = true;
  villageInput.value = "";
  villageInput.placeholder = "Loading suggestions…";
  villageOptionsEl.innerHTML = "";
  updateSetupNextEnabled();
  try {
    const data = await fetchJson(`/api/villages?country=${encodeURIComponent(countryName)}`);
    data.villages.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.label = v.description || "";
      villageOptionsEl.appendChild(opt);
    });
    villageInput.placeholder = "Pick a suggestion or type any city/village…";
    villageInput.disabled = false;
  } catch (err) {
    villageInput.placeholder = "Could not load suggestions — you can still type a name";
    villageInput.disabled = false;
    setStatus(err.message, true, () => loadVillages(countryName));
  }
  updateSetupNextEnabled();
}

countrySelect.addEventListener("change", () => {
  if (countrySelect.value) loadVillages(countrySelect.value);
});

villageInput.addEventListener("input", updateSetupNextEnabled);

function updateSetupNextEnabled() {
  setupNextBtn.disabled = !villageInput.value.trim();
}

peopleMinusBtn.addEventListener("click", () => {
  const value = Math.max(1, Number(peopleValueEl.textContent) - 1);
  peopleValueEl.textContent = value;
});

peoplePlusBtn.addEventListener("click", () => {
  const value = Math.min(20, Number(peopleValueEl.textContent) + 1);
  peopleValueEl.textContent = value;
});

setupNextBtn.addEventListener("click", () => {
  tripSetup.country = countrySelect.value;
  tripSetup.village = villageInput.value.trim();
  tripSetup.departureCity = departureCityInput.value.trim() || "Paris";
  tripSetup.people = Number(peopleValueEl.textContent) || 1;
  tripSetup.hoursPerDay = Number(hoursPerDayInput.value) || 8;
  tripSetup.plannedDays = Number(plannedDaysInput.value) || 1;

  placesVillageName.textContent = tripSetup.village;
  selectedPlaceIds = new Set();
  selectedCategoryFilters = new Set();
  navigateTo("places");
  loadVillageData();
});

// ---- Places screen ----

async function loadCategories() {
  try {
    const data = await fetchJson("/api/categories");
    allCategories = data.categories;
    kidsTag = data.kidsTag;
  } catch {
    allCategories = [];
    kidsTag = null;
  }
}

function renderCategoryChips() {
  categoryChipsEl.innerHTML = "";
  const chipDefs = kidsTag ? [...allCategories, kidsTag] : allCategories;
  chipDefs.forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = cat.label;
    chip.addEventListener("click", () => {
      if (selectedCategoryFilters.has(cat.id)) {
        selectedCategoryFilters.delete(cat.id);
        chip.classList.remove("selected");
      } else {
        selectedCategoryFilters.add(cat.id);
        chip.classList.add("selected");
      }
      renderPlaceCards();
    });
    categoryChipsEl.appendChild(chip);
  });
}

function placeMatchesFilters(place) {
  if (selectedCategoryFilters.size === 0) return true;
  for (const filterId of selectedCategoryFilters) {
    if (filterId === kidsTag?.id && place.kidFriendly) return true;
    if (place.categories.includes(filterId)) return true;
  }
  return false;
}

function priceLabel(place) {
  return place.entryPriceLabel || `${place.entryPrice}€`;
}

function renderPlaceCards() {
  placeListEl.innerHTML = "";
  villageData.places.filter(placeMatchesFilters).forEach((place) => {
    const card = document.createElement("div");
    card.className = "place-card";
    if (selectedPlaceIds.has(place.id)) card.classList.add("selected");

    const photo = place.photoUrl
      ? `<img class="place-photo" src="${place.photoUrl}" alt="${place.name}">`
      : `<div class="place-photo-placeholder">No photo available</div>`;

    const categoryLabels = place.categories
      .map((id) => allCategories.find((c) => c.id === id)?.label || id)
      .join(", ");

    card.innerHTML = `
      <input type="checkbox" class="place-checkbox" ${selectedPlaceIds.has(place.id) ? "checked" : ""}>
      ${photo}
      <div class="place-body">
        <span class="place-category">${categoryLabels}</span>
        ${place.kidFriendly ? '<span class="place-category">Kid-friendly</span>' : ""}
        <p class="place-title">${place.name}</p>
        ${place.whyVisit ? `<p class="place-why">${place.whyVisit}</p>` : ""}
        <p class="place-desc">${place.description || ""}</p>
        <div class="place-meta">
          <span>${priceLabel(place)}</span>
          <span>${place.durationMinutes} min</span>
        </div>
      </div>
    `;

    const checkbox = card.querySelector(".place-checkbox");
    const toggle = () => {
      if (selectedPlaceIds.has(place.id)) {
        selectedPlaceIds.delete(place.id);
      } else {
        selectedPlaceIds.add(place.id);
      }
      checkbox.checked = selectedPlaceIds.has(place.id);
      card.classList.toggle("selected", selectedPlaceIds.has(place.id));
      placesNextBtn.disabled = selectedPlaceIds.size === 0;
    };
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
    card.addEventListener("click", toggle);

    placeListEl.appendChild(card);
  });
}

async function loadVillageData() {
  placeListEl.innerHTML = "";
  categoryChipsEl.innerHTML = "";
  placesNextBtn.disabled = true;
  setStatus("Gathering places for you…");
  try {
    const data = await fetchJson(
      `/api/village-data?country=${encodeURIComponent(tripSetup.country)}&village=${encodeURIComponent(tripSetup.village)}`
    );
    villageData = data.village;
    clearStatus();
    renderCategoryChips();
    renderPlaceCards();
  } catch (err) {
    setStatus(err.message, true, loadVillageData);
  }
}

placesNextBtn.addEventListener("click", () => {
  if (selectedPlaceIds.size === 0) return;
  stationNameHint.textContent = villageData.station?.name ? `(${villageData.station.name})` : "";
  renderHotelSublist();
  navigateTo("start");
});

// ---- Start screen ----

function renderHotelSublist() {
  hotelSublist.innerHTML = "";
  selectedHotelId = null;
  (villageData.hotels || []).forEach((hotel, index) => {
    const label = document.createElement("label");
    label.className = "hotel-option";
    label.innerHTML = `<input type="radio" name="hotel-choice" value="${hotel.id}" ${index === 0 ? "checked" : ""}> <span>${hotel.name}</span>`;
    hotelSublist.appendChild(label);
    if (index === 0) selectedHotelId = hotel.id;
  });

  hotelSublist.querySelectorAll('input[name="hotel-choice"]').forEach((input) => {
    input.addEventListener("change", () => {
      selectedHotelId = input.value;
    });
  });
}

document.querySelectorAll('input[name="start-type"]').forEach((input) => {
  input.addEventListener("change", () => {
    hotelSublist.classList.toggle("hidden", input.value !== "hotel");
  });
});

function getSelectedStartType() {
  const checked = document.querySelector('input[name="start-type"]:checked');
  return checked ? checked.value : "station";
}

generateBtn.addEventListener("click", async () => {
  const startType = getSelectedStartType();
  const startPoint = { type: startType };
  if (startType === "hotel") {
    if (!selectedHotelId) {
      setStatus("No hotel available for this village.", true);
      return;
    }
    startPoint.hotelId = selectedHotelId;
  }

  resultsVillageName.textContent = tripSetup.village;
  navigateTo("results");
  await generateRoute(startPoint);
});

// ---- Results screen ----

async function generateRoute(startPoint) {
  daysListEl.innerHTML = "";
  budgetPanelEl.innerHTML = "";
  warningBanner.classList.add("hidden");
  estimatedDaysLine.textContent = "";
  setStatus("Building your itinerary…");

  try {
    const data = await fetchJson("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: tripSetup.country,
        village: tripSetup.village,
        selectedPlaceIds: Array.from(selectedPlaceIds),
        startPoint,
        people: tripSetup.people,
        hoursPerDay: tripSetup.hoursPerDay,
        plannedDays: tripSetup.plannedDays,
        departureCity: tripSetup.departureCity,
        budgetInputs: {},
      }),
    });
    clearStatus();
    renderResults(data);
  } catch (err) {
    setStatus(err.message, true, () => generateRoute(startPoint));
  }
}

function renderResults(data) {
  estimatedDaysLine.textContent = `Estimated days needed: ${data.estimatedDays}`;

  if (data.warning) {
    warningBanner.textContent = `Some places may not fit in the ${tripSetup.plannedDays} day(s) you planned — consider removing a few places or adding more days.`;
    warningBanner.classList.remove("hidden");
  }

  daysListEl.innerHTML = "";
  data.days.forEach((day) => {
    const block = document.createElement("div");
    block.className = "day-block";
    const stopsHtml = day.stops
      .map(
        (stop, i) => `
        <div class="stop-row">
          <span class="stop-index">${i + 1}</span>
          <div class="stop-details">
            <p class="stop-name">${stop.name}</p>
            <p class="stop-sub">${stop.distanceFromPrevKm} km &middot; ${stop.walkMinutesFromPrev} min walk &middot; ${stop.entryPriceLabel || stop.entryPrice + "€"} &middot; ${stop.durationMinutes} min visit</p>
          </div>
        </div>`
      )
      .join("");

    block.innerHTML = `<p class="day-title">Day ${day.dayNumber}</p>${stopsHtml}`;
    daysListEl.appendChild(block);
  });

  const b = data.budget;
  budgetPanelEl.innerHTML = `
    <div class="budget-line"><span>Entry fees</span><span>${b.entryFeesTotal.toFixed(2)}€</span></div>
    <div class="budget-line"><span>Meals</span><span>${b.mealsTotal.toFixed(2)}€</span></div>
    <div class="budget-line"><span>Train (from ${b.departureCity})</span><span>${b.trainTotal.toFixed(2)}€</span></div>
    <div class="budget-line"><span>Hotel (${b.nights} night${b.nights === 1 ? "" : "s"})</span><span>${b.hotelTotal.toFixed(2)}€</span></div>
    <div class="budget-total"><span>Total</span><span>${b.grandTotal.toFixed(2)}€</span></div>
    <p class="budget-formula">${b.formulaString}</p>
  `;
}

// ---- Init ----

async function init() {
  await loadCategories();
  await loadCountries();
}

init();
