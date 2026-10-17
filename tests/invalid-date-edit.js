var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storage = {};
var sandbox = {
  console: console,
  Date: Date,
  Number: Number,
  String: String,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  Promise: Promise,
  Intl: Intl,
  RegExp: RegExp,
  TRAVEL_LOG_TEST_HOOKS: {},
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; }
  },
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

assert(api.calendarDateOrEmpty("2026-04-30") === "2026-04-30", "valid date stays usable in a date input");
assert(api.calendarDateOrEmpty("2024-02-29") === "2024-02-29", "leap day in a leap year stays usable");
assert(api.calendarDateOrEmpty("2026-04-31") === "", "April 31 is not a calendar date");
assert(api.calendarDateOrEmpty("2026-06-31") === "", "June 31 is not a calendar date");
assert(api.calendarDateOrEmpty("2026-02-29") === "", "Feb 29 in a non-leap year is not a calendar date");
assert(api.calendarDateOrEmpty("2026-02-30") === "", "Feb 30 is not a calendar date");
assert(api.calendarDateOrEmpty("2026-11-31") === "", "November 31 is not a calendar date");
assert(api.calendarDateOrEmpty("2026-13-05") === "", "month 13 is not a calendar date");
assert(api.calendarDateOrEmpty("") === "", "empty date is not a calendar date");

var imported = api.parseFreeformEvents("Rome 2026\n4/31 Hotel check-in\n2/29 Fly home");
assert(imported.length === 2, "freeform import keeps both overflow dates, got " + imported.length);
assert(imported[0] && imported[0].date === "2026-04-31", "4/31 is stored as April 31, got " + (imported[0] && imported[0].date));
assert(imported[1] && imported[1].date === "2026-02-29", "2/29 in 2026 is stored as Feb 29, got " + (imported[1] && imported[1].date));
assert(api.calendarDateOrEmpty(imported[0].date) === "", "imported April 31 must not be handed to a date input");
assert(api.calendarDateOrEmpty(imported[1].date) === "", "imported Feb 29 2026 must not be handed to a date input");

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
