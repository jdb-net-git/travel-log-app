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

function link(id, label, url) {
  return { id: id, label: label, url: url };
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
    attachments: [],
    links: []
  };
}

var tripResources = {
  "Spain 2027 Trip": {
    attachments: [attachment("pass", "boarding-pass.txt")],
    links: [link("hotel", "Hotel", "https://hotel.example/spain")]
  },
  Weekend: {
    attachments: [attachment("note", "weekend-note.txt")],
    links: [link("map", "Map", "https://maps.example/weekend")]
  }
};

storage[storageKey] = JSON.stringify([
  entry("spain-1", "Spain 2027 Trip", "Arrive Madrid"),
  entry("week-1", "Weekend", "Day trip")
]);
storage[storageKey + "-trips"] = JSON.stringify(tripResources);
storage[storageKey + "-settings"] = JSON.stringify({ descriptionSearchMethod: "chatgpt" });
storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: 1000 });

function makeModal(fields) {
  var nodes = {};
  var modal = {
    querySelector: function (selector) {
      var match = String(selector || "").match(/\[name="([^"]+)"\]/);
      if (!match) return null;
      return nodes[match[1]] || null;
    },
    querySelectorAll: function () {
      return [];
    }
  };
  Object.keys(fields).forEach(function (name) {
    nodes[name] = {
      name: name,
      value: fields[name],
      files: name === "attachments" ? [] : undefined,
      disabled: false,
      textContent: "Save",
      closest: function () {
        return modal;
      }
    };
  });
  if (!nodes.attachments) {
    nodes.attachments = {
      name: "attachments",
      value: "",
      files: [],
      closest: function () {
        return modal;
      }
    };
  }
  return {
    modal: modal,
    button: {
      disabled: false,
      textContent: "Save",
      closest: function () {
        return modal;
      }
    }
  };
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
  setTimeout: setTimeout,
  document: {
    addEventListener: function (name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    querySelector: function (selector) {
      if (selector === ".trips") return { innerHTML: "" };
      if (selector === '[type="search"]') return { value: "", addEventListener: function () {} };
      return null;
    }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox);

var api = sandbox.TRAVEL_LOG_TEST_HOOKS;

(listeners.DOMContentLoaded || []).forEach(function (fn) {
  fn();
});

function names(list) {
  return list.map(function (item) { return item.name || item.label; }).join(",");
}

function savedResources() {
  return JSON.parse(storage[storageKey + "-trips"]);
}

var mergeUi = makeModal({
  originalTrip: "Weekend",
  tripName: "Spain 2027 Trip",
  linkUrl: "",
  linkLabel: ""
});

setTimeout(function () {
api.saveTrip({ target: mergeUi.button }).then(function () {
  var merged = api.tripResources();
  assert(!merged.Weekend, "renamed trip key is removed");
  assert(merged["Spain 2027 Trip"], "destination trip resources remain");
  assert(names(merged["Spain 2027 Trip"].attachments) === "boarding-pass.txt,weekend-note.txt", "destination attachments are kept and source attachments are merged, got " + names(merged["Spain 2027 Trip"].attachments));
  assert(names(merged["Spain 2027 Trip"].links) === "Hotel,Map", "destination links are kept and source links are merged, got " + names(merged["Spain 2027 Trip"].links));

  var stored = savedResources();
  assert(names(stored["Spain 2027 Trip"].attachments) === "boarding-pass.txt,weekend-note.txt", "merged attachments are persisted");
  assert(!stored.Weekend, "old trip resources are not persisted");

  var sameName = makeModal({
    originalTrip: "Spain 2027 Trip",
    tripName: "Spain 2027 Trip",
    linkUrl: "",
    linkLabel: ""
  });
  return api.saveTrip({ target: sameName.button });
}).then(function () {
  var again = api.tripResources()["Spain 2027 Trip"];
  assert(names(again.attachments) === "boarding-pass.txt,weekend-note.txt", "saving the same trip name does not duplicate attachments, got " + names(again.attachments));
  assert(names(again.links) === "Hotel,Map", "saving the same trip name does not duplicate links, got " + names(again.links));

  var moved = makeModal({
    originalTrip: "Spain 2027 Trip",
    tripName: "Iberia 2027",
    linkUrl: "",
    linkLabel: ""
  });
  return api.saveTrip({ target: moved.button });
}).then(function () {
  var resources = api.tripResources();
  assert(!resources["Spain 2027 Trip"], "resources leave the old name");
  assert(names(resources["Iberia 2027"].attachments) === "boarding-pass.txt,weekend-note.txt", "rename onto a new name keeps attachments, got " + names(resources["Iberia 2027"].attachments));
  if (failures) {
    console.error(failures + " failed");
    process.exit(1);
  }
  console.log("all passed");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
}, 0);
