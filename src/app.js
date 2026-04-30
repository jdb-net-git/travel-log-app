const { initialEntries, sampleImportText } = window.TravelLogData;
const { parseFreeformEvents } = window.TravelLogParser;

const app = document.querySelector("#app");
app.dataset.ready = "false";
const state = {
  entries: [...initialEntries],
  screen: "list",
  selectedId: null,
  pendingDeleteId: null,
  importCandidates: []
};

render();
app.dataset.ready = "true";

function render() {
  app.innerHTML = "";

  if (state.screen === "list") renderList();
  if (state.screen === "form") renderForm();
  if (state.screen === "detail") renderDetail();
  if (state.screen === "import") renderImport();
}

function renderList() {
  const node = template("entry-list-template");
  const tripList = node.querySelector("[data-trip-list]");
  const grouped = groupByTrip(sortEntries(state.entries));

  if (!grouped.length) {
    tripList.innerHTML = `<p class="empty-state">No entries yet.</p>`;
  }

  grouped.forEach(([trip, entries]) => {
    const section = document.createElement("section");
    section.className = "trip-section";
    section.innerHTML = `
      <div class="trip-heading">
        <h2>${escapeHtml(trip)}</h2>
        <span>${entries.length} ${entries.length === 1 ? "entry" : "entries"}</span>
      </div>
      <div class="entry-list"></div>
    `;

    const list = section.querySelector(".entry-list");
    entries.forEach((entry) => {
      const item = document.createElement("button");
      item.className = "entry-item";
      item.type = "button";
      item.innerHTML = `
        <div class="entry-meta">
          <span>${formatDate(entry.date)}</span>
          <span>${entry.time ? formatTime(entry.time) : ""}</span>
        </div>
        <strong class="entry-location">${escapeHtml(entry.locations.join(", "))}</strong>
        <p class="entry-preview">${escapeHtml(preview(entry.description))}</p>
      `;
      item.addEventListener("click", () => openDetail(entry.id));
      list.append(item);
    });

    tripList.append(section);
  });

  node.querySelector("[data-action='add']").addEventListener("click", () => openForm());
  node.querySelector("[data-action='import']").addEventListener("click", () => {
    state.screen = "import";
    render();
  });
  node.querySelector("[data-action='export']").addEventListener("click", exportPdf);
  app.append(node);
}

function renderForm() {
  const editing = state.entries.find((entry) => entry.id === state.selectedId);
  const node = template("entry-form-template");
  const form = node.querySelector("[data-entry-form]");
  node.querySelector("[data-form-title]").textContent = editing ? "Edit Entry" : "Add Entry";

  form.trip.value = editing?.trip || state.entries[0]?.trip || "";
  form.date.value = editing?.date || new Date().toISOString().slice(0, 10);
  form.time.value = editing?.time || "";
  form.description.value = editing?.description || "";
  form.notes.value = editing?.notes || "";

  renderLocationEditor(node.querySelector("[data-location-editor]"), editing?.locations || [""]);

  node.querySelector("[data-action='back']").addEventListener("click", goBack);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const locations = [...form.querySelectorAll("[data-location-input]")]
      .map((input) => input.value.trim())
      .filter(Boolean);

    const baseEntry = {
      trip: form.trip.value.trim() || "Untitled Trip",
      date: form.date.value,
      time: form.time.value,
      description: form.description.value.trim(),
      notes: form.notes.value.trim()
    };
    const splitEntries = (locations.length ? locations : ["Unspecified"]).map((location, index) => ({
      ...baseEntry,
      id: editing && index === 0 ? editing.id : createId(),
      locations: [location]
    }));

    if (editing) {
      state.entries = state.entries.flatMap((current) => (current.id === editing.id ? splitEntries : current));
    } else {
      state.entries = [...splitEntries, ...state.entries];
    }

    state.selectedId = splitEntries[0].id;
    state.screen = "detail";
    render();
  });

  app.append(node);
}

function renderDetail() {
  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) {
    state.screen = "list";
    render();
    return;
  }

  const node = template("entry-detail-template");
  node.querySelector("[data-entry-detail]").innerHTML = `
    <div class="detail-field"><span>Trip</span><strong>${escapeHtml(entry.trip)}</strong></div>
    <div class="detail-field"><span>Date</span><strong>${formatDate(entry.date)}</strong></div>
    ${entry.time ? `<div class="detail-field"><span>Time</span><strong>${formatTime(entry.time)}</strong></div>` : ""}
    <div class="detail-field"><span>Location</span><strong>${escapeHtml(entry.locations.join(", "))}</strong></div>
    <div class="detail-field"><span>Description</span><p>${escapeHtml(entry.description)}</p></div>
    ${entry.notes ? `<div class="detail-field"><span>Notes</span><p>${escapeHtml(entry.notes)}</p></div>` : ""}
  `;

  node.querySelector("[data-action='back']").addEventListener("click", goBack);
  node.querySelector("[data-action='edit']").addEventListener("click", () => openForm(entry.id));
  node.querySelector("[data-action='delete']").addEventListener("click", () => confirmDelete(entry.id));
  app.append(node);
}

