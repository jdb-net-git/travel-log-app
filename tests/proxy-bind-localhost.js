var assert = require("assert");
var cp = require("child_process");
var fs = require("fs");
var http = require("http");
var path = require("path");

var port = 39221;
var child = cp.spawn(process.execPath, ["grok-place-proxy.example.js"], {
  cwd: path.join(__dirname, ".."),
  env: Object.assign({}, process.env, {
    XAI_API_KEY: "test-key-not-real",
    PORT: String(port)
  }),
  stdio: ["ignore", "pipe", "pipe"]
});

var output = "";
child.stdout.on("data", function (chunk) { output += chunk; });
child.stderr.on("data", function (chunk) { output += chunk; });

function finish(error) {
  child.kill("SIGTERM");
  if (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
  console.log("proxy binds to 127.0.0.1 only");
  process.exit(0);
}

function hexPort(value) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function boundAddresses(portHex) {
  var addresses = [];
  ["/proc/net/tcp", "/proc/net/tcp6"].forEach(function (file) {
    if (!fs.existsSync(file)) return;
    fs.readFileSync(file, "utf8").split("\n").slice(1).forEach(function (line) {
      var parts = line.trim().split(/\s+/);
      if (parts.length < 2) return;
      var local = parts[1].split(":");
      if (local[1] !== portHex) return;
      addresses.push(local[0]);
    });
  });
  return addresses;
}

setTimeout(function () {
  finish(new Error("proxy did not start\n" + output));
}, 5000);

var started = setInterval(function () {
  if (output.indexOf("listening on http://127.0.0.1:" + port) === -1) return;
  clearInterval(started);

  var addresses = boundAddresses(hexPort(port));
  try {
    assert.ok(addresses.length > 0, "expected a listening socket for port " + port);
    addresses.forEach(function (address) {
      assert.strictEqual(address, "0100007F", "socket is not bound to 127.0.0.1: " + address);
    });
  } catch (error) {
    finish(error);
    return;
  }

  http.get("http://127.0.0.1:" + port + "/api/grok-place", function (response) {
    var body = "";
    response.on("data", function (chunk) { body += chunk; });
    response.on("end", function () {
      try {
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(JSON.parse(body).error, "Missing location");
        finish();
      } catch (error) {
        finish(error);
      }
    });
  }).on("error", finish);
}, 50);
