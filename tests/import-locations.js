var fs = require("fs");
var path = require("path");
var vm = require("vm");

var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function locations(events) {
  return events.map(function (entry) { return entry.location; }).join(", ");
}

var hooks = {};
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
  RegExp: RegExp,
  setTimeout: setTimeout,
  TRAVEL_LOG_TEST_HOOKS: hooks,
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; },
    createElement: function () { return { className: "", innerHTML: "" }; },
    body: { appendChild: function () {}, removeChild: function () {} }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

var source = fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8");
source = source.replace(
  "})();",
  "if (typeof TRAVEL_LOG_TEST_HOOKS !== \"undefined\" && TRAVEL_LOG_TEST_HOOKS) {\n" +
    "  TRAVEL_LOG_TEST_HOOKS.parseFreeformEvents = parseFreeformEvents;\n" +
    "  TRAVEL_LOG_TEST_HOOKS.importLocations = importLocations;\n" +
    "}\n})();"
);

vm.createContext(sandbox);
vm.runInContext(source, sandbox);

var parseFreeformEvents = hooks.parseFreeformEvents;

function places(line) {
  return locations(parseFreeformEvents("Spain 2027 Trip\n" + line));
}

assert(places("5/5 Relax at the Parador") === "Parador", "relax does not become LAX, got " + places("5/5 Relax at the Parador"));
assert(places("5/6 Friendship dinner in Madrid") === "Madrid", "friendship does not become Ship, got " + places("5/6 Friendship dinner in Madrid"));
assert(places("5/6 Shipping paperwork in Bilbao") === "Bilbao", "shipping does not become Ship, got " + places("5/6 Shipping paperwork in Bilbao"));
assert(places("5/4 Arrive Madrid at 4:45 PM") === "Madrid", "arrive stops before at, got " + places("5/4 Arrive Madrid at 4:45 PM"));
assert(places("5/11 Hotel: Parador (1 night)") === "Parador", "hotel parenthetical is not a second place, got " + places("5/11 Hotel: Parador (1 night)"));
assert(places("5/11 Hotel: Radisson Collection.") === "Radisson Collection", "hotel period is not part of the name, got " + places("5/11 Hotel: Radisson Collection."));
assert(places("5/11 Hotel: Parador de Alcala") === "Parador de Alcala", "specific hotel name is kept, got " + places("5/11 Hotel: Parador de Alcala"));
assert(places("5/11 Arrive Santiago lunch with train") === "Santiago, Train", "arrive keeps the city and a whole-word train, got " + places("5/11 Arrive Santiago lunch with train"));
assert(places("5/8 Fly to Seattle") === "Seattle", "fly to Seattle stays one place, got " + places("5/8 Fly to Seattle"));
assert(places("5/8 Fly to Seattle for dinner") === "Seattle", "fly to stops before lowercase words, got " + places("5/8 Fly to Seattle for dinner"));
assert(places("5/6 Board Train") === "Train", "board train still finds Train, got " + places("5/6 Board Train"));
assert(places("5/3 LAX - Madrid") === "LAX, Madrid", "route lines still split, got " + places("5/3 LAX - Madrid"));
assert(places("5/4 Walk around town") === "Unspecified", "a line with no place stays unspecified, got " + places("5/4 Walk around town"));

var timed = parseFreeformEvents("Spain 2027 Trip\n5/4 Arrive Madrid at 4:45 PM");
assert(timed.length === 1 && timed[0].time === "16:45", "4:45 PM is still stored once, got " + timed.map(function (entry) { return entry.time; }).join(","));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
