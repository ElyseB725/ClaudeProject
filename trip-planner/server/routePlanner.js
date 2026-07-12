const WALKING_PACE_KMH = 4.5;
const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function walkingMinutes(distanceKm, paceKmh = WALKING_PACE_KMH) {
  return (distanceKm / paceKmh) * 60;
}

// Nearest-neighbor greedy ordering, straight-line distance (no real pedestrian routing for v1).
function buildRoute(places, startPoint) {
  const remaining = [...places];
  const stops = [];
  let current = startPoint;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceKm(current, remaining[i]);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = i;
      }
    }

    const place = remaining.splice(nearestIndex, 1)[0];
    stops.push({
      ...place,
      distanceFromPrevKm: Number(nearestDistance.toFixed(2)),
      walkMinutesFromPrev: Math.round(walkingMinutes(nearestDistance)),
    });
    current = place;
  }

  return stops;
}

// Simple sequential bucketing across days — no per-day geographic recalculation (deferred per spec).
function splitIntoDays(routeStops, hoursPerDay) {
  const budgetMinutes = hoursPerDay * 60;
  const days = [];
  let currentDay = { dayNumber: 1, stops: [], totalMinutes: 0 };

  for (const stop of routeStops) {
    const stopMinutes = stop.walkMinutesFromPrev + stop.durationMinutes;

    if (currentDay.stops.length > 0 && currentDay.totalMinutes + stopMinutes > budgetMinutes) {
      days.push(currentDay);
      currentDay = { dayNumber: days.length + 1, stops: [], totalMinutes: 0 };
    }

    currentDay.stops.push(stop);
    currentDay.totalMinutes += stopMinutes;
  }

  if (currentDay.stops.length > 0) days.push(currentDay);

  return { days, estimatedDays: days.length };
}

// Meals/entry/train are charged per person; meals also scale with plannedDays (you eat every day).
// Hotel scales with nights (plannedDays - 1), not people, since it's a per-room cost.
function computeBudget({
  entryFeesRaw,
  people,
  plannedDays,
  lunchPerPerson,
  dessertPerPerson,
  trainTicket,
  departureCity,
  hotelPerNight,
}) {
  const nights = Math.max(plannedDays - 1, 0);

  const entryFeesTotal = entryFeesRaw * people;
  const mealsTotal = (lunchPerPerson + dessertPerPerson) * people * plannedDays;
  const trainTotal = trainTicket * people;
  const hotelTotal = hotelPerNight * nights;
  const grandTotal = entryFeesTotal + mealsTotal + trainTotal + hotelTotal;

  const nightsLabel = nights === 1 ? "nuit" : "nuits";
  const formulaString = `(sites/repas/train × ${people} pers.) + (hôtel ${hotelPerNight}€ × ${nights} ${nightsLabel})`;

  return {
    entryFeesTotal,
    mealsTotal,
    trainTotal,
    hotelTotal,
    nights,
    grandTotal,
    departureCity,
    formulaString,
  };
}

module.exports = {
  WALKING_PACE_KMH,
  haversineDistanceKm,
  walkingMinutes,
  buildRoute,
  splitIntoDays,
  computeBudget,
};
