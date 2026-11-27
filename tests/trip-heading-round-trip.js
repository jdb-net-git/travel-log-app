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

var hooks = sandbox.TRAVEL_LOG_TEST_HOOKS;
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function signature(entry) {
  return [entry.trip, entry.date, entry.time, entry.location, entry.description].join(" | ");
}

function roundTrip(list) {
  hooks.setEntries(list);
  return hooks.parseFreeformEvents(hooks.buildExportText()).map(signature);
}

var datedTrips = roundTrip([
  { id: "a", trip: "Alaska Trip", date: "2027-04-08", time: "", location: "Seattle", description: "Fly to Seattle", notes: "", attachments: [], links: [] },
  { id: "b", trip: "5/3 Spain", date: "2027-05-03", time: "", location: "Madrid", description: "Arrive Madrid", notes: "", attachments: [], links: [] },
  { id: "c", trip: "6/15-6/20 Europe", date: "2027-06-15", time: "13:50", location: "Bilbao", description: "Board train", notes: "", attachments: [], links: [] }
]);
assert(
  datedTrips.join("\n") === [
    "Alaska Trip | 2027-04-08 |  | Seattle | Fly to Seattle",
    "5/3 Spain | 2027-05-03 |  | Madrid | Arrive Madrid",
    "6/15-6/20 Europe | 2027-06-15 | 13:50 | Bilbao | Board train"
  ].join("\n"),
  "TXT round trip keeps date-shaped trip titles, got\n" + datedTrips.join("\n")
);

var freeform = hooks.parseFreeformEvents([
  "Spain 2027 Trip",
  "Mon 5/3 LAX - Madrid",
  "5/8 Fly to Seattle"
].join("\n")).map(signature);
assert(
  freeform.join("\n") === [
    "Spain 2027 Trip | 2027-05-03 |  | LAX | LAX - Madrid",
    "Spain 2027 Trip | 2027-05-03 |  | Madrid | LAX - Madrid",
    "Spain 2027 Trip | 2027-05-08 |  | Seattle | Fly to Seattle"
  ].join("\n"),
  "freeform date lines stay events, got\n" + freeform.join("\n")
);

var mixed = hooks.parseFreeformEvents([
  "5/8 Fly to Seattle",
  "2027-05-09 | Location: Seattle | Description: Tour"
].join("\n")).map(signature);
assert(
  mixed.join("\n") === [
    "Imported Trip | " + new Date().getFullYear() + "-05-08 |  | Seattle | Fly to Seattle",
    "Imported Trip | 2027-05-09 |  | Seattle | Tour"
  ].join("\n"),
  "a freeform flight before an exported row is still an event, got\n" + mixed.join("\n")
);

var afterBlankDate = hooks.parseFreeformEvents([
  "Spain Trip",
  "5/3",
  "5/4 Fly to Seattle"
].join("\n")).map(signature);
assert(
  afterBlankDate.join("\n") === "Spain Trip | " + new Date().getFullYear() + "-05-04 |  | Seattle | Fly to Seattle",
  "a date line with no description does not drop the following event, got\n" + afterBlankDate.join("\n")
);

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
