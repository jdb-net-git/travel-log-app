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

function shows(text, pattern, message) {
  assert(pattern.test(text), message + ", got " + JSON.stringify(text));
}

function load(file, extra) {
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
    URLSearchParams: URLSearchParams,
    TRAVEL_LOG_TEST_HOOKS: hooks,
    localStorage: {
      getItem: function () { return null; },
      setItem: function () {},
      removeItem: function () {}
    },
    document: {
      addEventListener: function () {},
      querySelector: function () { return null; },
      getElementById: function () { return null; },
      createElement: function () { return { className: "", innerHTML: "" }; },
      body: { appendChild: function () {}, removeChild: function () {} }
    },
    location: { search: "", protocol: "http:", hostname: "127.0.0.1" }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  if (extra) extra(sandbox);
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), sandbox);
  return hooks;
}

function check(label, formatTime) {
  assert(typeof formatTime === "function", label + " formatTime is reachable");
  shows(formatTime("13:50"), /1:50\s*PM/i, label + " keeps a 24-hour clock");
  shows(formatTime("09:00"), /9:00\s*AM/i, label + " keeps a padded morning time");
  shows(formatTime("9:00"), /9:00\s*AM/i, label + " keeps an unpadded morning time");
  shows(formatTime("4:45 PM"), /4:45\s*PM/i, label + " keeps a 12-hour clock");
  shows(formatTime("12:00 AM"), /12:00\s*AM/i, label + " keeps midnight");
  shows(formatTime("12:00 PM"), /12:00\s*PM/i, label + " keeps noon");
  shows(formatTime("13:50:00"), /1:50\s*PM/i, label + " keeps seconds off the label");
  assert(formatTime("afternoon") === "afternoon", label + " leaves a word time visible, got " + JSON.stringify(formatTime("afternoon")));
  assert(formatTime("10 AM") === "10:00 AM", label + " reads a meridiem without minutes, got " + JSON.stringify(formatTime("10 AM")));
  assert(formatTime("</span><img onerror=alert(1)>") === "</span><img onerror=alert(1)>", label + " does not throw on markup in a time");
  assert(formatTime("") === "", label + " blank time stays blank");
}

check("itinerary", load("travel-log.js").formatTime);
check("place", load("place.js").formatTime);

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
