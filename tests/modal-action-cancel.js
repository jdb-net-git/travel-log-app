var fs = require("fs");
var path = require("path");
var vm = require("vm");

var storageKey = "travel-log-entries-v1";
var storage = {};
var listeners = {};
var failures = 0;
var pendingReads = [];
var heldWrites = [];
var holdWrites = false;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error("FAIL: " + message);
  } else {
    console.log("ok: " + message);
  }
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

function textToBuffer(text) {
  var bytes = new Uint8Array(text.length);
  for (var i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 255;
  return bytes.buffer;
}

function nextTurn() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

function FileReader() {
  this.onload = null;
  this.onerror = null;
  this.result = "";
}

FileReader.prototype.readAsDataURL = function () {
  var reader = this;
  pendingReads.push(function () {
    reader.result = "data:text/plain;base64,QQ==";
    if (reader.onload) reader.onload();
  });
};

function releaseRead() {
  var finish = pendingReads.shift();
  if (!finish) throw new Error("No file read is waiting");
  finish();
}

function makeDb() {
  return {
    objectStoreNames: {
      contains: function () { return true; }
    },
    transaction: function () {
      var tx = {
        oncomplete: null,
        onerror: null,
        objectStore: function () {
          return {
            get: function () {
              var request = { result: null, onsuccess: null, onerror: null };
              setTimeout(function () {
                if (request.onsuccess) request.onsuccess();
              }, 0);
              return request;
            },
            put: function () {
              if (!holdWrites) {
                setTimeout(function () {
                  if (tx.oncomplete) tx.oncomplete();
                }, 0);
                return;
              }
              heldWrites.push(tx);
            }
          };
        }
      };
      return tx;
    }
  };
}

var indexedDb = {
  open: function () {
    var request = {
      result: makeDb(),
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    setTimeout(function () {
      if (request.onsuccess) request.onsuccess();
    }, 0);
    return request;
  }
};

function releaseWrite() {
  var tx = heldWrites.shift();
  if (!tx) throw new Error("No IndexedDB write is waiting");
  if (tx.oncomplete) tx.oncomplete();
}

storage[storageKey] = JSON.stringify([
  entry("spain-1", "Spain 2027 Trip", "Arrive Madrid")
]);
storage[storageKey + "-trips"] = JSON.stringify({
  "Spain 2027 Trip": { attachments: [], links: [] }
});
storage[storageKey + "-settings"] = JSON.stringify({ descriptionSearchMethod: "chatgpt" });
storage[storageKey + "-meta"] = JSON.stringify({ updatedAt: 1000 });

function makeModal(fields, files) {
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
      files: name === "attachments" ? (files || []) : undefined,
      disabled: false,
      textContent: "Save",
      closest: function () { return modal; }
    };
  });
  if (!nodes.attachments) {
    nodes.attachments = {
      name: "attachments",
      value: "",
      files: files || [],
      closest: function () { return modal; }
    };
  }
  return {
    button: {
      disabled: false,
      textContent: "Save",
      closest: function () { return modal; }
    }
  };
}

