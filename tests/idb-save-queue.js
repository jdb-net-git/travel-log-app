var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storageKey = "travel-log-entries-v1";
var storage = {};
var listeners = {};
var pending = [];
var committed = null;
var quotaArmed = false;
var failures = 0;
var container = { innerHTML: "" };
var backdrop = {
  removed: false,
  parentNode: null
};
backdrop.parentNode = {
  removeChild: function () { backdrop.removed = true; }
};

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

function tick() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

function waitPut() {
  var start = pending.length;
  return new Promise(function (resolve, reject) {
    var tries = 0;
    function check() {
      if (pending.length > start) {
        resolve(pending[start]);
        return;
      }
      tries += 1;
      if (tries > 40) {
        reject(new Error("timed out waiting for IndexedDB put"));
        return;
      }
      setTimeout(check, 5);
    }
    check();
  });
}

function drain() {
  return tick().then(function () {
    var open = pending.filter(function (item) { return !item.settled; });
    if (!open.length) return null;
    open.forEach(function (item) {
      item.settled = true;
      item.complete();
    });
    return drain();
  });
}

storage[storageKey] = JSON.stringify([entry("a", "Fly to Seattle")]);
storage[storageKey + "-trips"] = "{}";
storage[storageKey + "-settings"] = JSON.stringify({ descriptionSearchMethod: "chatgpt" });
storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: 1000 });
committed = {
  id: storageKey,
  entries: [entry("a", "Fly to Seattle")],
  tripResources: {},
  appSettings: { descriptionSearchMethod: "chatgpt" },
  updatedAt: 5000
};

function descriptions(list) {
  return (list || []).map(function (item) { return item.description; }).join("|");
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
  Error: Error,
  TRAVEL_LOG_TEST_HOOKS: {},
  localStorage: {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
    },
    setItem: function (key, value) {
      var text = String(value);
      if (quotaArmed && text.indexOf("QUOTA-TRIP") !== -1) throw new Error("quota");
      storage[key] = text;
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
            var tx = { oncomplete: null, onerror: null, onabort: null };
            tx.objectStore = function () {
              return {
                get: function () {
                  var req = { result: committed, onsuccess: null, onerror: null };
                  Promise.resolve().then(function () {
                    if (req.onsuccess) req.onsuccess();
                  });
                  return req;
                },
                put: function (value) {
                  var req = { onerror: null };
                  pending.push({
                    value: value,
                    settled: false,
                    complete: function () {
                      this.settled = true;
                      committed = JSON.parse(JSON.stringify(value));
                      if (tx.oncomplete) tx.oncomplete();
                    },
                    fail: function () {
                      if (req.onerror) req.onerror();
                      if (tx.onerror) tx.onerror();
                      if (tx.onabort) tx.onabort();
                    }
                  });
                  return req;
                }
              };
            };
            return tx;
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
    addEventListener: function (name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    querySelector: function (selector) {
      if (selector === ".trips") return container;
      if (selector === '[type="search"]') return { value: "", addEventListener: function () {} };
      if (selector === ".modal-backdrop") return backdrop.removed ? null : backdrop;
      return null;
    },
    createElement: function () {
      return { className: "", innerHTML: "" };
    },
    body: { appendChild: function () {} }
  }
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

var api = sandbox.TRAVEL_LOG_TEST_HOOKS;

function fire(name) {
  (listeners[name] || []).forEach(function (fn) { fn(); });
}

function waitReady() {
  return new Promise(function (resolve, reject) {
    var tries = 0;
    function check() {
      if (api.isReady()) {
        resolve();
        return;
      }
      tries += 1;
      if (tries > 40) {
        reject(new Error("storage never became ready"));
        return;
      }
      setTimeout(check, 5);
    }
    check();
  });
}

fire("DOMContentLoaded");

waitReady().then(function () {
  return tick();
}).then(function () {
  pending.forEach(function (item) {
    if (!item.settled) item.complete();
  });
  return tick();
}).then(function () {
  var queuedBefore = pending.length;
  api.setEntries([entry("a", "first snapshot")]);
  var firstSave = api.saveEntries();
  api.setEntries([entry("a", "first snapshot"), entry("b", "second snapshot")]);
  var secondSave = api.saveEntries();
  return waitPut().then(function (older) {
    assert(descriptions(older.value.entries) === "first snapshot", "queued write keeps the older snapshot, got " + descriptions(older.value.entries));
    assert(pending.length === queuedBefore + 1, "the later save waits until the older IndexedDB write commits");
    older.complete();
    return waitPut().then(function (newer) {
      assert(descriptions(newer.value.entries).indexOf("second snapshot") !== -1, "the next commit is the later snapshot");
      newer.complete();
      return Promise.all([firstSave, secondSave]);
    });
  });
}).then(function (results) {
  assert(results[0] === true && results[1] === true, "both ordered saves report success");
  assert(descriptions(committed.entries).indexOf("second snapshot") !== -1, "IndexedDB ends on the later snapshot");
  var seen = container.innerHTML;
  api.setEntries([entry("a", "VISIBLE-AFTER-COMMIT")]);
  var shown = api.persistAndRender();
  var shownPut = waitPut();
  return tick().then(function () {
    assert(container.innerHTML === seen, "itinerary stays unchanged until IndexedDB commits");
    assert(!backdrop.removed, "edit dialog stays up until IndexedDB commits");
    return shownPut;
  }).then(function (put) {
    put.complete();
    return shown.then(function () { return tick(); });
  });
}).then(function () {
  assert(container.innerHTML.indexOf("VISIBLE-AFTER-COMMIT") !== -1, "itinerary updates after the commit");
  assert(backdrop.removed, "edit dialog closes after the commit");
  return drain();
}).then(function () {
  var before = storage[storageKey];
  var beforeMeta = storage[storageKey + "-meta"];
  quotaArmed = true;
  api.setEntries([entry("a", "QUOTA-TRIP")]);
  var quotaSave = api.saveEntries();
  return waitPut().then(function (put) {
    put.complete();
    return quotaSave.then(function (saved) {
      assert(saved === true, "a quota failure still succeeds when IndexedDB commits");
      assert(storage[storageKey] === before, "localStorage entries roll back after a quota error");
      assert(storage[storageKey + "-meta"] === beforeMeta, "updatedAt rolls back with the entries");
      assert(descriptions(committed.entries).indexOf("QUOTA-TRIP") !== -1, "IndexedDB kept the quota-rejected snapshot");
    });
  });
}).then(function () {
  api.setEntries([entry("a", "QUOTA-TRIP lost")]);
  var failed = api.saveEntries();
  return waitPut().then(function (put) {
    put.fail();
    return failed;
  });
}).then(function (saved) {
  assert(saved === false, "save reports failure when localStorage and IndexedDB both reject it, got " + saved);
  if (failures) {
    console.error(failures + " failed");
    process.exit(1);
  }
  console.log("all passed");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
