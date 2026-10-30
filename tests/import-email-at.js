var fs = require("fs");
var path = require("path");
var vm = require("vm");

var code = fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8");
code = code.replace(
  "function createId() {\n    return \"entry-\" + Date.now() + \"-\" + Math.random().toString(16).slice(2);\n  }\n})();",
  "function createId() {\n    return \"entry-\" + Date.now() + \"-\" + Math.random().toString(16).slice(2);\n  }\n  globalThis.__api = { parseFreeformEvents: parseFreeformEvents };\n})();"
);

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
  RegExp: RegExp,
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

var parseFreeformEvents = sandbox.__api.parseFreeformEvents;
var failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
}

function first(text) {
  var parsed = parseFreeformEvents(text);
  assert(parsed.length >= 1, "expected an event from " + JSON.stringify(text) + ", got " + parsed.length);
  return parsed[0] || {};
}

var email = first("Spain 2027 Trip\n5/4 Email hotels@radisson.com about Madrid");
assert(email.description === "Email hotels@radisson.com about Madrid", "email in a freeform line is kept, got " + JSON.stringify(email.description));
assert(email.location === "Madrid", "Madrid still resolves, got " + JSON.stringify(email.location));
assert(email.date === "2027-05-04", "date stays on the heading year, got " + email.date);

var mixed = first("Spain 2027 Trip\n5/4 Contact ada@example.com @ 3 PM in Bilbao");
assert(mixed.description === "Contact ada@example.com at 3 PM in Bilbao", "email stays and the clock @ is rewritten, got " + JSON.stringify(mixed.description));
assert(mixed.time === "15:00", "clock after the email is still stored, got " + JSON.stringify(mixed.time));
assert(mixed.location === "Bilbao", "Bilbao still resolves, got " + JSON.stringify(mixed.location));

var numericDomain = first("Trip 2027\n6/1 Write user@123.com in Madrid");
assert(numericDomain.description === "Write user@123.com in Madrid", "an @ before a digit inside an email is kept, got " + JSON.stringify(numericDomain.description));

var clock = first("Trip 2027\n6/2 @ 10 AM Train");
assert(clock.time === "10:00", "@ 10 AM still imports as 10:00, got " + JSON.stringify(clock.time));
assert(clock.description === "at 10 AM Train", "a leading clock @ still reads as at, got " + JSON.stringify(clock.description));
assert(clock.location === "Train", "Train still resolves, got " + JSON.stringify(clock.location));

var exported = first("Trip 2027\n2027-06-03 | Location: Madrid | Description: Email hotels@radisson.com | Notes: a@b.com");
assert(exported.description === "Email hotels@radisson.com", "export lines keep @ in the description, got " + JSON.stringify(exported.description));
assert(exported.notes === "a@b.com", "export lines keep @ in notes, got " + JSON.stringify(exported.notes));

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