function attachmentFile() {
  return { name: "ticket.txt", type: "text/plain", size: 1 };
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
  Uint8Array: Uint8Array,
  TextDecoder: TextDecoder,
  FileReader: FileReader,
  indexedDB: indexedDb,
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
    },
    createElement: function () {
      return {
        className: "",
        innerHTML: "",
        appendChild: function () {}
      };
    },
    body: {
      appendChild: function () {}
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

function descriptions() {
  return api.entries().map(function (item) {
    return item.description;
  }).join("|");
}

function storedDescriptions() {
  return JSON.parse(storage[storageKey]).map(function (item) {
    return item.description;
  }).join("|");
}

function trips() {
  return api.entries().map(function (item) {
    return item.trip;
  }).join("|");
}

function waitReady() {
  return nextTurn().then(function () {
    if (api.storageReady()) return;
    return waitReady();
  });
}

function settle() {
  return nextTurn().then(nextTurn).then(nextTurn).then(nextTurn);
}

function backupFile(description, delayRead) {
  var json = JSON.stringify({
    app: "travel-log",
    version: 2,
    entries: [entry("spain-1", "Spain 2027 Trip", description)],
    tripResources: {},
    appSettings: { descriptionSearchMethod: "chatgpt" }
  });
  var buffer = textToBuffer(json);
  var waiting = [];
  return {
    name: "backup.json",
    release: function () {
      waiting.splice(0).forEach(function (resolve) { resolve(buffer); });
    },
    arrayBuffer: function () {
      if (!delayRead) return Promise.resolve(buffer);
      return new Promise(function (resolve) {
        waiting.push(resolve);
      });
    }
  };
}

waitReady().then(function () {
  return settle();
}).then(function () {
  var kept = makeModal({
    entryId: "spain-1",
    trip: "Spain 2027 Trip",
    location: "Madrid",
    date: "2027-05-04",
    time: "",
    description: "Kept edit",
    notes: "",
    linkUrl: "",
    linkLabel: ""
  }, [attachmentFile()]);
  var firstSave = api.saveEntry({ target: kept.button });
  api.dismissModal();
  var fresh = makeModal({
    entryId: "spain-1",
    trip: "Spain 2027 Trip",
    location: "Madrid",
    date: "2027-05-04",
    time: "",
    description: "Fresh edit",
    notes: "",
    linkUrl: "",
    linkLabel: ""
  }, []);
  return api.saveEntry({ target: fresh.button }).then(function () {
    assert(descriptions() === "Fresh edit", "newer edit is kept while an older attachment save is still reading, got " + descriptions());
    releaseRead();
    return firstSave;
  }).then(function () {
    assert(descriptions() === "Fresh edit", "finished attachment save does not overwrite the newer edit, got " + descriptions());
    assert(storedDescriptions() === "Fresh edit", "newer edit is the copy persisted after the stale save finishes, got " + storedDescriptions());
  });
}).then(function () {
  var renamed = makeModal({
    originalTrip: "Spain 2027 Trip",
    tripName: "Stale Trip",
    linkUrl: "",
    linkLabel: ""
  }, [attachmentFile()]);
  var staleRename = api.saveTrip({ target: renamed.button });
  api.dismissModal();
  var current = makeModal({
    originalTrip: "Spain 2027 Trip",
    tripName: "Current Trip",
    linkUrl: "",
    linkLabel: ""
  }, []);
  return api.saveTrip({ target: current.button }).then(function () {
    releaseRead();
    return staleRename;
  }).then(function () {
    assert(trips() === "Current Trip", "cancelled trip rename does not replace a newer rename, got " + trips());
    var resources = api.tripResources();
    assert(!resources["Stale Trip"], "cancelled rename does not leave trip files on the abandoned name");
    assert(resources["Current Trip"], "newer rename keeps the trip files");
  });
}).then(function () {
  var file = backupFile("From backup", true);
  api.setPendingBackupFile(file);
  var restore = api.restoreBackupFile();
  api.dismissModal();
  file.release();
  return restore.then(function () {
    assert(descriptions() === "Fresh edit", "cancelling a restore before the file finishes leaves current events, got " + descriptions());
    assert(storedDescriptions() === "Fresh edit", "cancelled restore does not persist the backup, got " + storedDescriptions());
  });
}).then(function () {
  return settle();
}).then(function () {
  holdWrites = true;
  var file = backupFile("From backup", false);
  api.setPendingBackupFile(file);
  var restore = api.restoreBackupFile();
  return settle().then(function () {
    assert(descriptions() === "From backup", "restore swaps events in memory once the file has been read");
    assert(heldWrites.length === 1, "restore storage write is still in flight, held " + heldWrites.length);
    api.dismissModal();
    releaseWrite();
    return settle();
  }).then(function () {
    assert(descriptions() === "Fresh edit", "dismiss during save restores the previous events in memory, got " + descriptions());
    assert(heldWrites.length === 1, "reverted restore write is still in flight, held " + heldWrites.length);
    releaseWrite();
    holdWrites = false;
    return restore;
  }).then(function () {
    assert(descriptions() === "Fresh edit", "dismissing restore while it is saving puts the previous events back, got " + descriptions());
    assert(storedDescriptions() === "Fresh edit", "reverted restore is written back to storage, got " + storedDescriptions());
  });
}).then(function () {
  var file = backupFile("From backup", false);
  api.setPendingBackupFile(file);
  return api.restoreBackupFile().then(function () {
    assert(descriptions() === "From backup", "a restore that is not cancelled replaces events, got " + descriptions());
    assert(storedDescriptions() === "From backup", "a completed restore is persisted, got " + storedDescriptions());
    if (failures) {
      console.error(failures + " failed");
      process.exit(1);
    }
    console.log("all passed");
  });
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
