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

var parseFreeformEvents = sandbox.TRAVEL_LOG_TEST_HOOKS.parseFreeformEvents;
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function dates(text) {
  return parseFreeformEvents(text).map(function (entry) {
    return entry.date + " " + entry.location;
  }).join(" | ");
}

var fileImport = [
  "Spain Trip",
  "Mon 5/3/2027 LAX - Madrid",
  "Tue 5/4 Arrive Madrid"
].join("\n");
assert(
  dates(fileImport) === "2027-05-03 LAX | 2027-05-03 Madrid | 2027-05-04 Madrid",
  "slash dates keep an explicit year and the following line uses it, got " + dates(fileImport)
);

var shortYear = [
  "Alaska Trip",
  "4/8/27 Fly to Seattle"
].join("\n");
assert(
  dates(shortYear) === "2027-04-08 Seattle",
  "two-digit slash year 27 is 2027, got " + dates(shortYear)
);

var headingYear = [
  "Spain 2027 Trip",
  "Mon 5/3 LAX - Madrid"
].join("\n");
assert(
  dates(headingYear) === "2027-05-03 LAX | 2027-05-03 Madrid",
  "a heading year still applies when the date has no year, got " + dates(headingYear)
);

var range = [
  "Madrid Trip",
  "5/3-11 Madrid"
].join("\n");
var ranged = parseFreeformEvents(range);
assert(
  ranged.length === 1 && ranged[0].date.indexOf("-05-03") !== -1 && ranged[0].date.indexOf("2011") === -1,
  "a day range written with a hyphen is not read as a year, got " + dates(range)
);

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
