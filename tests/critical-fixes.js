var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storage = {};
var sandbox = {
  console: console,
  Intl: Intl,
  Date: Date,
  Number: Number,
  String: String,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  Promise: Promise,
  TRAVEL_LOG_TEST_HOOKS: {},
  localStorage: {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
    },
    setItem: function (key, value) {
      storage[key] = String(value);
    },
    removeItem: function (key) {
      delete storage[key];
    }
  },
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

var api = sandbox.TRAVEL_LOG_TEST_HOOKS;
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function exportLine(entry) {
  var parts = [
    entry.date,
    "Location: " + api.exportValue(entry.location),
    "Description: " + api.exportValue(entry.description)
  ];
  if (entry.time) parts.splice(1, 0, "Time: " + api.exportValue(entry.time));
  if (entry.notes) parts.push("Notes: " + api.exportValue(entry.notes));
  return parts.join(" | ");
}

var source = {
  date: "2027-06-15",
  time: "13:50",
  location: "Paris | France",
  description: "Hotel check-in | lobby",
  notes: "Gate | 12A\nSeat | 14C"
};
var line = api.normalizeImportLine(exportLine(source));
var imported = api.parseExportLine(line, "Pipe Trip");
assert(imported.location === "Paris | France", "location pipe round-trips, got " + JSON.stringify(imported && imported.location));
assert(imported.description === "Hotel check-in | lobby", "description pipe round-trips, got " + JSON.stringify(imported && imported.description));
assert(imported.notes === "Gate | 12A\nSeat | 14C", "notes pipes and newline round-trip, got " + JSON.stringify(imported && imported.notes));
assert(imported.time === "13:50", "time round-trips");
assert(imported.date === "2027-06-15", "date round-trips");

var plain = api.parseFreeformEvents([
  "Spain 2027 Trip",
  "2027-05-04 | Time: 17:50 | Location: Bilbao | Description: Arrive Bilbao | Notes: Hotel: Radisson Collection."
].join("\n"));
assert(plain.length === 1 && plain[0].location === "Bilbao" && plain[0].notes === "Hotel: Radisson Collection.", "plain export line still imports");

var mixed = api.parseFreeformEvents([
  "Pipe Trip",
  exportLine(source),
  "13/5 Something unusual"
].join("\n"));
assert(mixed.length === 2, "import keeps the pipe row and the out-of-range day row, got " + mixed.length);
assert(mixed[1] && mixed[1].date === new Date().getFullYear() + "-13-05", "day-first 13/5 is stored as month 13, got " + (mixed[1] && mixed[1].date));

var formatted = api.formatDate("2027-04-08");
assert(formatted.indexOf("Apr") !== -1 && formatted.indexOf("2027") !== -1 && formatted.indexOf("8") !== -1, "valid date still formats, got " + formatted);
assert(api.formatDate("2026-13-01") === "2026-13-01", "month 13 does not throw and is not rewritten");
assert(api.formatDate("2026-02-31") === "2026-02-31", "Feb 31 is not silently shifted");
assert(api.formatDate("2026-06-31") === "2026-06-31", "Jun 31 is not silently shifted");
assert(api.formatTime("13:50").indexOf("50") !== -1, "valid time still formats, got " + api.formatTime("13:50"));
assert(api.formatTime("99:99") === "99:99", "overflow time does not throw");

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
