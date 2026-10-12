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

var pathNote = "Tickets saved at C:\\Users\\John\\Documents\\notes\\boarding.pdf";
var source = {
  date: "2027-05-04",
  time: "13:50",
  location: "Madrid",
  description: "Arrive Madrid",
  notes: pathNote
};
var imported = api.parseExportLine(api.normalizeImportLine(exportLine(source)), "Path Trip");
assert(imported && imported.notes === pathNote, "Windows path in notes round-trips, got " + JSON.stringify(imported && imported.notes));
assert(imported && imported.location === "Madrid" && imported.description === "Arrive Madrid", "path row keeps location and description");
assert(imported && imported.time === "13:50" && imported.date === "2027-05-04", "path row keeps date and time");

var mixed = {
  date: "2027-06-15",
  time: "09:00",
  location: "Paris | France",
  description: "Hotel check-in | lobby",
  notes: "Gate | 12A\nSee C:\\notes\nSeat | 14C"
};
var mixedImported = api.parseExportLine(api.normalizeImportLine(exportLine(mixed)), "Mixed Trip");
assert(mixedImported && mixedImported.location === mixed.location, "piped location round-trips, got " + JSON.stringify(mixedImported && mixedImported.location));
assert(mixedImported && mixedImported.description === mixed.description, "piped description round-trips, got " + JSON.stringify(mixedImported && mixedImported.description));
assert(mixedImported && mixedImported.notes === mixed.notes, "pipes, newline, and \\n in notes round-trip, got " + JSON.stringify(mixedImported && mixedImported.notes));

var trailing = "folder\\\nnext line";
assert(api.importValue(api.exportValue(trailing)) === trailing, "backslash at end of a line round-trips, got " + JSON.stringify(api.importValue(api.exportValue(trailing))));

var legacyNewline = api.importValue("line1\\nline2");
assert(legacyNewline === "line1\nline2", "older exports still restore escaped newlines");

var events = api.parseFreeformEvents([
  "Path Trip",
  exportLine(source)
].join("\n"));
assert(events.length === 1 && events[0].notes === pathNote, "file import keeps the Windows path, got " + JSON.stringify(events[0] && events[0].notes));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
