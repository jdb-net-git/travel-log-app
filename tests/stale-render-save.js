var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storageKey = "travel-log-entries-v1";
var storage = {};
var listeners = {};
var container = { innerHTML: "" };
var search = {
  value: "",
  addEventListener: function () {}
};
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function entry(id, description) {
  return {
    id: id,
    trip: "Alaska Trip",
    date: "2027-04-08",
    time: "",
    location: "Seattle",
    description: description,
    notes: "",
    attachments: [],
    links: []
  };
}

function storedEntries() {
  return JSON.parse(storage[storageKey] || "[]");
}

function storedIds() {
  return storedEntries().map(function (item) { return item.id; }).join(",");
}

storage[storageKey] = JSON.stringify([entry("a", "Fly to Seattle")]);
storage[storageKey + "-trips"] = "{}";
storage[storageKey + "-settings"] = JSON.stringify({ descriptionSearchMethod: "chatgpt" });
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
    addEventListener: function (name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    querySelector: function (selector) {
      if (selector === ".trips") return container;
      if (selector === '[type="search"]') return search;
      return null;
    }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

var api = sandbox.TRAVEL_LOG_TEST_HOOKS;

function fire(name) {
  (listeners[name] || []).forEach(function (fn) { fn(); });
}

function waitReady() {
  return new Promise(function (resolve, reject) {
    var tries = 0;
    function tick() {
      if (api.isReady()) {
        resolve();
        return;
      }
      tries += 1;
      if (tries > 50) {
        reject(new Error("storage never became ready"));
        return;
      }
      setTimeout(tick, 10);
    }
    tick();
  });
}

api.setEntries([entry("a", "Fly to Seattle"), entry("d", "Passport pickup")]);
api.saveEntries();

fire("DOMContentLoaded");

waitReady().then(function () {
  assert(storedIds().indexOf("d") !== -1, "edit made before storage is ready is flushed, got " + storedIds());

  storage[storageKey] = JSON.stringify([entry("a", "Fly to Seattle"), entry("b", "Saved in another tab")]);
  storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: 5000 });
  search.value = "seattle";
  api.render();
  assert(storedIds() === "a,b", "search redraw does not overwrite a newer save, got " + storedIds());
  assert(JSON.parse(storage[storageKey + "-meta"]).updatedAt === 5000, "search redraw does not bump updatedAt");

  api.setEntries(api.entries().concat([entry("c", "Added here")]));
  return api.saveEntries();
}).then(function () {
  assert(storedIds().indexOf("c") !== -1, "an explicit save still persists, got " + storedIds());
  assert(JSON.parse(storage[storageKey + "-meta"]).updatedAt !== 5000, "an explicit save updates updatedAt");
  if (failures) {
    console.error(failures + " failed");
    process.exit(1);
  }
  console.log("all passed");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
