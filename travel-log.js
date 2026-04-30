(function () {
  var storageKey = "travel-log-entries-v1";
  var entries = loadEntries() || [
    item("Alaska Trip", "2026-05-08", "", "Seattle", "Fly to Seattle", ""),
    item("Alaska Trip", "2026-05-10", "", "Ship", "Board Ship", ""),
    item("Alaska Trip", "2026-05-17", "", "LAX", "Fly to LAX", ""),
    item("Spain 2026 Trip", "2026-06-03", "", "LAX", "LAX to Madrid", ""),
    item("Spain 2026 Trip", "2026-06-03", "", "Madrid", "LAX to Madrid", ""),
    item("Spain 2026 Trip", "2026-06-04", "13:50", "Madrid", "Arrive Madrid", "Connecting flight to Bilbao at 4:45 PM."),
    item("Spain 2026 Trip", "2026-06-04", "17:50", "Bilbao", "Arrive Bilbao", "Hotel: Radisson Collection."),
    item("Spain 2026 Trip", "2026-06-04", "", "Radisson Collection", "Hotel: Radisson Collection", ""),
    item("Spain 2026 Trip", "2026-06-05", "", "Bilbao", "Bilbao all day", "Maybe meeting cousin."),
    item("Spain 2026 Trip", "2026-06-06", "10:00", "Train", "Board Train", "Tour of Bilbao provided by train."),
    item("Spain 2026 Trip", "2026-06-06", "", "Bilbao", "Tour of Bilbao provided by train", ""),
    item("Spain 2026 Trip", "2026-06-07", "", "Train", "Train", ""),
    item("Spain 2026 Trip", "2026-06-08", "", "Train", "Train", ""),
    item("Spain 2026 Trip", "2026-06-09", "", "Train", "Train", ""),
    item("Spain 2026 Trip", "2026-06-10", "", "Train", "Train", ""),
    item("Spain 2026 Trip", "2026-06-11", "", "Santiago", "Arrive Santiago lunch with train", "Hotel: Parador (1 night)."),
    item("Spain 2026 Trip", "2026-06-11", "", "Parador", "Hotel: Parador (1 night)", "")
  ];

  document.addEventListener("DOMContentLoaded", function () {
    render();
    document.addEventListener("click", onClick);
    var searchInput = document.querySelector('[type="search"]');
    if (searchInput) {
      searchInput.addEventListener("input", render);
    }
  });

  function onClick(event) {
    var control = event.target.closest("[data-action]");
    var action = control ? control.getAttribute("data-action") : "";
    if (action === "add") showForm();
    if (action === "edit-entry") showForm(control.getAttribute("data-id"));
    if (action === "edit-trip") showTripForm(control.getAttribute("data-trip"));
    if (action === "close-modal") closeModal();
    if (action === "save-entry") saveEntry(event);
    if (action === "delete-entry") deleteEntry(event);
    if (action === "save-trip") saveTrip(event);
    if (action === "start-delete-trip") showTripDeleteConfirm(event);
    if (action === "confirm-delete-trip") deleteTrip(event);
    if (action === "export") openPdfTab();
    if (action === "import") showImport();
    if (action === "choose-import-file") chooseImportFile();
    if (action === "parse-import") parseImportText();
    if (action === "approve-import") approveImport();
    if (event.target.className === "modal-backdrop") closeModal();
  }

  function render() {
    var container = document.querySelector(".trips");
    if (!container) return;
    saveEntries();
    var searchInput = document.querySelector('[type="search"]');
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var visibleEntries = query ? entries.filter(function (entry) {
      return searchableText(entry).indexOf(query) !== -1;
    }) : entries;
    var html = "";
    groupByTrip(visibleEntries).forEach(function (group) {
      var trip = group[0];
      var tripEntries = sortByDate(group[1]);
      html += '<section class="trip"><div class="trip-heading"><div><h2>' + esc(trip) + "</h2><span>" + tripEntries.length + (tripEntries.length === 1 ? " event" : " events") + '</span></div><button class="edit-button" type="button" data-action="edit-trip" data-trip="' + esc(trip) + '">Edit</button></div><div class="events">';
      tripEntries.forEach(function (entry) {
        html += '<article class="event' + (hasNotBooked(entry) ? " event-alert" : "") + '">' + (hasNotBooked(entry) ? '<span class="alert-badge" aria-label="Attention">!</span>' : "") + '<div class="event-main"><div><div class="meta"><span>' + formatDate(entry.date) + "</span>" + (entry.time ? "<span>" + formatTime(entry.time) + "</span>" : "") + '<strong>' + highlightNotBooked(entry.location) + '</strong></div><p class="description">' + highlightNotBooked(entry.description) + "</p>" + (entry.notes ? '<p class="notes">' + highlightNotBooked(entry.notes) + "</p>" : "") + '</div><button class="edit-button" type="button" data-action="edit-entry" data-id="' + esc(entry.id) + '">Edit</button></div></article>';
      });
      html += "</div></section>";
    });
    container.innerHTML = html || '<p class="description">No matching events found.</p>';
  }

  function showForm(id) {
    var editing = findEntry(id);
    showModal(
      '<section class="modal"><h2>' +
        (editing ? "Edit Entry" : "Add Entry") +
        '</h2><input name="entryId" type="hidden" value="' +
        esc(editing ? editing.id : "") +
        '"><label>Trip<input name="trip" value="' +
        esc(editing ? editing.trip : "Spain 2026 Trip") +
        '"></label><label>Location<input name="location" placeholder="Madrid" value="' +
        esc(editing ? editing.location : "") +
        '"></label><label>Date<input name="date" type="date" value="' +
        esc(editing ? editing.date : today()) +
        '"></label><label>Time<input name="time" type="time" value="' +
        esc(editing ? editing.time : "") +
        '"></label><label>Description<input name="description" placeholder="What happened?" value="' +
        esc(editing ? editing.description : "") +
        '"></label><label>Notes<textarea name="notes" rows="4">' +
        esc(editing ? editing.notes : "") +
        '</textarea></label><div class="modal-actions"><button type="button" data-action="save-entry">Save</button>' +
        (editing ? '<button class="delete-button" type="button" data-action="delete-entry">Delete</button>' : "") +
        '<button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function showImport() {
    showModal(
      '<section class="modal import-modal"><h2>Import Events</h2><input name="importFile" type="file" accept=".txt,.md,.csv,text/plain" hidden><button type="button" data-action="choose-import-file">Import from file</button><label>Freeform events<textarea name="importText" rows="10" placeholder="Spain 2026 Trip&#10;Wed 6/3 LAX - Madrid"></textarea></label><button type="button" data-action="parse-import">Convert to entries</button><div class="import-results" hidden></div><div class="modal-actions"><button type="button" data-action="approve-import">Add approved</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function chooseImportFile() {
    var input = document.querySelector('[name="importFile"]');
    if (!input) return;
    input.click();
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var textArea = document.querySelector('[name="importText"]');
        if (textArea) textArea.value = String(reader.result || "");
      };
      reader.readAsText(file);
    };
  }

  function parseImportText() {
    var modal = document.querySelector(".import-modal");
    if (!modal) return;
    var text = modal.querySelector('[name="importText"]').value;
    var candidates = parseFreeformEvents(text);
    var results = modal.querySelector(".import-results");
    if (!candidates.length) {
      results.hidden = false;
      results.innerHTML = '<p class="description">No dated events found.</p>';
      return;
    }

    results.hidden = false;
    results.innerHTML = candidates.map(function (entry, index) {
      return '<label class="approval-item"><input type="checkbox" data-import-index="' + index + '" checked><span><strong>' + esc(entry.trip) + '</strong><br>' + formatDate(entry.date) + (entry.time ? " " + formatTime(entry.time) : "") + " | " + esc(entry.location) + '<br>' + esc(entry.description) + '</span></label>';
    }).join("");
    window.pendingImportEntries = candidates;
  }

  function approveImport() {
    var pending = window.pendingImportEntries || [];
    var modal = document.querySelector(".import-modal");
    if (!modal || !pending.length) return;
    var checked = modal.querySelectorAll("[data-import-index]:checked");
    for (var i = 0; i < checked.length; i += 1) {
      entries.push(pending[Number(checked[i].getAttribute("data-import-index"))]);
    }
    window.pendingImportEntries = [];
    closeModal();
    render();
  }

  function showTripForm(tripName) {
    var count = entries.filter(function (entry) {
      return entry.trip === tripName;
    }).length;
    showModal(
      '<section class="modal"><h2>Edit Trip</h2><input name="originalTrip" type="hidden" value="' +
        esc(tripName) +
        '"><label>Trip Name<input name="tripName" value="' +
        esc(tripName) +
        '"></label><p class="description">' +
        count +
        (count === 1 ? " event" : " events") +
        ' linked to this trip.</p><div class="modal-actions"><button type="button" data-action="save-trip">Save</button><button class="delete-button" type="button" data-action="start-delete-trip">Delete</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function saveEntry(event) {
    var modal = event.target.closest(".modal");
    var id = modal.querySelector('[name="entryId"]').value;
    var trip = modal.querySelector('[name="trip"]').value.trim() || "Untitled Trip";
    var location = modal.querySelector('[name="location"]').value.trim() || "Unspecified";
    var date = modal.querySelector('[name="date"]').value || today();
    var time = modal.querySelector('[name="time"]').value;
    var description = modal.querySelector('[name="description"]').value.trim() || "New travel event";
    var notes = modal.querySelector('[name="notes"]').value.trim();
    if (id) {
      entries = entries.map(function (entry) {
        return entry.id === id ? item(trip, date, time, location, description, notes, id) : entry;
      });
    } else {
      entries.push(item(trip, date, time, location, description, notes));
    }
    closeModal();
    render();
  }

  function deleteEntry(event) {
    var modal = event.target.closest(".modal");
    var id = modal.querySelector('[name="entryId"]').value;
    if (!id) return;
    entries = entries.filter(function (entry) {
      return entry.id !== id;
    });
    closeModal();
    render();
  }

  function saveTrip(event) {
    var modal = event.target.closest(".modal");
    var originalTrip = modal.querySelector('[name="originalTrip"]').value;
    var nextTrip = modal.querySelector('[name="tripName"]').value.trim() || originalTrip;
    entries = entries.map(function (entry) {
      if (entry.trip !== originalTrip) return entry;
      return item(nextTrip, entry.date, entry.time, entry.location, entry.description, entry.notes, entry.id);
    });
    closeModal();
    render();
  }

  function showTripDeleteConfirm(event) {
    var modal = event.target.closest(".modal");
    var tripName = modal.querySelector('[name="originalTrip"]').value;
    var displayedName = modal.querySelector('[name="tripName"]').value.trim() || tripName;
    var count = entries.filter(function (entry) {
      return entry.trip === tripName;
    }).length;
    showModal(
      '<section class="modal"><h2>Delete Trip</h2><input name="deleteTripOriginal" type="hidden" value="' +
        esc(tripName) +
        '"><input name="deleteTripDisplayed" type="hidden" value="' +
        esc(displayedName) +
        '"><p class="description">This will remove "' +
        esc(displayedName) +
        '" and all ' +
        count +
        ' linked events.</p><label>Type the trip name to confirm<input name="deleteTripName" placeholder="' +
        esc(displayedName) +
        '"></label><div class="modal-actions"><button class="delete-button" type="button" data-action="confirm-delete-trip">Delete</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function deleteTrip(event) {
    var modal = event.target.closest(".modal");
    var originalTrip = modal.querySelector('[name="deleteTripOriginal"]').value;
    var displayedName = modal.querySelector('[name="deleteTripDisplayed"]').value;
    var typedName = modal.querySelector('[name="deleteTripName"]').value.trim();
    if (typedName.toLowerCase() !== displayedName.toLowerCase()) {
      modal.querySelector('[name="deleteTripName"]').focus();
      return;
    }
    entries = entries.filter(function (entry) {
      return entry.trip !== originalTrip;
    });
    closeModal();
    render();
  }

  function openPdfTab() {
    var win = window.open("", "_blank");
    if (!win) {
      window.print();
      return;
    }

    var html = '<!doctype html><html><head><title>Travel Log PDF</title><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1d2420;margin:24px}' +
      'h1{font-size:10px;margin:0 0 18px;text-align:right;font-weight:400}h2{font-size:16px;margin:0 0 10px}' +
      '.trip{break-after:page;page-break-after:always;margin-bottom:18px}.trip:last-child{break-after:auto;page-break-after:auto}' +
      '.event{break-inside:avoid;page-break-inside:avoid;padding:3px 0;font-size:12px;line-height:1.3}' +
      '.line strong{margin-right:8px}.line span{margin-right:8px}.notes{margin:4px 0 0 0;color:#444;padding-left:10px;border-left:3px solid #ddd}.not-booked{color:#b42318;font-weight:800}.alert-badge{display:inline-grid;place-items:center;width:14px;height:14px;border-radius:50%;background:#b42318;color:#fff;font-size:10px;font-weight:800;margin-right:8px}' +
      '@media print{.print-note{display:none}}' +
      '</style></head><body><p class="print-note">Opening PDF dialog...</p><h1>Travel Log</h1>';

    groupByTrip(entries).forEach(function (group) {
      var trip = group[0];
      html += '<section class="trip"><h2>' + esc(trip) + '</h2>';
      sortByDate(group[1]).forEach(function (entry) {
        html += '<article class="event"><div class="line">' + (hasNotBooked(entry) ? '<strong class="alert-badge">!</strong>' : '') + '<span>' + formatDate(entry.date) + '</span>' +
          (entry.time ? '<span>' + formatTime(entry.time) + '</span>' : '') +
          '<strong>' + highlightNotBooked(entry.location) + '</strong><span>- ' + highlightNotBooked(entry.description) + '</span></div>' +
          (entry.notes ? '<p class="notes">' + highlightNotBooked(entry.notes) + '</p>' : '') +
          '</article>';
      });
      html += '</section>';
    });

    html += '</body></html>';
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.setTimeout(function () {
      win.print();
    }, 250);
  }

  function parseFreeformEvents(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean);
    var parsed = [];
    var trip = "Imported Trip";
    var year = new Date().getFullYear();

    lines.forEach(function (line) {
      var match = line.match(/^((?:mon|monday|tues|tuesday|wed|wednesday|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\s+)?(\d{1,2})\/(\d{1,2})\s+(.+)$/i);
      if (!match) {
        trip = line;
        var yearMatch = line.match(/\b(20\d{2})\b/);
        if (yearMatch) year = Number(yearMatch[1]);
        return;
      }

      var date = year + "-" + pad(match[2]) + "-" + pad(match[3]);
      var body = match[4];
      var route = body.match(/^([A-Za-z ]+)\s+(?:-|–|—)\s+([A-Za-z ]+)$/);
      if (route) {
        parsed.push(item(trip, date, "", route[1].trim(), body, ""));
        parsed.push(item(trip, date, "", route[2].trim(), body, ""));
        return;
      }

      body.split(/\s+(?:-|–|—)\s+/).map(function (piece) {
        return piece.trim();
      }).filter(Boolean).forEach(function (piece) {
        var found = importLocations(piece);
        found.forEach(function (location) {
          parsed.push(item(trip, date, importTime(piece), location, piece.replace(/\s*@\s*/g, " at "), ""));
        });
      });
    });

    return parsed;
  }

  function importLocations(text) {
    var known = ["LAX", "Madrid", "Bilbao", "Santiago", "Seattle", "Ship", "Train", "Radisson Collection", "Parador"];
    var found = [];
    known.forEach(function (place) {
      if (text.toLowerCase().indexOf(place.toLowerCase()) !== -1) found.push(place);
    });
    var hotel = text.match(/Hotel:\s*([^@-]+)/i);
    if (hotel) found.push(hotel[1].trim());
    var arrive = text.match(/Arrive\s+([A-Z][A-Za-z ]+?)(?:\s+\d|$|@|-)/);
    if (arrive) found.push(arrive[1].trim());
    var flyTo = text.match(/Fly to\s+([A-Z][A-Za-z ]+)/i);
    if (flyTo) found.push(flyTo[1].trim());
    if (!found.length) found.push("Unspecified");
    return unique(found);
  }

  function importTime(text) {
    var match = text.match(/(?:@|\s)(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
    if (!match) return "";
    var hour = Number(match[1]);
    var minute = match[2] || "00";
    var meridiem = match[3].toUpperCase();
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return pad(hour) + ":" + minute;
  }

  function showModal(html) {
    closeModal();
    var wrapper = document.createElement("div");
    wrapper.className = "modal-backdrop";
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  function closeModal() {
    var modal = document.querySelector(".modal-backdrop");
    if (modal) modal.parentNode.removeChild(modal);
  }

  function item(trip, date, time, location, description, notes, id) {
    return { id: id || createId(), trip: trip, date: date, time: time, location: location, description: description, notes: notes };
  }

  function saveEntries() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch (error) {
      return;
    }
  }

  function loadEntries() {
    try {
      var raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function findEntry(id) {
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].id === id) return entries[i];
    }
    return null;
  }

  function searchableText(entry) {
    return [
      entry.trip,
      entry.date,
      entry.time,
      entry.location,
      entry.description,
      entry.notes,
      formatDate(entry.date),
      entry.time ? formatTime(entry.time) : ""
    ].join(" ").toLowerCase();
  }

  function hasNotBooked(entry) {
    return searchableText(entry).indexOf("not booked") !== -1;
  }

  function highlightNotBooked(value) {
    return esc(value).replace(/not booked/gi, '<strong class="not-booked">$&</strong>');
  }

  function groupByTrip(list) {
    var groups = {};
    list.forEach(function (entry) {
      if (!groups[entry.trip]) groups[entry.trip] = [];
      groups[entry.trip].push(entry);
    });
    return Object.keys(groups).map(function (trip) {
      return [trip, groups[trip]];
    });
  }

  function sortByDate(list) {
    return list.slice().sort(function (a, b) {
      return stamp(a) - stamp(b);
    });
  }

  function stamp(entry) {
    return new Date(entry.date + "T" + (entry.time || "00:00")).getTime();
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value + "T12:00:00"));
  }

  function formatTime(value) {
    var parts = value.split(":");
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, Number(parts[0]), Number(parts[1])));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function pad(value) {
    return String(value).length === 1 ? "0" + value : String(value);
  }

  function unique(values) {
    var seen = {};
    return values.filter(function (value) {
      var key = value.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function createId() {
    return "entry-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }
})();
