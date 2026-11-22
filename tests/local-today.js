var fs = require("fs");
var path = require("path");
var vm = require("vm");
var spawnSync = require("child_process").spawnSync;

if (!process.env.TRAVEL_LOG_TZ_CHILD) {
  runChild("America/Los_Angeles", "2026-11-05T04:30:00.000Z", "2026-11-04");
  runChild("Asia/Tokyo", "2026-11-04T20:30:00.000Z", "2026-11-05");
  console.log("all passed");
  process.exit(0);
}

var fixedIso = process.env.FIXED_ISO;
var expected = process.env.EXPECTED_DATE;
var RealDate = Date;

function FakeDate(year, month, day, hours, minutes, seconds, ms) {
  var args = arguments;
  var result;
  if (args.length === 0) result = new RealDate(fixedIso);
  else if (args.length === 1) result = new RealDate(year);
  else result = new RealDate(year, month, day || 1, hours || 0, minutes || 0, seconds || 0, ms || 0);
  if (!(this instanceof FakeDate)) return result;
  return result;
}
FakeDate.prototype = RealDate.prototype;
FakeDate.now = function () { return new RealDate(fixedIso).getTime(); };
FakeDate.parse = RealDate.parse;
FakeDate.UTC = RealDate.UTC;

var hooks = {};
var sandbox = {
  console: console,
  Intl: Intl,
  Date: FakeDate,
  Number: Number,
  String: String,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  Promise: Promise,
  RegExp: RegExp,
  setTimeout: setTimeout,
  TRAVEL_LOG_TEST_HOOKS: hooks,
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; },
    createElement: function () { return { className: "", innerHTML: "" }; },
    body: { appendChild: function () {}, removeChild: function () {} }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

var source = fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8");
source = source.replace(
  "})();",
  "if (typeof TRAVEL_LOG_TEST_HOOKS !== \"undefined\" && TRAVEL_LOG_TEST_HOOKS) {\n" +
    "  TRAVEL_LOG_TEST_HOOKS.today = today;\n" +
    "}\n})();"
);
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

var actual = hooks.today();
if (actual !== expected) {
  console.error("FAIL: " + process.env.TZ + " at " + fixedIso + " stored " + actual + ", expected " + expected);
  process.exit(1);
}
console.log("ok: " + process.env.TZ + " stores " + actual);

function runChild(timeZone, fixedIsoValue, expectedDate) {
  var env = {};
  Object.keys(process.env).forEach(function (key) { env[key] = process.env[key]; });
  env.TZ = timeZone;
  env.TRAVEL_LOG_TZ_CHILD = "1";
  env.FIXED_ISO = fixedIsoValue;
  env.EXPECTED_DATE = expectedDate;
  var result = spawnSync(process.execPath, [__filename], { env: env, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}
