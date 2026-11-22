var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function loadScript(filename, context) {
  context.window = context;
  context.globalThis = context;
  context.console = console;
  context.Promise = Promise;
  context.setTimeout = setTimeout;
  context.clearTimeout = clearTimeout;
  context.Intl = Intl;
  context.URL = URL;
  context.URLSearchParams = URLSearchParams;
  context.__TRAVEL_LOG_TEST__ = context.__TRAVEL_LOG_TEST__ || {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, filename), "utf8"), context, { filename: filename });
  return context.__TRAVEL_LOG_TEST__;
}

function memoryStorage(initial) {
  var store = Object.assign({}, initial || {});
  var writes = [];
  return {
    writes: writes,
    store: store,
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem: function (key, value) {
      store[key] = String(value);
      writes.push(key);
    },
    removeItem: function (key) {
      delete store[key];
    }
  };
}

function baseDocument() {
  return {
    _listeners: {},
    body: { appendChild: function () {}, removeChild: function () {} },
    addEventListener: function (name, fn) {
      this._listeners[name] = fn;
    },
    querySelector: function (selector) {
      if (selector === ".trips") return { innerHTML: "" };
      return null;
    },
    createElement: function () {
      return { className: "", innerHTML: "" };
    }
  };
}

function failingIndexedDb() {
  return {
    open: function () {
      var request = { error: new Error("IndexedDB unavailable") };
      setTimeout(function () {
        if (request.onerror) request.onerror();
      }, 0);
      return request;
    }
  };
}

function emptyIndexedDb() {
  return {
    open: function () {
      var request = {};
      var db = {
        objectStoreNames: { contains: function () { return true; } },
        close: function () {},
        transaction: function () {
          var tx = {
            objectStore: function () {
              return {
                get: function () {
                  var getRequest = { result: undefined };
                  setTimeout(function () {
                    if (getRequest.onsuccess) getRequest.onsuccess();
                    if (tx.oncomplete) tx.oncomplete();
                  }, 0);
                  return getRequest;
                },
                put: function () {
                  return {};
                }
              };
            }
          };
          return tx;
        }
      };
      setTimeout(function () {
        request.result = db;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }
  };
}

function bootTravelLog(storage, indexedDB) {
  var context = {
    localStorage: storage,
    indexedDB: indexedDB,
    document: baseDocument(),
    location: { href: "http://localhost/index.html", search: "" }
  };
  loadScript("travel-log.js", context);
  context.document._listeners.DOMContentLoaded();
  return context;
}

function testPureHelpers() {
  var api = loadScript("travel-log.js", {
    localStorage: memoryStorage(),
    document: baseDocument(),
    location: { href: "http://localhost/index.html", search: "" }
  });

  assert.strictEqual(api.formatDate("2026-13-05"), "Invalid date");
  assert.strictEqual(api.formatDate(""), "Invalid date");
  assert.ok(api.formatDate("2027-05-04").indexOf("2027") !== -1);
  assert.strictEqual(api.formatTime("ab:cd"), "");
  assert.ok(api.formatTime("13:50").length > 0);

  assert.strictEqual(api.chooseStoredState(
    { entries: [{ id: "local" }], updatedAt: 10 },
    { entries: [{ id: "indexed" }], updatedAt: 20 }
  ), "indexed");
  assert.strictEqual(api.chooseStoredState(
    { entries: [{ id: "local" }], updatedAt: 20 },
    { entries: [{ id: "indexed" }], updatedAt: 10 }
  ), "local");
  assert.strictEqual(api.chooseStoredState(
    { entries: [{ id: "local" }], updatedAt: 5 },
    null
  ), "local");
  assert.strictEqual(api.chooseStoredState({ entries: null, updatedAt: 0 }, null), "empty");
  assert.strictEqual(api.chooseStoredState(
    { entries: [{ id: "stale" }], updatedAt: 4 },
    { entries: [], updatedAt: 5 }
  ), "indexed");

  assert.strictEqual(JSON.stringify(api.entriesAfterUnreadableIndexedDb(null)), "[]");
  assert.strictEqual(JSON.stringify(api.entriesAfterUnreadableIndexedDb([{ id: "kept" }])), JSON.stringify([{ id: "kept" }]));

  var matched = api.entriesMatchingTrip([
    { trip: "Spain 2027 Trip" },
    { trip: "spain 2027 trip" },
    { trip: "Alaska Trip" }
  ], "Spain 2027 Trip");
  assert.strictEqual(matched.length, 2);

  var merged = api.combineTripResources(
    { attachments: [{ id: "dest", name: "dest.pdf", dataUrl: "data:text/plain,dest" }], links: [{ id: "d", url: "https://example.com/d" }] },
    [{ id: "src", name: "src.pdf", dataUrl: "data:text/plain,src" }],
    [{ id: "s", url: "https://example.com/s" }]
  );
  assert.strictEqual(JSON.stringify(merged.attachments.map(function (item) { return item.id; })), JSON.stringify(["dest", "src"]));
  assert.strictEqual(JSON.stringify(merged.links.map(function (item) { return item.id; })), JSON.stringify(["d", "s"]));

  var grouped = api.groupByTrip([{ trip: "constructor", date: "2027-05-04", time: "" }]);
  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(grouped[0][0], "constructor");
}

function testPlaceChoice() {
  var api = loadScript("place.js", {
    localStorage: memoryStorage(),
    document: baseDocument(),
    location: { href: "http://localhost/place.html", search: "" }
  });
  assert.strictEqual(api.formatDate("2026-13-01"), "Invalid date");
  assert.strictEqual(JSON.stringify(api.chooseDashboardEntries(
    { entries: [{ id: "new" }], updatedAt: 30 },
    { entries: [{ id: "old" }], updatedAt: 10 }
  ).map(function (entry) { return entry.id; })), JSON.stringify(["new"]));
  assert.strictEqual(JSON.stringify(api.chooseDashboardEntries(
    { entries: [{ id: "stale-local" }], updatedAt: 2 },
    { entries: [], updatedAt: 9 }
  )), "[]");
  assert.strictEqual(JSON.stringify(api.chooseDashboardEntries(
    { entries: null, updatedAt: 0 },
    { entries: [{ id: "indexed" }], updatedAt: 1 }
  ).map(function (entry) { return entry.id; })), JSON.stringify(["indexed"]));
}

function testFailedReadDoesNotReplaceTrips() {
  var storage = memoryStorage();
  bootTravelLog(storage, failingIndexedDb());
  return delay(40).then(function () {
    assert.deepStrictEqual(storage.writes, []);
  });
}

function testEmptyDatabaseStillSavesSample() {
  var storage = memoryStorage();
  bootTravelLog(storage, emptyIndexedDb());
  return delay(40).then(function () {
    assert.ok(storage.writes.indexOf("travel-log-entries-v1") !== -1);
    assert.ok(storage.store["travel-log-entries-v1"].indexOf("Alaska Trip") !== -1);
  });
}

testPureHelpers();
testPlaceChoice();
Promise.all([
  testFailedReadDoesNotReplaceTrips(),
  testEmptyDatabaseStillSavesSample()
]).then(function () {
  console.log("critical-fixes: ok");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
