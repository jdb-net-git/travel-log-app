const dayPrefixes = /^(mon|monday|tues|tuesday|wed|wednesday|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\s+/i;
const datePattern = /^((?:mon|monday|tues|tuesday|wed|wednesday|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\s+)?(\d{1,2})\/(\d{1,2})\s+(.+)$/i;

const placeWords = [
  "LAX",
  "Madrid",
  "Bilbao",
  "Santiago",
  "Seattle",
  "Ship",
  "Train",
  "Radisson Collection",
  "Parador"
];

function parseFreeformEvents(text, fallbackYear = new Date().getFullYear()) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let trip = "Imported Trip";
  let year = fallbackYear;
  const entries = [];

  for (const line of lines) {
    const eventMatch = line.match(datePattern);
    if (!eventMatch) {
      trip = line;
      const yearMatch = line.match(/\b(20\d{2})\b/);
      year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
      continue;
    }

    const [, , monthRaw, dayRaw, eventText] = eventMatch;
    const date = toDateValue(year, monthRaw, dayRaw);
    const pieces = eventText
      .replace(dayPrefixes, "")
      .split(/\s+(?:-|–|—)\s+/)
      .map((piece) => piece.trim())
      .filter(Boolean);

    const eventPieces = pieces.length ? pieces : [eventText];
    const routeLocations = extractRouteLocations(eventText);

    eventPieces.forEach((piece, index) => {
      const locations = extractLocations(piece, routeLocations[index]).filter(Boolean);
      const splitLocations = locations.length ? locations : ["Unspecified"];
      splitLocations.forEach((location) => entries.push({
        id: `import-${Date.now()}-${entries.length}-${index}`,
        trip,
        date,
        time: extractTime(piece),
        locations: [location],
        description: cleanDescription(piece),
        notes: piece.toLowerCase().includes("hotel") ? "" : "",
        approved: true
      }));
    });
  }

  return entries;
}

function toDateValue(year, monthRaw, dayRaw) {
  const month = String(monthRaw).padStart(2, "0");
  const day = String(dayRaw).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractRouteLocations(text) {
  const routeMatch = text.match(/^([A-Za-z ]+)\s+(?:-|–|—)\s+([A-Za-z ]+)(?:\s|$)/);
  if (!routeMatch) return [];
  return [routeMatch[1].trim(), routeMatch[2].trim()];
}

function extractLocations(text, routeLocation) {
  if (routeLocation) return [routeLocation];

  const found = placeWords.filter((place) => new RegExp(`\\b${escapeRegExp(place)}\\b`, "i").test(text));
  const hotel = text.match(/Hotel:\s*([^@-]+)/i);
  if (hotel) found.push(hotel[1].trim());

  const arrive = text.match(/Arrive\s+([A-Z][A-Za-z ]+?)(?:\s+\d|$|@|-)/);
  if (arrive) found.push(arrive[1].trim());

  const flyTo = text.match(/Fly to\s+([A-Z][A-Za-z ]+)/i);
  if (flyTo) found.push(flyTo[1].trim());

  return [...new Set(found.map((location) => location.replace(/\s+/g, " ").trim()))];
}

function extractTime(text) {
  const match = text.match(/(?:@|\s)(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!match) return "";

  let hour = Number(match[1]);
  const minute = match[2] || "00";
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function cleanDescription(text) {
  return text
    .replace(/\s*@\s*/g, " at ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

window.TravelLogParser = {
  parseFreeformEvents
};
