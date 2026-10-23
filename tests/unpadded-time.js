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

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

assert(hooks.timeForStorage("9:00") === "09:00", "9:00 is stored as 09:00, got " + hooks.timeForStorage("9:00"));
assert(hooks.timeForStorage("1:50 PM") === "13:50", "1:50 PM is stored as 13:50, got " + hooks.timeForStorage("1:50 PM"));
assert(hooks.timeForStorage("9:30 AM") === "09:30", "9:30 AM is stored as 09:30, got " + hooks.timeForStorage("9:30 AM"));
assert(hooks.timeForStorage("12:00 AM") === "00:00", "12:00 AM is stored as 00:00, got " + hooks.timeForStorage("12:00 AM"));
assert(hooks.timeForStorage("12:00 PM") === "12:00", "12:00 PM stays noon, got " + hooks.timeForStorage("12:00 PM"));
assert(hooks.timeForStorage("13:50") === "13:50", "13:50 stays 13:50, got " + hooks.timeForStorage("13:50"));
assert(hooks.timeForStorage("09:00:30") === "09:00:30", "seconds stay on a valid time, got " + hooks.timeForStorage("09:00:30"));
assert(hooks.timeForStorage("noon") === "noon", "unparsed times stay as typed, got " + hooks.timeForStorage("noon"));
assert(hooks.timeForStorage("") === "", "blank time stays blank");

var unpadded = hooks.timeFieldFor("9:00");
assert(unpadded.type === "time" && unpadded.value === "09:00", "edit field receives 09:00 in a time input, got " + JSON.stringify(unpadded));
var afternoon = hooks.timeFieldFor("1:50 PM");
assert(afternoon.type === "time" && afternoon.value === "13:50", "edit field converts 1:50 PM, got " + JSON.stringify(afternoon));
var odd = hooks.timeFieldFor("noon");
assert(odd.type === "text" && odd.value === "noon", "unparsed time stays in a text field, got " + JSON.stringify(odd));
var blank = hooks.timeFieldFor("");
assert(blank.type === "time" && blank.value === "", "new events keep an empty time input, got " + JSON.stringify(blank));

var imported = hooks.parseFreeformEvents([
  "Spain Trip",
  "2027-06-02 | Time: 9:00 | Location: Madrid | Description: Morning tour",
  "2027-06-02 | Time: 1:50 PM | Location: Madrid | Description: Arrive Madrid"
].join("\n"));
assert(imported.length === 2, "export lines still import, got " + imported.length);
assert(imported[0].time === "09:00" && imported[0].description === "Morning tour", "imported 9:00 becomes 09:00, got " + JSON.stringify(imported[0]));
assert(imported[1].time === "13:50" && imported[1].description === "Arrive Madrid", "imported 1:50 PM becomes 13:50, got " + JSON.stringify(imported[1]));

assert(hooks.importTime("Fly to Seattle @ 9 AM") === "09:00", "freeform 9 AM stays 09:00, got " + hooks.importTime("Fly to Seattle @ 9 AM"));
assert(hooks.importTime("Arrive at 4:45 PM") === "16:45", "freeform 4:45 PM stays 16:45, got " + hooks.importTime("Arrive at 4:45 PM"));
assert(hooks.importTime("Board at 12 AM") === "00:00", "freeform 12 AM stays 00:00, got " + hooks.importTime("Board at 12 AM"));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
