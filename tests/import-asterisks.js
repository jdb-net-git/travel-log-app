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

var code = fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8").replace(/\}\)\(\);\s*$/, [
  "  global.__api = { parseFreeformEvents: parseFreeformEvents, buildExportText: buildExportText, setEntries: function (value) { entries = value; } };",
  "})();"
].join("\n"));

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
  Uint8Array: Uint8Array,
  TextDecoder: TextDecoder,
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  indexedDB: null,
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; }
  },
  setTimeout: setTimeout
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

var api = sandbox.__api;

function fields(entry) {
  return {
    trip: entry.trip,
    date: entry.date,
    location: entry.location,
    description: entry.description,
    notes: entry.notes
  };
}

var starred = api.parseFreeformEvents([
  "Hotel Trip",
  "2027-06-01 | Location: Paris | Description: Stay at 5* hotel | Notes: Rating **** and code AB*99"
].join("\n"));
assert(starred.length === 1, "starred export line imports as one event, got " + starred.length);
assert(starred[0] && starred[0].description === "Stay at 5* hotel", "description keeps the hotel star, got " + JSON.stringify(starred[0] && starred[0].description));
assert(starred[0] && starred[0].notes === "Rating **** and code AB*99", "notes keep star ratings and starred codes, got " + JSON.stringify(starred[0] && starred[0].notes));

var roundTripSource = [{
  id: "star-1",
  trip: "Hotel Trip",
  date: "2027-06-01",
  time: "",
  location: "Paris",
  description: "Stay at 5* hotel",
  notes: "Rating **** and code AB*99",
  attachments: [],
  links: []
}];
api.setEntries(roundTripSource);
var roundTrip = api.parseFreeformEvents(api.buildExportText());
assert(roundTrip.length === 1 && roundTrip[0].description === "Stay at 5* hotel" && roundTrip[0].notes === "Rating **** and code AB*99", "TXT export round-trip keeps asterisks, got " + JSON.stringify(roundTrip.map(fields)));

var bullets = api.parseFreeformEvents([
  "Spain 2027 Trip",
  "* 5/8 Stay at 5* hotel",
  "• 5/9 Board Ship",
  "• * 5/10 Train to Madrid"
].join("\n"));
assert(bullets.length === 4, "leading bullets still import, got " + bullets.length + " " + JSON.stringify(bullets.map(fields)));
assert(bullets[0] && bullets[0].date === "2027-05-08" && bullets[0].description === "Stay at 5* hotel", "leading star bullet is removed and the rating star stays, got " + JSON.stringify(bullets[0] && fields(bullets[0])));
assert(bullets[1] && bullets[1].date === "2027-05-09" && bullets[1].location === "Ship", "leading dot bullet still imports, got " + JSON.stringify(bullets[1] && fields(bullets[1])));
assert(bullets[2] && bullets[2].date === "2027-05-10" && bullets[3] && bullets[3].date === "2027-05-10", "stacked leading bullets still import, got " + JSON.stringify(bullets.slice(2).map(fields)));

var inlineBullet = api.parseFreeformEvents([
  "Spain 2027 Trip",
  "5/11 • Madrid • lunch"
].join("\n"));
assert(inlineBullet.length === 1 && inlineBullet[0].location === "Madrid" && inlineBullet[0].description.indexOf("*") === -1 && inlineBullet[0].description.indexOf("Madrid") !== -1, "inline bullets still separate words, got " + JSON.stringify(inlineBullet.map(fields)));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
