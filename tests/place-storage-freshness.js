var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storageKey = "travel-log-entries-v1";
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function entry(description) {
  return {
    id: "entry-" + description,
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

function runCase(name, localUpdatedAt, indexedUpdatedAt, localEntries, indexedEntries, expectText, rejectText) {
  var storage = {};
  var elements = {};
  var listeners = [];
  storage[storageKey] = JSON.stringify(localEntries);
  storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: localUpdatedAt });
  var indexedRecord = indexedEntries === null ? null : {
    id: storageKey,
    entries: indexedEntries,
    updatedAt: indexedUpdatedAt
  };

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
    Error: Error,
    URLSearchParams: URLSearchParams,
    fetch: function () {
      return Promise.resolve({
        ok: true,
        json: function () { return Promise.resolve([]); }
      });
    },
    location: { search: "?location=Seattle&trip=Alaska%20Trip", protocol: "file:", hostname: "" },
    localStorage: {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      }
    },
    indexedDB: {
      open: function () {
        var request = {
          result: {
            objectStoreNames: { contains: function () { return true; } },
            transaction: function () {
              return {
                objectStore: function () {
                  return {
                    get: function () {
                      var req = { result: indexedRecord, onsuccess: null, onerror: null };
                      Promise.resolve().then(function () {
                        if (req.onsuccess) req.onsuccess();
                      });
                      return req;
                    }
                  };
                }
              };
            }
          },
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        };
        Promise.resolve().then(function () {
          if (request.onsuccess) request.onsuccess();
        });
        return request;
      }
    },
    document: {
      addEventListener: function (eventName, fn) {
        if (eventName === "DOMContentLoaded") listeners.push(fn);
      },
      getElementById: function (id) {
        if (!elements[id]) elements[id] = { textContent: "", innerHTML: "", href: "" };
        return elements[id];
      }
    }
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "place.js"), "utf8"), sandbox);
  listeners.forEach(function (fn) { fn(); });

  return new Promise(function (resolve, reject) {
    var tries = 0;
    function check() {
      var html = elements.cards ? elements.cards.innerHTML : "";
      if (html) {
        assert(html.indexOf(expectText) !== -1, name + " shows " + expectText);
        assert(!rejectText || html.indexOf(rejectText) === -1, name + " hides " + rejectText);
        resolve();
        return;
      }
      tries += 1;
      if (tries > 40) {
        reject(new Error(name + " did not render cards"));
        return;
      }
      setTimeout(check, 5);
    }
    check();
  });
}

Promise.resolve().then(function () {
  return runCase(
    "newer localStorage",
    5000,
    1000,
    [entry("Passport office")],
    [entry("Old boarding pass")],
    "Passport office",
    "Old boarding pass"
  );
}).then(function () {
  return runCase(
    "newer IndexedDB",
    1000,
    5000,
    [entry("Stale local note")],
    [entry("Ship boarding pass")],
    "Ship boarding pass",
    "Stale local note"
  );
}).then(function () {
  return runCase(
    "equal timestamps",
    2000,
    2000,
    [entry("Local tie")],
    [entry("Database tie")],
    "Database tie",
    "Local tie"
  );
}).then(function () {
  return runCase(
    "newer empty IndexedDB",
    1000,
    9000,
    [entry("Deleted event")],
    [],
    "Seattle",
    "Deleted event"
  );
}).then(function () {
  if (failures) {
    console.error(failures + " failed");
    process.exit(1);
  }
  console.log("all passed");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
