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

function entry(id, trip) {
  return {
    id: id,
    trip: trip,
    date: "2027-05-04",
    time: "",
    location: "Madrid",
    description: "Arrive",
    notes: "",
    attachments: [],
    links: []
  };
}

function ticket(name) {
  return {
    attachments: [{
      id: "file-" + name,
      name: name,
      type: "application/pdf",
      size: 4,
      addedAt: "",
      dataUrl: "data:application/pdf;base64,QQ=="
    }],
    links: []
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
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; }
  },
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8"), sandbox, { filename: "travel-log.js" });

var api = sandbox.TRAVEL_LOG_TEST_HOOKS;
var spain = entry("spain-1", "Spain 2027 Trip");
var alaska = entry("alaska-1", "Alaska Trip");

api.setState([spain, alaska], {
  "Spain 2027 Trip": ticket("spain-ticket.pdf"),
  "Alaska Trip": ticket("alaska-ticket.pdf"),
  "Italy Trip": ticket("italy-ticket.pdf"),
  "Empty Trip": { attachments: [], links: [] }
});

var names = api.tripNamesForRender([spain, alaska], false);
assert(names.indexOf("Spain 2027 Trip") !== -1, "trips with events stay visible");
assert(names.indexOf("Alaska Trip") !== -1, "second trip with events stays visible");
assert(names.indexOf("Italy Trip") !== -1, "trip files stay visible after its last event is gone, got " + names.join(", "));
assert(names.indexOf("Empty Trip") === -1, "a trip with no events and no files stays hidden");
assert(names.filter(function (name) { return name === "Spain 2027 Trip"; }).length === 1, "a trip with events and files is not duplicated");
assert(names.indexOf("Italy Trip") > names.indexOf("Alaska Trip") && names.indexOf("Italy Trip") > names.indexOf("Spain 2027 Trip"), "file-only trips follow trips that still have events");

var searching = api.tripNamesForRender([spain], true);
assert(searching.indexOf("Italy Trip") === -1, "search does not surface unrelated file-only trips, got " + searching.join(", "));
assert(searching.join("|") === "Spain 2027 Trip", "search still shows the matching event trip, got " + searching.join("|"));

api.setState([], {
  "Italy Trip": ticket("italy-ticket.pdf")
});
assert(api.tripNamesForRender([], false).join("|") === "Italy Trip", "only the file-only trip remains");
var known = api.knownTripNames();
assert(known.join("|") === "Italy Trip", "backup and event pickers still list the file-only trip, got " + known.join("|"));

api.setState([spain], {
  "Spain 2027 Trip": ticket("spain-ticket.pdf")
});
assert(api.knownTripNames().join("|") === "Spain 2027 Trip", "picker lists an active trip once");

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all orphan trip resource checks passed");
