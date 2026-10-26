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
    "  TRAVEL_LOG_TEST_HOOKS.formatTime = formatTime;\n" +
    "}\n})();"
);

vm.createContext(sandbox);
vm.runInContext(source, sandbox);

var importTime = hooks.importTime;
var parseFreeformEvents = hooks.parseFreeformEvents;
var formatTime = hooks.formatTime;

assert(importTime("13:50 Arrive Madrid") === "13:50", "24-hour time at the start is 13:50, got " + importTime("13:50 Arrive Madrid"));
assert(importTime("17:50 Arrive Bilbao") === "17:50", "evening 24-hour time is 17:50, got " + importTime("17:50 Arrive Bilbao"));
assert(importTime("09:15 Board Train") === "09:15", "padded morning time is 09:15, got " + importTime("09:15 Board Train"));
assert(importTime("9:00 Depart") === "09:00", "unpadded morning clock is 09:00, got " + importTime("9:00 Depart"));
assert(importTime("0:05 Depart") === "00:05", "midnight hour is 00:05, got " + importTime("0:05 Depart"));
assert(importTime("Arrive Madrid 13:50") === "13:50", "24-hour time after words is 13:50, got " + importTime("Arrive Madrid 13:50"));
assert(importTime("Board Train @ 10:00") === "10:00", "24-hour time after @ is 10:00, got " + importTime("Board Train @ 10:00"));
assert(importTime("Arrive at 4:45 PM") === "16:45", "12-hour time after a word stays 16:45, got " + importTime("Arrive at 4:45 PM"));
assert(importTime("Fly to Seattle @ 10 AM") === "10:00", "at-sign 12-hour time stays 10:00, got " + importTime("Fly to Seattle @ 10 AM"));
assert(importTime("Board at 12 AM") === "00:00", "12 AM stays 00:00, got " + importTime("Board at 12 AM"));
assert(importTime("Lunch at 12 PM") === "12:00", "12 PM stays 12:00, got " + importTime("Lunch at 12 PM"));
assert(importTime("Bilbao all day") === "", "a line without a clock has no time, got " + importTime("Bilbao all day"));
assert(importTime("Hotel: Parador (1 night)") === "", "a parenthetical count is not a time, got " + importTime("Hotel: Parador (1 night)"));
assert(importTime("Delay 25:30") === "", "hour 25 is not stored, got " + importTime("Delay 25:30"));
assert(importTime("Delay 13:60") === "", "minute 60 is not stored, got " + importTime("Delay 13:60"));

var imported = parseFreeformEvents([
  "Spain 2027 Trip",
  "Mon 5/4 13:50 Arrive Madrid",
  "Mon 5/4 17:50 Arrive Bilbao",
  "Thu 6/4 09:15 Board Train",
  "Thu 6/4 Board Train @ 10 AM",
  "5/8 Fly to Seattle"
].join("\n"));

function brief(entry) {
  return entry.date + " " + entry.time + " " + entry.location;
}

assert(imported.length === 5, "five dated events imported, got " + imported.length + " " + imported.map(brief).join(" | "));
assert(imported[0].time === "13:50" && imported[0].location === "Madrid" && imported[0].date === "2027-05-04", "13:50 Madrid kept, got " + brief(imported[0] || {}));
assert(imported[1].time === "17:50" && imported[1].location === "Bilbao", "17:50 Bilbao kept, got " + brief(imported[1] || {}));
assert(imported[2].time === "09:15" && imported[2].location === "Train", "09:15 Train kept, got " + brief(imported[2] || {}));
assert(imported[3].time === "10:00" && imported[3].location === "Train", "@ 10 AM still imports, got " + brief(imported[3] || {}));
assert(imported[4].time === "" && imported[4].location === "Seattle", "a dateline without a clock stays untimed, got " + brief(imported[4] || {}));
assert(formatTime(imported[0].time) === "1:50 PM", "stored 13:50 still displays as 1:50 PM, got " + formatTime(imported[0].time));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
