var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storageKey = "travel-log-entries-v1";
var storage = {};
var listeners = {};
var container = { innerHTML: "" };
var failures = 0;
var releaseIndexedDb = null;
var indexedDbOpened = new Promise(function (resolve) {
  releaseIndexedDb = resolve;
});

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

function storedDescriptions() {
  return storedEntries().map(function (item) { return item.description; });
}

storage[storageKey] = JSON.stringify([entry("a", "Fly to Seattle")]);
storage[storageKey + "-trips"] = "{}";
storage[storageKey + "-settings"] = JSON.stringify({ descriptionSearchMethod: "chatgpt" });
storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: 1000 });

var idbRecord = {
  id: storageKey,
  entries: [entry("a", "Fly to Seattle"), entry("b", "Ship boarding pass")],
  tripResources: {},
  appSettings: { descriptionSearchMethod: "chatgpt" },
  updatedAt: 5000
};

function later(fn) {
  Promise.resolve().then(fn);
}

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
  indexedDB: {
    open: function () {
      var request = {
        result: {
          objectStoreNames: { contains: function () { return true; } },
          transaction: function () {
            var tx = {
              oncomplete: null,
              onerror: null,
              objectStore: function () {
                return {
                  get: function () {
                    var getReq = { result: idbRecord, onsuccess: null, onerror: null };
                    later(function () {
                      if (getReq.onsuccess) getReq.onsuccess();
                    });
                    return getReq;
                  },
                  put: function (value) {
                    idbRecord = value;
                    return {};
                  }
                };
              }
            };
            later(function () {
              if (tx.oncomplete) tx.oncomplete();
            });
            return tx;
          }
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      };
      indexedDbOpened.then(function () {
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    }
  },
  document: {
    addEventListener: function (name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    querySelector: function (selector) {
      if (selector === ".trips") return container;
      if (selector === '[type="search"]') return { value: "", addEventListener: function () {} };
      return null;
    },
    createElement: function () {
      return { className: "", innerHTML: "" };
    },
    body: { appendChild: function () {} }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

function fire(name) {
  (listeners[name] || []).forEach(function (fn) { fn(); });
}

function fireClick(action) {
  var event = {
    target: {
      className: "",
      closest: function (selector) {
        if (selector !== "[data-action]") return null;
        return {
          getAttribute: function (name) {
            return name === "data-action" ? action : "";
          }
        };
      }
    }
  };
  (listeners.click || []).forEach(function (fn) { fn(event); });
}

function waitForStored(description) {
  return new Promise(function (resolve, reject) {
    var tries = 0;
    function tick() {
      if (storedDescriptions().indexOf(description) !== -1) {
        resolve();
        return;
      }
      tries += 1;
      if (tries > 50) {
        reject(new Error("timed out waiting for " + description + ", got " + storedDescriptions().join(" | ")));
        return;
      }
      setTimeout(tick, 10);
    }
    tick();
  });
}

fire("DOMContentLoaded");
sandbox.pendingImportFileText = "2027-04-09 | Location: Juneau | Description: Early Import Event\n";
fireClick("import-file-add");

assert(
  container.innerHTML.indexOf("Early Import Event") === -1,
  "an import started before storage loads must not render, got a trip list that includes it"
);

releaseIndexedDb();

waitForStored("Early Import Event").then(function () {
  assert(
    storedDescriptions().indexOf("Ship boarding pass") !== -1,
    "pre-load import is applied onto the IndexedDB snapshot, got " + storedDescriptions().join(" | ")
  );
  assert(
    storedDescriptions().indexOf("Fly to Seattle") !== -1,
    "existing local entry is kept, got " + storedDescriptions().join(" | ")
  );

  if (failures) {
    console.error(failures + " failed");
    process.exit(1);
  }
  console.log("all passed");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
