(function () {
  var entries = [
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
  });

  function onClick(event) {
    var action = event.target.getAttribute("data-action");
    if (action === "add") showForm();
    if (action === "close-modal") closeModal();
    if (action === "save-entry") saveEntry(event);
    if (action === "export") window.print();
    if (action === "import") showImport();
    if (event.target.className === "modal-backdrop") closeModal();
  }

  function render() {
    var container = document.querySelector(".trips");
    if (!container) return;
    var html = "";
    groupByTrip(entries).forEach(function (group) {
      var trip = group[0];
      var tripEntries = sortByDate(group[1]);
      html += '<section class="trip"><div class="trip-heading"><h2>' + esc(trip) + "</h2><span>" + tripEntries.length + (tripEntries.length === 1 ? " event" : " events") + '</span></div><div class="events">';
      tripEntries.forEach(function (entry) {
        html += '<article class="event"><div class="meta"><span>' + formatDate(entry.date) + "</span><span>" + (entry.time ? formatTime(entry.time) : "") + '</span></div><div class="location">' + esc(entry.location) + '</div><p class="description">' + esc(entry.description) + "</p></article>";
      });
      html += "</div></section>";
    });
    container.innerHTML = html;
  }

  function showForm() {
    showModal(
      '<section class="modal"><h2>Add Entry</h2><label>Trip<input name="trip" value="Spain 2026 Trip"></label><label>Location<input name="location" placeholder="Madrid"></label><label>Date<input name="date" type="date" value="' +
        today() +
        '"></label><label>Time<input name="time" type="time"></label><label>Description<input name="description" placeholder="What happened?"></label><label>Notes<textarea name="notes" rows="4"></textarea></label><div class="modal-actions"><button type="button" data-action="close-modal">Cancel</button><button type="button" data-action="save-entry">Save</button></div></section>'
    );
  }

  function showImport() {
    showModal(
      '<section class="modal"><h2>Import Events</h2><p class="description">Paste or choose a file in the next version. This keeps the current browser stable while restoring the main add flow.</p><div class="modal-actions"><button type="button" data-action="close-modal">Close</button></div></section>'
    );
  }

  function saveEntry(event) {
    var modal = event.target.closest(".modal");
    var trip = modal.querySelector('[name="trip"]').value.trim() || "Untitled Trip";
    var location = modal.querySelector('[name="location"]').value.trim() || "Unspecified";
    var date = modal.querySelector('[name="date"]').value || today();
    var time = modal.querySelector('[name="time"]').value;
    var description = modal.querySelector('[name="description"]').value.trim() || "New travel event";
    var notes = modal.querySelector('[name="notes"]').value.trim();
    entries.push(item(trip, date, time, location, description, notes));
    closeModal();
    render();
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

  function item(trip, date, time, location, description, notes) {
    return { trip: trip, date: date, time: time, location: location, description: description, notes: notes };
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

  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