function renderImport() {
  const node = template("import-template");
  const importText = node.querySelector("[data-import-text]");
  const fileInput = node.querySelector("[data-file-input]");
  const results = node.querySelector("[data-import-results]");
  const approvalList = node.querySelector("[data-approval-list]");
  importText.value = sampleImportText;

  node.querySelector("[data-action='back']").addEventListener("click", goBack);
  node.querySelector("[data-action='choose-file']").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files;
    if (!file) return;
    importText.value = await file.text();
  });
  node.querySelector("[data-action='parse-import']").addEventListener("click", () => {
    state.importCandidates = parseFreeformEvents(importText.value);
    approvalList.innerHTML = "";
    state.importCandidates.forEach((entry, index) => {
      const item = document.createElement("label");
      item.className = "approval-item";
      item.innerHTML = `
        <input type="checkbox" data-import-index="${index}" checked />
        <span>
          <strong>${escapeHtml(entry.trip)}</strong><br />
          ${formatDate(entry.date)} | ${escapeHtml(entry.locations.join(", "))}<br />
          ${escapeHtml(entry.description)}
        </span>
      `;
      approvalList.append(item);
    });
    results.hidden = false;
  });

  node.querySelector("[data-action='approve-import']").addEventListener("click", () => {
    const approvedIndexes = [...node.querySelectorAll("[data-import-index]:checked")].map((input) =>
      Number(input.dataset.importIndex)
    );
    const approvedEntries = approvedIndexes.map((index) => {
      const { approved, ...entry } = state.importCandidates[index];
      return { ...entry, id: createId() };
    });
    state.entries = [...approvedEntries, ...state.entries];
    state.importCandidates = [];
    state.screen = "list";
    render();
  });

  app.append(node);
}

function renderLocationEditor(container, locations) {
  container.innerHTML = "";
  locations.forEach((location) => addLocationRow(container, location));
  const addButton = document.createElement("button");
  addButton.className = "secondary-button add-location";
  addButton.type = "button";
  addButton.textContent = "Add location";
  addButton.addEventListener("click", () => addLocationRow(container, ""));
  container.append(addButton);
}

function addLocationRow(container, value) {
  const row = document.createElement("div");
  row.className = "location-row";
  row.innerHTML = `
    <input data-location-input type="text" value="${escapeAttribute(value)}" placeholder="Madrid" />
    <button type="button" aria-label="Remove location">x</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  const addButton = container.querySelector(".add-location");
  if (addButton) {
    container.insertBefore(row, addButton);
  } else {
    container.append(row);
  }
}

function openDetail(id) {
  state.selectedId = id;
  state.screen = "detail";
  render();
}

function openForm(id = null) {
  state.selectedId = id;
  state.screen = "form";
  render();
}

function goBack() {
  state.screen = "list";
  state.selectedId = null;
  render();
}

function confirmDelete(id) {
  state.pendingDeleteId = id;
  const modal = template("confirm-template");
  modal.querySelector("[data-action='cancel-delete']").addEventListener("click", () => modal.remove());
  modal.querySelector("[data-action='confirm-delete']").addEventListener("click", () => {
    state.entries = state.entries.filter((entry) => entry.id !== state.pendingDeleteId);
    state.pendingDeleteId = null;
    state.screen = "list";
    render();
  });
  document.body.append(modal);
}

function exportPdf() {
  const rows = sortEntries(state.entries)
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.trip)}</td>
          <td>${formatDate(entry.date)}</td>
          <td>${escapeHtml(entry.time ? formatTime(entry.time) : "")}</td>
          <td>${escapeHtml(entry.locations.join(", "))}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td>${escapeHtml(entry.notes)}</td>
        </tr>
      `
    )
    .join("");

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Travel Log Export</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
          h1 { margin: 0 0 16px; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; text-align: left; }
          th { background: #f1f3f2; }
        </style>
      </head>
      <body>
        <h1>Travel Log</h1>
        <table>
          <thead>
            <tr>
              <th>Trip</th><th>Date</th><th>Time</th><th>Location</th><th>Description</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function groupByTrip(entries) {
  return Object.entries(
    entries.reduce((groups, entry) => {
      groups[entry.trip] ||= [];
      groups[entry.trip].push(entry);
      return groups;
    }, {})
  ).sort(([, a], [, b]) => new Date(b[0].date) - new Date(a[0].date));
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const dateDelta = new Date(`${b.date}T${b.time || "00:00"}`) - new Date(`${a.date}T${a.time || "00:00"}`);
    return dateDelta || a.trip.localeCompare(b.trip);
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2026, 0, 1, hour, minute)
  );
}

function preview(value) {
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

function template(id) {
  return document.querySelector(`#${id}`).content.cloneNode(true);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
