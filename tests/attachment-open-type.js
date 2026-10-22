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

var code = fs.readFileSync(path.join(__dirname, "..", "travel-log.js"), "utf8").replace(/\}\)\(\);\s*$/, [
  "  global.__api = { dataUrlToBlob: dataUrlToBlob };",
  "})();"
].join("\n"));

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
  Uint8Array: Uint8Array,
  Blob: Blob,
  atob: atob,
  TextDecoder: TextDecoder,
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  indexedDB: null,
  document: {
    addEventListener: function () {},
    querySelector: function () { return null; }
  },
  setTimeout: setTimeout
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

var dataUrlToBlob = sandbox.__api.dataUrlToBlob;

function blobType(dataUrl, fallbackType) {
  return dataUrlToBlob(dataUrl, fallbackType).type;
}

assert(blobType("data:text/html;base64,PGgxPmhpPC9oMT4=") === "application/octet-stream", "html attachments do not open as text/html");
assert(blobType("data:TEXT/HTML;base64,PGgxPmhpPC9oMT4=") === "application/octet-stream", "html media types are matched case-insensitively");
assert(blobType("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=") === "application/octet-stream", "svg attachments do not open as image/svg+xml");
assert(blobType("data:application/xhtml+xml;base64,PGgxPmhpPC9oMT4=") === "application/octet-stream", "xhtml attachments do not open as markup");
assert(blobType("data:text/html;charset=utf-8;base64,PGgxPmhpPC9oMT4=", "text/html") === "application/octet-stream", "charset html header still cannot fall back to text/html");
assert(blobType("data:application/pdf;base64,JVBERg==") === "application/pdf", "pdf attachments still open as pdf");
assert(blobType("data:application/pdf;charset=binary;base64,JVBERg==", "application/pdf") === "application/pdf", "pdf parameters do not change the preview type");
assert(blobType("data:image/png;base64,iVBORw==") === "image/png", "png attachments still open as images");
assert(blobType("data:image/jpeg;base64,/9j/") === "image/jpeg", "jpeg attachments still open as images");
assert(blobType("data:image/jpg;base64,/9j/") === "image/jpeg", "jpg media type opens as jpeg");
assert(blobType("data:text/plain;base64,aGk=") === "text/plain", "plain text attachments still open as text");
assert(blobType("data:application/octet-stream;base64,aGk=", "text/html") === "application/octet-stream", "declared fallback cannot override a non-preview data url");

var pdf = dataUrlToBlob("data:application/pdf;base64,JVBERg==");
assert(pdf.size === 4, "pdf bytes are still decoded, size " + pdf.size);

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("all passed");
