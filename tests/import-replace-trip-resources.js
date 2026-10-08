var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storageKey = "travel-log-entries-v1";
var storage = {};
var listeners = {};
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function attachment(id, name) {
  return {
    id: id,
    name: name,
    type: "text/plain",
    size: 4,
    addedAt: "2026-10-01T00:00:00.000Z",
    dataUrl: "data:text/plain;base64,QQ=="
  };
}

function entry(id, trip, description) {
  return {
    id: id,
    trip: trip,
    date: "2027-05-04",
    time: "",
    location: "Madrid",
    description: description,
    notes: "",
    attachments: [attachment(id + "-file", id + ".txt")],
    links: [{ id: id + "-link", label: "Booking", url: "https://example.com/" + id }]
  };
}

storage[storageKey] = JSON.stringify([
  entry("spain-1", "Spain 2027 Trip", "Arrive Madrid"),
  entry("alaska-1", "Alaska Trip", "Fly to Seattle")
]);
storage[storageKey + "-trips"] = JSON.stringify({
  "Spain 2027 Trip": {
    attachments: [attachment("pass", "passport.txt")],
    links: [{ id: "hotel", label: "Hotel", url: "https://hotel.example/spain" }]
  },
  "Alaska Trip": {
    attachments: [attachment("ship", "boarding-pass.txt")],
    links: [{ id: "ship-link", label: "Ship", url: "https://ship.example/alaska" }]
  }
});
storage[storageKey + "-settings"] = JSON.stringify({ descriptionSearchMethod: "gemini" });
storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: 1000 });

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
    addEventListener: function (name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    querySelector: function (selector) {
      if (selector === ".trips") return { innerHTML: "" };
      if (selector === '[type="search"]') return { value: "", addEventListener: function () {} };
      return null;
    },
    createElement: function () {
      return { className: "", innerHTML: "" };
    },
    body: {
      appendChild: function () {},
      removeChild: function () {}
    }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

function fire(name) {
  (listeners[name] || []).forEach(function (fn) {
    fn();
  });
}

function clickAction(action) {
  var control = {
    getAttribute: function (name) {
      return name === "data-action" ? action : null;
    },
    closest: function (selector) {
      return selector === "[data-action]" ? control : null;
    },
    className: ""
  };
  (listeners.click || []).forEach(function (fn) {
    fn({ target: control });
  });
}

function savedEntries() {
  return JSON.parse(storage[storageKey]);
}

function savedTrips() {
  return JSON.parse(storage[storageKey + "-trips"]);
}

fire("DOMContentLoaded");

setTimeout(function () {
  sandbox.pendingImportFileText = [
    "This file has no dated events"
  ].join("\n");
  clickAction("confirm-import-file-replace");
  assert(savedEntries().length === 2, "a file with no events does not erase the itinerary, got " + savedEntries().length);
  assert(savedTrips()["Spain 2027 Trip"] && savedTrips()["Spain 2027 Trip"].attachments[0].name === "passport.txt", "a file with no events keeps trip files");

  sandbox.pendingImportFileText = [
    "Spain 2027 Trip",
    "2027-06-01 | Location: Madrid | Description: Revised arrival"
  ].join("\n");
  clickAction("import-file-add");
  assert(savedEntries().length === 3, "add import keeps existing events, got " + savedEntries().length);
  assert(savedTrips()["Alaska Trip"].attachments[0].name === "boarding-pass.txt", "add import keeps other trip files");
  assert(savedTrips()["Spain 2027 Trip"].attachments[0].name === "passport.txt", "add import keeps that trip's files");

  sandbox.pendingImportFileText = [
    "Spain 2027 Trip",
    "2027-06-01 | Location: Madrid | Description: Revised arrival"
  ].join("\n");
  clickAction("confirm-import-file-replace");
  var entries = savedEntries();
  var trips = savedTrips();
  assert(entries.length === 1 && entries[0].description === "Revised arrival", "replace import keeps only the file's events, got " + entries.map(function (item) { return item.description; }).join(","));
  assert(!entries[0].attachments.length, "replace import drops old event attachments");
  assert(Object.keys(trips).length === 0, "replace import drops trip files for every trip, got " + Object.keys(trips).join(","));
  assert(JSON.parse(storage[storageKey + "-settings"]).descriptionSearchMethod === "gemini", "replace import keeps app settings");

  if (failures) {
    console.error(failures + " failed");
    process.exit(1);
  }
  console.log("all passed");
}, 0);
