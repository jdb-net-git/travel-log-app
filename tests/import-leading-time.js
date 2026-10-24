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
    "  TRAVEL_LOG_TEST_HOOKS.importTime = importTime;\n" +
    "  TRAVEL_LOG_TEST_HOOKS.parseFreeformEvents = parseFreeformEvents;\n" +
    "}\n})();"
);

vm.createContext(sandbox);
vm.runInContext(source, sandbox);

var importTime = hooks.importTime;
var parseFreeformEvents = hooks.parseFreeformEvents;

assert(importTime("4:45 PM Arrive Bilbao") === "16:45", "time at the start is 16:45, got " + importTime("4:45 PM Arrive Bilbao"));
assert(importTime("1:50 PM LAX") === "13:50", "afternoon time at the start is 13:50, got " + importTime("1:50 PM LAX"));
assert(importTime("8:10 AM Fly to Seattle") === "08:10", "morning time at the start is 08:10, got " + importTime("8:10 AM Fly to Seattle"));
assert(importTime("12:00 AM Board") === "00:00", "midnight at the start is 00:00, got " + importTime("12:00 AM Board"));
assert(importTime("12 PM lunch") === "12:00", "noon at the start stays 12:00, got " + importTime("12 PM lunch"));
assert(importTime("Fly to Seattle @ 10 AM") === "10:00", "at-sign time stays 10:00, got " + importTime("Fly to Seattle @ 10 AM"));
assert(importTime("Arrive at 4:45 PM") === "16:45", "time after a word stays 16:45, got " + importTime("Arrive at 4:45 PM"));
assert(importTime("Board at 12 AM") === "00:00", "12 AM after a word stays 00:00, got " + importTime("Board at 12 AM"));
assert(importTime("Bilbao all day") === "", "a line without a clock has no time, got " + importTime("Bilbao all day"));

var imported = parseFreeformEvents([
  "Spain 2027 Trip",
  "Mon 5/3 1:50 PM LAX - Madrid",
  "Tue 5/4 4:45 PM Arrive Bilbao",
  "Wed 5/5 Bilbao all day"
].join("\n"));

function brief(entry) {
  return entry.date + " " + (entry.time || "-") + " " + entry.location;
}

assert(imported.length === 4, "route plus two later lines import as 4 events, got " + imported.length + " " + imported.map(brief).join(" | "));
assert(imported[0].date === "2027-05-03" && imported[0].time === "13:50" && imported[0].location === "LAX", "LAX keeps 1:50 PM, got " + brief(imported[0] || {}));
assert(imported[1].date === "2027-05-03" && imported[1].location === "Madrid", "Madrid stays on the same flight date, got " + brief(imported[1] || {}));
assert(imported[2].date === "2027-05-04" && imported[2].time === "16:45" && imported[2].location === "Bilbao", "Arrive Bilbao keeps 4:45 PM, got " + brief(imported[2] || {}));
assert(imported[3].date === "2027-05-05" && imported[3].time === "" && imported[3].location === "Bilbao", "a dateline without a clock stays untimed, got " + brief(imported[3] || {}));

var atSign = parseFreeformEvents([
  "Alaska Trip",
  "Thu 6/4 Board Train @ 10 AM"
].join("\n"));
assert(atSign.length === 1 && atSign[0].time === "10:00" && atSign[0].location === "Train" && atSign[0].date === "2026-06-04", "an @ time still imports, got " + atSign.map(brief).join(" | "));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
