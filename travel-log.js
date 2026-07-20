(function () {
  var storageKey = "travel-log-entries-v1";
  var storageMetaKey = storageKey + "-meta";
  var databaseName = "travel-log-storage";
  var databaseStore = "state";
  var localState = loadLocalState();
  var entries = localState.entries || sampleEntries();
  var tripResources = localState.tripResources || {};
  var appSettings = localState.appSettings || defaultSettings();
  var storageReady = false;

  function sampleEntries() {
    return [
    item("Alaska Trip", "2027-04-08", "", "Seattle", "Fly to Seattle", ""),
    item("Alaska Trip", "2027-04-10", "", "Ship", "Board Ship", ""),
    item("Alaska Trip", "2027-04-17", "", "LAX", "Fly to LAX", ""),
    item("Spain 2027 Trip", "2027-05-03", "", "LAX", "LAX to Madrid", ""),
    item("Spain 2027 Trip", "2027-05-03", "", "Madrid", "LAX to Madrid", ""),
    item("Spain 2027 Trip", "2027-05-04", "13:50", "Madrid", "Arrive Madrid", "Connecting flight to Bilbao at 4:45 PM."),
    item("Spain 2027 Trip", "2027-05-04", "17:50", "Bilbao", "Arrive Bilbao", "Hotel: Radisson Collection."),
    item("Spain 2027 Trip", "2027-05-04", "", "Radisson Collection", "Hotel: Radisson Collection", ""),
    item("Spain 2027 Trip", "2027-05-05", "", "Bilbao", "Bilbao all day", "Maybe meeting cousin."),
    item("Spain 2027 Trip", "2027-05-06", "10:00", "Train", "Board Train", "Tour of Bilbao provided by train."),
    item("Spain 2027 Trip", "2027-05-06", "", "Bilbao", "Tour of Bilbao provided by train", ""),
    item("Spain 2027 Trip", "2027-05-07", "", "Train", "Train", ""),
    item("Spain 2027 Trip", "2027-05-08", "", "Train", "Train", ""),
    item("Spain 2027 Trip", "2027-05-09", "", "Train", "Train", ""),
    item("Spain 2027 Trip", "2027-05-10", "", "Train", "Train", ""),
    item("Spain 2027 Trip", "2027-05-11", "", "Santiago", "Arrive Santiago lunch with train", "Hotel: Parador (1 night)."),
    item("Spain 2027 Trip", "2027-05-11", "", "Parador", "Hotel: Parador (1 night)", "")
    ];
  }

  document.addEventListener("DOMContentLoaded", function () {
    initializeStorage().then(function () {
      render();
    });
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    var searchInput = document.querySelector('[type="search"]');
    if (searchInput) {
      searchInput.addEventListener("input", render);
    }
  });

  function onClick(event) {
    var control = event.target.closest("[data-action]");
    var action = control ? control.getAttribute("data-action") : "";
    if (action === "add") showForm();
    if (action === "settings") showSettings();
    if (action === "readme") showReadme();
    if (action === "edit-entry") showForm(control.getAttribute("data-id"));
    if (action === "edit-trip") showTripForm(control.getAttribute("data-trip"));
    if (action === "close-modal") closeModal();
    if (action === "save-entry") saveEntry(event);
    if (action === "delete-entry") confirmDeleteEntry(event);
    if (action === "confirm-delete-entry") deleteEntry(event);
    if (action === "delete-checked-attachments") deleteCheckedAttachments(event);
    if (action === "save-trip") saveTrip(event);
    if (action === "save-settings") saveSettings(event);
    if (action === "start-delete-trip") showTripDeleteConfirm(event);
    if (action === "confirm-delete-trip") deleteTrip(event);
    if (action === "export") askPdfNotes();
    if (action === "export-pdf-with-notes") openPdfTab(true);
    if (action === "export-pdf-without-notes") openPdfTab(false);
    if (action === "export-text") exportTextFile();
    if (action === "backup") showBackupChoice();
    if (action === "create-backup") createBackupFile();
    if (action === "choose-restore-file") chooseRestoreFile();
    if (action === "confirm-restore-backup") restoreBackupFile();
    if (action === "open-attachment") openAttachment(control, event);
    if (action === "import") showImport();
    if (action === "choose-import-file") chooseImportFile();
    if (action === "import-file-add") importFileAdd();
    if (action === "import-file-replace") confirmImportFileReplace();
    if (action === "confirm-import-file-replace") importFileReplace();
    if (action === "parse-import") parseImportText();
    if (action === "approve-import") approveImport();
    if (action === "reload-sample-data") confirmReloadSampleData();
    if (action === "confirm-reload-sample-data") reloadSampleData();
    if (event.target.className === "modal-backdrop") closeModal();
  }

  function onChange(event) {
    if (!event.target || event.target.name !== "tripPicker") return;
    var modal = event.target.closest(".modal");
    var tripInput = modal ? modal.querySelector('[name="trip"]') : null;
    if (tripInput && event.target.value) tripInput.value = event.target.value;
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
      html += '<section class="trip"><div class="trip-heading"><div><h2>' + esc(trip) + "</h2><span>" + tripEntries.length + (tripEntries.length === 1 ? " event" : " events") + '</span></div><button class="edit-button" type="button" data-action="edit-trip" data-trip="' + esc(trip) + '">Edit</button></div>' + renderTripResources(trip) + '<div class="events">';
      tripEntries.forEach(function (entry) {
        html += '<article class="event' + (hasNotBooked(entry) ? " event-alert" : "") + '">' + (hasNotBooked(entry) ? '<span class="alert-badge" aria-label="Attention">!</span>' : "") + '<div class="event-main"><div><div class="meta">' + (hasResources(entry) ? '<span class="attachment-marker" title="Has attachment or link">A</span>' : "") + '<span>' + formatDate(entry.date) + "</span>" + (entry.time ? "<span>" + formatTime(entry.time) + "</span>" : "") + '<strong><a class="location-link" href="' + locationPageUrl(entry) + '">' + highlightNotBooked(entry.location) + '</a></strong></div><p class="description"><a href="' + descriptionSearchUrl(entry.description) + '" target="_blank" rel="noopener noreferrer">' + highlightNotBooked(entry.description) + "</a></p>" + (entry.notes ? '<p class="notes">' + highlightNotBooked(entry.notes) + "</p>" : "") + renderEntryResources(entry) + '</div><button class="edit-button" type="button" data-action="edit-entry" data-id="' + esc(entry.id) + '">Edit</button></div></article>';
      });
      html += "</div></section>";
    });
    container.innerHTML = html || '<p class="description">No matching events found.</p>';
  }

  function showForm(id) {
    var editing = findEntry(id);
    var formId = "entry-form-" + createId();
    showModal(
      '<section class="modal entry-modal"><h2>' +
        (editing ? "Edit Entry" : "Add Entry") +
        '</h2><input name="entryId" type="hidden" value="' +
        esc(editing ? editing.id : "") +
        '"><div class="trip-picker-grid"><div class="field"><label for="' + formId + '-trip">Trip</label><input id="' + formId + '-trip" name="trip" value="' +
        esc(editing ? editing.trip : "Spain 2027 Trip") +
        '"></div>' + renderTripPicker(formId, editing ? editing.trip : "Spain 2027 Trip") + '</div><div class="field"><label for="' + formId + '-location">Location</label><input id="' + formId + '-location" name="location" placeholder="Madrid" value="' +
        esc(editing ? editing.location : "") +
        '"></div><div class="compact-grid"><div class="field"><label for="' + formId + '-date">Date</label><input id="' + formId + '-date" name="date" type="date" value="' +
        esc(editing ? editing.date : today()) +
        '"></div><div class="field"><label for="' + formId + '-time">Time</label><input id="' + formId + '-time" name="time" type="time" value="' +
        esc(editing ? editing.time : "") +
        '"></div></div><div class="field"><label for="' + formId + '-description">Description</label><textarea id="' + formId + '-description" name="description" rows="1" placeholder="What happened?" autocomplete="off" spellcheck="true">' +
        esc(editing ? editing.description : "") +
        '</textarea></div><div class="field"><label for="' + formId + '-notes">Notes</label><textarea id="' + formId + '-notes" name="notes" rows="1" autocomplete="off" spellcheck="true">' +
        esc(editing ? editing.notes : "") +
        '</textarea></div><div class="field"><label for="' + formId + '-attachments">Add attachments</label><input id="' + formId + '-attachments" name="attachments" type="file" multiple></div>' +
        renderLinkInputs(formId) +
        renderResourceManager(editing) +
        '<div class="modal-actions"><button type="button" data-action="save-entry">Save</button>' +
        (editing ? '<button class="delete-button" type="button" data-action="delete-entry">Delete</button>' : "") +
        '<button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function showImport() {
    showModal(
      '<section class="modal import-modal"><h2>Import Events</h2><input name="importFile" type="file" accept=".txt,.md,.csv,text/plain" hidden><button type="button" data-action="choose-import-file">Import from file</button><label>Freeform events<textarea name="importText" rows="10" placeholder="Spain 2027 Trip&#10;Mon 5/3 LAX - Madrid"></textarea></label><button type="button" data-action="parse-import">Convert to entries</button><button class="delete-button" type="button" data-action="reload-sample-data">Reload sample data</button><div class="import-results" hidden></div><div class="modal-actions"><button type="button" data-action="approve-import">Add approved</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function showReadme() {
    showModal('<section class="modal"><h2>README</h2><div class="readme-content">' + esc(readmeText()) + '</div><div class="modal-actions"><button type="button" data-action="close-modal">Close</button></div></section>');
  }

  function showSettings() {
    showModal(
      '<section class="modal"><h2>Settings</h2><div class="field"><label for="description-search-method">Description Link Search</label><select id="description-search-method" name="descriptionSearchMethod">' +
        searchMethodOption("chatgpt", "ChatGPT") +
        searchMethodOption("grok", "Grok") +
        searchMethodOption("gemini", "Gemini") +
        searchMethodOption("google", "Google Search") +
        '</select></div><div class="modal-actions"><button type="button" data-action="save-settings">Save</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function searchMethodOption(value, label) {
    return '<option value="' + esc(value) + '"' + (appSettings.descriptionSearchMethod === value ? " selected" : "") + ">" + esc(label) + "</option>";
  }

  function saveSettings(event) {
    var modal = event.target.closest(".modal");
    var method = modal.querySelector('[name="descriptionSearchMethod"]').value;
    appSettings = normalizeSettings({ descriptionSearchMethod: method });
    saveEntries().then(function () {
      closeModal();
      render();
    });
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
        window.pendingImportFileText = String(reader.result || "");
        showImportFileChoice(file.name);
      };
      reader.readAsText(file);
    };
  }

  function showImportFileChoice(fileName) {
    showModal(
      '<section class="modal"><h2>Import File</h2><p class="description">' +
        esc(fileName || "Selected file") +
        '</p><div class="modal-actions"><button type="button" data-action="import-file-add">Add</button><button class="delete-button" type="button" data-action="import-file-replace">Replace All</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function importFileAdd() {
    importEntriesFromText(window.pendingImportFileText || "", false);
  }

  function confirmImportFileReplace() {
    showModal(
      '<section class="modal"><h2>Replace All Data?</h2><p class="description">This will permanently erase the current trips and events in this browser, then load the file.</p><div class="modal-actions"><button class="delete-button" type="button" data-action="confirm-import-file-replace">Replace</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function importFileReplace() {
    importEntriesFromText(window.pendingImportFileText || "", true);
  }

  function importEntriesFromText(text, replaceAll) {
    var imported = parseFreeformEvents(text);
    if (!imported.length) {
      showModal('<section class="modal"><h2>No Events Found</h2><p class="description">No dated events were found in the file.</p><div class="modal-actions"><button type="button" data-action="close-modal">Close</button></div></section>');
      return;
    }
    entries = replaceAll ? imported : entries.concat(imported);
    window.pendingImportFileText = "";
    closeModal();
    render();
  }

  function parseImportText() {
    var modal = document.querySelector(".import-modal");
    if (!modal) return;
    var text = modal.querySelector('[name="importText"]').value;
    var candidates = parseFreeformEvents(text);
    var results = modal.querySelector(".import-results");
    if (!candidates.length) {
      results.hidden = false;
      results.innerHTML = '<p class="description">No dated events found. Try lines like "Mon 5/3 LAX - Madrid" or "5/8 Fly to Seattle".</p>';
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

  function confirmReloadSampleData() {
    showModal(
      '<section class="modal"><h2>Reload Sample Data?</h2><p class="description">This will remove all current trips and events from this browser and replace them with the built-in sample itinerary.</p><div class="modal-actions"><button class="delete-button" type="button" data-action="confirm-reload-sample-data">Reload</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function reloadSampleData() {
    entries = sampleEntries();
    tripResources = {};
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey + "-trips");
      localStorage.removeItem(storageMetaKey);
    } catch (error) {
    }
    saveEntries().then(function () {
      closeModal();
      render();
    });
  }

  function showTripForm(tripName) {
    var count = entries.filter(function (entry) {
      return entry.trip === tripName;
    }).length;
    var formId = "trip-form-" + createId();
    showModal(
      '<section class="modal trip-modal"><h2>Edit Trip</h2><input name="originalTrip" type="hidden" value="' +
        esc(tripName) +
        '"><div class="field"><label for="' + formId + '-name">Trip Name</label><input id="' + formId + '-name" name="tripName" value="' +
        esc(tripName) +
        '"></div><div class="field"><label for="' + formId + '-attachments">Add trip attachments</label><input id="' + formId + '-attachments" name="attachments" type="file" multiple></div>' +
        renderLinkInputs(formId) +
        renderResourceManager(tripResourceRecord(tripName)) +
        '<p class="description">' +
        count +
        (count === 1 ? " event" : " events") +
        ' linked to this trip.</p><div class="modal-actions"><button type="button" data-action="save-trip">Save</button><button class="delete-button" type="button" data-action="start-delete-trip">Delete</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function saveEntry(event) {
    var modal = event.target.closest(".modal");
    var saveButton = event.target;
    var id = modal.querySelector('[name="entryId"]').value;
    var trip = modal.querySelector('[name="trip"]').value.trim() || "Untitled Trip";
    var location = modal.querySelector('[name="location"]').value.trim() || "Unspecified";
    var date = modal.querySelector('[name="date"]').value || today();
    var time = modal.querySelector('[name="time"]').value;
    var description = modal.querySelector('[name="description"]').value.trim() || "New travel event";
    var notes = modal.querySelector('[name="notes"]').value.trim();
    var editing = findEntry(id);
    var keptAttachments = existingAttachmentsFromModal(modal, editing);
    var keptLinks = existingLinksFromModal(modal, editing);
    var newLink = linkFromModal(modal);
    var links = newLink ? keptLinks.concat([newLink]) : keptLinks;
    saveButton.disabled = true;
    saveButton.textContent = "Saving";
    readAttachmentFiles(modal.querySelector('[name="attachments"]')).then(function (newAttachments) {
      var next = item(trip, date, time, location, description, notes, id, keptAttachments.concat(newAttachments), links);
      if (id) {
        entries = entries.map(function (entry) {
          return entry.id === id ? next : entry;
        });
      } else {
        entries.push(next);
      }
      closeModal();
      render();
    }).catch(function () {
      saveButton.disabled = false;
      saveButton.textContent = "Save";
      showMessage("Attachment Error", "One or more attachments could not be read.");
    });
  }

  function deleteEntry(event) {
    var modal = event.target.closest(".modal");
    var id = modal.querySelector('[name="deleteEntryId"]').value;
    if (!id) return;
    entries = entries.filter(function (entry) {
      return entry.id !== id;
    });
    closeModal();
    render();
  }

  function confirmDeleteEntry(event) {
    var modal = event.target.closest(".modal");
    var id = modal.querySelector('[name="entryId"]').value;
    var entry = findEntry(id);
    if (!entry) return;
    showModal(
      '<section class="modal"><h2>Delete Event?</h2><input name="deleteEntryId" type="hidden" value="' +
        esc(id) +
        '"><p class="description">This will delete this event and all of its links and attachments.</p><p class="description">' +
        esc(entry.description || entry.location || "Travel event") +
        '</p><div class="modal-actions"><button class="delete-button" type="button" data-action="confirm-delete-entry">Confirm</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function deleteCheckedAttachments(event) {
    var modal = event.target.closest(".modal");
    var entryIdField = modal.querySelector('[name="entryId"]');
    var tripField = modal.querySelector('[name="originalTrip"]');
    var id = entryIdField ? entryIdField.value : "";
    var trip = tripField ? tripField.value : "";
    var entry = id ? findEntry(id) : tripResourceRecord(trip);
    var checked = modal.querySelectorAll('[name="deleteAttachment"]:checked');
    var checkedLinks = modal.querySelectorAll('[name="deleteLink"]:checked');
    if (!entry || (!checked.length && !checkedLinks.length)) {
      showMessage("Nothing Selected", "Check one or more links or attachments before using this option.");
      return;
    }
    var deleted = {};
    for (var i = 0; i < checked.length; i += 1) {
      deleted[checked[i].value] = true;
    }
    var deletedLinks = {};
    for (var j = 0; j < checkedLinks.length; j += 1) {
      deletedLinks[checkedLinks[j].value] = true;
    }
    if (id) {
      entries = entries.map(function (candidate) {
        if (candidate.id !== id) return candidate;
        return item(candidate.trip, candidate.date, candidate.time, candidate.location, candidate.description, candidate.notes, candidate.id, entryAttachments(candidate).filter(function (attachment) {
          return !deleted[attachment.id];
        }), entryLinks(candidate).filter(function (link) {
          return !deletedLinks[link.id];
        }));
      });
    } else if (trip) {
      tripResources[trip] = {
        attachments: entryAttachments(entry).filter(function (attachment) {
          return !deleted[attachment.id];
        }),
        links: entryLinks(entry).filter(function (link) {
          return !deletedLinks[link.id];
        })
      };
    }
    closeModal();
    render();
  }

  function saveTrip(event) {
    var modal = event.target.closest(".modal");
    var saveButton = event.target;
    var originalTrip = modal.querySelector('[name="originalTrip"]').value;
    var nextTrip = modal.querySelector('[name="tripName"]').value.trim() || originalTrip;
    var current = tripResourceRecord(originalTrip);
    var keptAttachments = existingAttachmentsFromModal(modal, current);
    var keptLinks = existingLinksFromModal(modal, current);
    var newLink = linkFromModal(modal);
    var links = newLink ? keptLinks.concat([newLink]) : keptLinks;
    saveButton.disabled = true;
    saveButton.textContent = "Saving";
    readAttachmentFiles(modal.querySelector('[name="attachments"]')).then(function (newAttachments) {
      entries = entries.map(function (entry) {
        if (entry.trip !== originalTrip) return entry;
        return item(nextTrip, entry.date, entry.time, entry.location, entry.description, entry.notes, entry.id, entry.attachments, entry.links);
      });
      if (nextTrip !== originalTrip) delete tripResources[originalTrip];
      tripResources[nextTrip] = {
        attachments: keptAttachments.concat(newAttachments),
        links: links
      };
      closeModal();
      render();
    }).catch(function () {
      saveButton.disabled = false;
      saveButton.textContent = "Save";
      showMessage("Attachment Error", "One or more attachments could not be read.");
    });
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
    delete tripResources[originalTrip];
    closeModal();
    render();
  }

  function showBackupChoice() {
    showModal(
      '<section class="modal"><h2>Backup</h2><p class="description">Back up or restore all trips, events, links, and attachments on this device.</p><input name="backupFile" type="file" accept=".json,.gz,.tlbackup,application/json,application/gzip" hidden><div class="modal-actions"><button type="button" data-action="create-backup">Backup</button><button type="button" data-action="choose-restore-file">Restore</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function createBackupFile() {
    var payload = {
      app: "travel-log",
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: normalizeEntries(entries),
      tripResources: normalizeTripResources(tripResources),
      appSettings: normalizeSettings(appSettings)
    };
    var json = JSON.stringify(payload);
    var filename = "travel-log-backup-" + today() + ".json";
    if (window.CompressionStream) {
      compressText(json).then(function (blob) {
        downloadBlob(blob, filename + ".gz");
        closeModal();
      }).catch(function () {
        downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), filename);
        closeModal();
      });
    } else {
      downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), filename);
      closeModal();
    }
  }

  function chooseRestoreFile() {
    var input = document.querySelector('[name="backupFile"]');
    if (!input) return;
    input.click();
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      window.pendingBackupRestoreFile = file;
      showModal(
        '<section class="modal"><h2>Restore Backup?</h2><p class="description">This will replace all current trips, events, links, and attachments in this browser with the selected backup.</p><p class="description">' +
          esc(file.name) +
          '</p><div class="modal-actions"><button class="delete-button" type="button" data-action="confirm-restore-backup">Restore</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
      );
    };
  }

  function restoreBackupFile() {
    var file = window.pendingBackupRestoreFile;
    if (!file) return;
    readBackupFile(file).then(function (backup) {
      if (!backup || !Array.isArray(backup.entries)) throw new Error("Invalid backup");
      entries = normalizeEntries(backup.entries);
      tripResources = normalizeTripResources(backup.tripResources || {});
      appSettings = normalizeSettings(backup.appSettings || {});
      window.pendingBackupRestoreFile = null;
      return saveEntries().then(function () {
        closeModal();
        render();
      });
    }).catch(function () {
      showMessage("Restore Failed", "That backup file could not be restored.");
    });
  }

  function askPdfNotes() {
    showModal(
      '<section class="modal"><h2>PDF Notes</h2><p class="description">Include entry notes in this PDF?</p><div class="modal-actions"><button type="button" data-action="export-pdf-with-notes">Show Notes</button><button type="button" data-action="export-pdf-without-notes">Hide Notes</button><button type="button" data-action="close-modal">Cancel</button></div></section>'
    );
  }

  function openPdfTab(includeNotes) {
    closeModal();
    var win = window.open("", "_blank");
    if (!win) {
      window.print();
      return;
    }

    var html = '<!doctype html><html><head><title>Travel Log PDF</title><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1d2420;margin:24px}' +
      'h1{font-size:12px;margin:0 0 18px;text-align:right;font-weight:400}h2{font-size:18px;margin:0 0 10px}' +
      '.trip{break-after:page;page-break-after:always;margin-bottom:18px}.trip:last-child{break-after:auto;page-break-after:auto}' +
      '.event{break-inside:avoid;page-break-inside:avoid;padding:3px 0;font-size:14px;line-height:1.3}' +
      '.line{display:grid;grid-template-columns:18px 1in 1.25in .65in 1fr;column-gap:4px;align-items:start}.line span{min-height:1em}.notes{margin:4px 0 0 1.2in;color:#444;padding-left:10px;border-left:3px solid #ddd}.not-booked{color:#b42318;font-weight:800}.alert-badge{display:inline-grid;place-items:center;width:14px;height:14px;border-radius:50%;background:#b42318;color:#fff;font-size:12px;font-weight:800}.attachment-suffix{color:#777;font-weight:700}' +
      '@media print{.print-note{display:none}}' +
      '</style></head><body><p class="print-note">Opening PDF dialog...</p><h1>Travel Log Printed: ' + esc(formatPrintedAt(new Date())) + '</h1>';

    groupByTrip(entries).forEach(function (group) {
      var trip = group[0];
      html += '<section class="trip"><h2>' + esc(trip) + '</h2>';
      var previous = null;
      sortByDate(group[1]).forEach(function (entry) {
        var fields = pdfDisplayFields(entry, previous);
        html += '<article class="event"><div class="line"><span>' + (hasNotBooked(entry) ? '<strong class="alert-badge">!</strong>' : '') + '</span><span>' +
          fields.location + '</span><span>' +
          fields.date + '</span><span>' +
          fields.time + '</span><span>' +
          highlightNotBooked(entry.description) + (hasAttachments(entry) ? '<span class="attachment-suffix">-A</span>' : '') + '</span></div>' +
          (includeNotes && entry.notes ? '<p class="notes">' + highlightNotBooked(entry.notes) + '</p>' : '') +
          '</article>';
        previous = entry;
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

  function exportTextFile() {
    var text = buildExportText();
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "travel-log-itinerary.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function pdfDisplayFields(entry, previous) {
    return {
      location: !previous || entry.location !== previous.location ? highlightNotBooked(entry.location) : "",
      date: !previous || entry.date !== previous.date ? esc(formatDate(entry.date)) : "",
      time: pdfTimeField(entry, previous)
    };
  }

  function pdfTimeField(entry, previous) {
    if (!entry.time) return "";
    if (!previous || entry.location !== previous.location || entry.date !== previous.date || entry.time !== previous.time) {
      return esc(formatTime(entry.time));
    }
    return "";
  }

  function buildExportText() {
    var lines = [
      "# Travel Log Export",
      "# This file can be imported back into the Travel Log app.",
      ""
    ];

    groupByTrip(entries).forEach(function (group) {
      lines.push(group[0]);
      sortByDate(group[1]).forEach(function (entry) {
        var parts = [
          entry.date,
          "Location: " + exportValue(entry.location),
          "Description: " + exportValue(entry.description)
        ];
        if (entry.time) parts.splice(1, 0, "Time: " + exportValue(entry.time));
        if (entry.notes) parts.push("Notes: " + exportValue(entry.notes));
        lines.push(parts.join(" | "));
      });
      lines.push("");
    });

    return lines.join("\n");
  }

  function parseFreeformEvents(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (line) {
      return normalizeImportLine(line);
    }).filter(Boolean);
    var parsed = [];
    var trip = "Imported Trip";
    var year = new Date().getFullYear();

    lines.forEach(function (line) {
      if (line.charAt(0) === "#") return;
      var exported = parseExportLine(line, trip);
      if (exported) {
        parsed.push(exported);
        return;
      }

      var match = line.match(/^(?:(?:mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\.?,?\s+)?(\d{1,2})[\/\-.](\d{1,2})\b\s*(.*)$/i);
      if (!match) {
        trip = line;
        var yearMatch = line.match(/\b(20\d{2})\b/);
        if (yearMatch) year = Number(yearMatch[1]);
        return;
      }

      var body = match[3].trim();
      if (!body) return;
      var date = year + "-" + pad(match[1]) + "-" + pad(match[2]);
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

  function parseExportLine(line, trip) {
    var match = line.match(/^(\d{4})-(\d{2})-(\d{2})\s*\|\s*(.+)$/);
    if (!match) return null;

    var fields = parseExportFields(match[4]);
    if (!fields.Location && !fields.Description) return null;
    return item(
      trip,
      match[1] + "-" + match[2] + "-" + match[3],
      fields.Time || "",
      fields.Location || "Unspecified",
      fields.Description || "Imported event",
      fields.Notes || ""
    );
  }

  function parseExportFields(value) {
    var fields = {};
    value.split(/\s+\|\s+/).forEach(function (part) {
      var fieldMatch = part.match(/^([A-Za-z]+):\s*(.*)$/);
      if (!fieldMatch) return;
      fields[fieldMatch[1]] = importValue(fieldMatch[2]);
    });
    return fields;
  }

  function normalizeImportLine(line) {
    return String(line || "")
      .replace(/\u00a0/g, " ")
      .replace(/[•*]+/g, " ")
      .replace(/^\s*[-–—]\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
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

  function renderAttachmentLinks(entry) {
    var attachments = entryAttachments(entry);
    if (!attachments.length) return "";
    return '<div class="attachments">' + attachments.map(function (attachment) {
      return '<a class="attachment-link" href="#" data-action="open-attachment" data-owner-type="entry" data-entry-id="' + esc(entry.id) + '" data-attachment-id="' + esc(attachment.id) + '">A ' + esc(attachment.name) + '</a>';
    }).join("") + "</div>";
  }

  function renderEntryResources(entry) {
    var resources = renderAttachmentLinksForRecord(entry, "entry", entry.id) + renderSavedLinks(entryLinks(entry));
    return resources ? '<div class="attachments">' + resources + '</div>' : "";
  }

  function renderTripResources(trip) {
    var record = tripResourceRecord(trip);
    var html = renderAttachmentLinksForRecord(record, "trip", trip) + renderSavedLinks(tripLinks(trip));
    return html ? '<div class="trip-resources">' + html + '</div>' : "";
  }

  function renderAttachmentLinksForRecord(record, ownerType, ownerId) {
    var attachments = entryAttachments(record);
    return attachments.map(function (attachment) {
      var ownerAttr = ownerType === "trip" ? ' data-trip="' + esc(ownerId || "") + '"' : ' data-entry-id="' + esc(ownerId || "") + '"';
      return '<a class="attachment-link" href="#" data-action="open-attachment" data-owner-type="' + esc(ownerType) + '"' + ownerAttr + ' data-attachment-id="' + esc(attachment.id) + '">A ' + esc(attachment.name) + '</a>';
    }).join("");
  }

  function renderSavedLinks(links) {
    links = normalizeLinks(links);
    return links.map(function (link) {
      return '<a class="saved-link" href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">L ' + esc(link.label || link.url) + '</a>';
    }).join("");
  }

  function renderResourceManager(record) {
    var attachments = entryAttachments(record);
    var links = entryLinks(record);
    if (!attachments.length && !links.length) return "";
    var html = '<div class="field"><label>Current links and attachments</label><div class="attachment-list">';
    html += attachments.map(function (attachment) {
      return '<div class="attachment-item"><span class="attachment-name">' + esc(attachment.name) + '</span><label><input type="checkbox" name="deleteAttachment" value="' + esc(attachment.id) + '"> Delete</label></div>';
    }).join("");
    html += links.map(function (link) {
      return '<div class="attachment-item"><span class="attachment-name">' + esc(link.label || link.url) + '</span><label><input type="checkbox" name="deleteLink" value="' + esc(link.id) + '"> Delete</label></div>';
    }).join("");
    return html + '</div><button class="delete-button" type="button" data-action="delete-checked-attachments">Delete checked</button></div>';
  }

  function renderLinkInputs(formId) {
    return '<div class="link-grid"><div class="field"><label for="' + formId + '-link-label">Link label</label><input id="' + formId + '-link-label" name="linkLabel" placeholder="Tickets"></div><div class="field"><label for="' + formId + '-link-url">Link URL</label><input id="' + formId + '-link-url" name="linkUrl" type="url" placeholder="https://"></div></div>';
  }

  function renderTripPicker(formId, selectedTrip) {
    var trips = unique(entries.map(function (entry) {
      return entry.trip || "";
    }).filter(Boolean)).sort(function (a, b) {
      return a.localeCompare(b);
    });
    return '<div class="field"><label for="' + esc(formId) + '-trip-picker">Existing trips</label><select id="' + esc(formId) + '-trip-picker" name="tripPicker"><option value="">Choose</option>' + trips.map(function (trip) {
      return '<option value="' + esc(trip) + '"' + (trip === selectedTrip ? " selected" : "") + ">" + esc(trip) + "</option>";
    }).join("") + "</select></div>";
  }

  function existingAttachmentsFromModal(modal, entry) {
    var deleted = {};
    var checked = modal.querySelectorAll('[name="deleteAttachment"]:checked');
    for (var i = 0; i < checked.length; i += 1) {
      deleted[checked[i].value] = true;
    }
    return entryAttachments(entry).filter(function (attachment) {
      return !deleted[attachment.id];
    });
  }

  function existingLinksFromModal(modal, entry) {
    var deleted = {};
    var checked = modal.querySelectorAll('[name="deleteLink"]:checked');
    for (var i = 0; i < checked.length; i += 1) {
      deleted[checked[i].value] = true;
    }
    return entryLinks(entry).filter(function (link) {
      return !deleted[link.id];
    });
  }

  function linkFromModal(modal) {
    var urlField = modal.querySelector('[name="linkUrl"]');
    var labelField = modal.querySelector('[name="linkLabel"]');
    var url = urlField ? urlField.value.trim() : "";
    if (!url) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = "https://" + url;
    return {
      id: createId(),
      label: (labelField ? labelField.value.trim() : "") || url.replace(/^https?:\/\//i, ""),
      url: url
    };
  }

  function readAttachmentFiles(input) {
    var files = input && input.files ? Array.prototype.slice.call(input.files) : [];
    return Promise.all(files.map(function (file) {
      return readFileAsDataUrl(file).then(function (dataUrl) {
        return {
          id: createId(),
          name: file.name || "attachment",
          type: file.type || "application/octet-stream",
          size: file.size || 0,
          addedAt: new Date().toISOString(),
          dataUrl: dataUrl
        };
      });
    }));
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readmeText() {
    return [
      "# Travel Log App",
      "",
      "A mobile-first static Travel Log app for managing trip events. It runs with plain HTML and JavaScript, with no build step, backend, or package install required.",
      "",
      "## Run Locally",
      "",
      "Open `index.html` in a browser.",
      "",
      "## Current Files",
      "",
      "- `index.html` - primary load page with inline app styles and fallback markup",
      "- `travel-log.js` - app logic, rendering, persistence, import, search, and PDF export",
      "- `place.html` - local location dashboard opened from itinerary location links",
      "- `place.js` - location dashboard data loading, maps, weather, and itinerary cards",
      "- `grok-place-proxy.example.js` - optional server-side xAI Grok API proxy; keeps `XAI_API_KEY` out of the browser",
      "- `PROJECT_NOTES.md` - background/context for future development",
      "",
      "## Features",
      "",
      "- Trips grouped by trip name",
      "- Main trip page and destination dashboards share a dark navy, teal, and yellow travel-planner color scheme",
      "- The centered `Add Event` button creates new entries",
      "- Header buttons include `BACKUP`, `READ ME`, `TXT`, and `PDF`; `READ ME` displays this embedded README text in the app",
      "- Floating buttons include `Add Event` and `Settings`",
      "- Settings can choose the default description-link search site: ChatGPT, Grok, Gemini, or Google Search",
      "- Trips sorted by the first event in each trip, earliest first",
      "- Events sorted by date inside each trip",
      "- Compact one-line event display",
      "- Add and edit events",
      "- Add events with a Trip field that supports both typed text and a visible existing-trip dropdown",
      "- Add one or more file attachments or links to events",
      "- Add trip-level attachments or links from the trip edit screen",
      "- Delete links and attachments from the event or trip edit screen",
      "- Delete only checked links or attachments without deleting the event or trip",
      "- Save, delete, and cancel controls on the edit screen",
      "- Event deletion requires a confirmation because it also deletes that event's links and attachments",
      "- Edit trip names",
      "- Delete entire trips with typed-name confirmation",
      "- Local search across trip, date, time, location, description, and notes",
      "- Event descriptions link to a ChatGPT search in a new tab",
      "- Event locations link to a local destination dashboard",
      "- Main-page location and description links are visibly highlighted and underlined",
      "- Destination dashboards try the optional xAI Grok API proxy first, then Wikipedia, then a Google Search source link if no encyclopedia data is found",
      "- Destination dashboards pull map tiles from OpenStreetMap and weather from Open-Meteo",
      "- Destination dashboards reject unrelated Wikipedia matches and fall back to mapped place data when needed",
      "- Destination dashboards open Google Maps, using specific place names from event descriptions plus the city/location for better matching",
      "- Import freeform trip notes from pasted text or a file",
      "- File import can add to current data or replace all current browser data",
      "- Export a shareable text itinerary that can be imported back into the app",
      "- Review imported entries before adding them",
      "- Reload the built-in sample itinerary from the import screen",
      "- Persistent browser storage with IndexedDB, plus `localStorage` compatibility for existing browser data",
      "- PDF export in a new print-friendly tab",
      "- PDF export asks whether to include notes each time",
      "- PDF export marks events with attachments by appending `-A` to the description, but does not include the attachment files",
      "- PDF rows display location, date, time, and description, with the date shown only on the first event of each day",
      "- BACKUP can export or restore all entries, trip resources, app settings, links, and attachments as one mobile-friendly backup file",
      "- PDF page break between trips",
      "- PDF keeps each event together on one page",
      "- Highlights `not booked` with a red alert marker and bold red text",
      "",
      "## Storage",
      "",
      "Data is stored in the browser using IndexedDB, with `localStorage` compatibility under:",
      "",
      "```text",
      "travel-log-entries-v1",
      "```",
      "",
      "This means edits survive refreshes on the same browser/device, but data is not shared across devices or stored on the web server.",
      "",
      "Links and attachments are stored inside the same browser data. Attachments use data URLs. The app uses IndexedDB as the more durable store for larger mobile restores, and keeps localStorage compatibility where available. Use `BACKUP` to move entries, links, and attachments between PC, iOS, and Android browsers.",
      "",
      "The app does not automatically change saved trip names or dates. It uses saved browser data as-is, or loads the built-in 2027 sample itinerary when no saved data exists.",
      "",
      "## Deploy To Nginx",
      "",
      "Copy these files to your Nginx web directory:",
      "",
      "```text",
      "index.html",
      "travel-log.js",
      "place.html",
      "place.js",
      "grok-place-proxy.example.js",
      "```",
      "",
      "Example Fedora/Nginx path:",
      "",
      "```bash",
      "sudo mkdir -p /usr/share/nginx/html/travel-log",
      "sudo cp index.html travel-log.js place.html place.js /usr/share/nginx/html/travel-log/",
      "sudo systemctl reload nginx",
      "```",
      "",
      "The Grok lookup requires a server-side endpoint because xAI API keys should not be exposed in browser JavaScript. Use `grok-place-proxy.example.js` as a starting point, set `XAI_API_KEY`, and proxy `/api/grok-place` to that process.",
      "",
      "Then open:",
      "",
      "```text",
      "http://your-server/travel-log/",
      "```",
      "",
      "## Development Note",
      "",
      "When changing `travel-log.js`, bump the script version in `index.html`, for example:",
      "",
      "```html",
      "<script src=\"./travel-log.js?v=54\" defer></script>",
      "```",
      "",
      "This helps browsers load the newest script instead of using a cached copy.",
      "",
      "Note: this README text is embedded in `travel-log.js` for the READ ME button. Update `readmeText()` whenever `README.md` changes."
    ].join("\n");
  }

  function hasAttachments(entry) {
    return entryAttachments(entry).length > 0;
  }

  function hasResources(entry) {
    return entryAttachments(entry).length > 0 || entryLinks(entry).length > 0;
  }

  function entryAttachments(entry) {
    return entry && Array.isArray(entry.attachments) ? entry.attachments.filter(function (attachment) {
      return attachment && attachment.dataUrl && attachment.name;
    }) : [];
  }

  function entryLinks(entry) {
    return entry && Array.isArray(entry.links) ? normalizeLinks(entry.links) : [];
  }

  function tripResourceRecord(trip) {
    var record = tripResources[trip] || {};
    return {
      attachments: entryAttachments(record),
      links: entryLinks(record)
    };
  }

  function tripLinks(trip) {
    return entryLinks(tripResourceRecord(trip));
  }

  function openAttachment(control, event) {
    event.preventDefault();
    var ownerType = control.getAttribute("data-owner-type") || "entry";
    var entry = ownerType === "trip" ? tripResourceRecord(control.getAttribute("data-trip")) : findEntry(control.getAttribute("data-entry-id"));
    var attachmentId = control.getAttribute("data-attachment-id");
    var attachment = entryAttachments(entry).filter(function (item) {
      return item.id === attachmentId;
    })[0];
    if (!attachment) return;
    try {
      var blob = dataUrlToBlob(attachment.dataUrl, attachment.type);
      var url = URL.createObjectURL(blob);
      var opened = window.open(url, "_blank");
      if (opened) {
        opened.opener = null;
      } else {
        showMessage("Attachment Blocked", "The browser blocked the new attachment tab.");
      }
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (error) {
      showMessage("Attachment Error", "This attachment could not be opened.");
    }
  }

  function dataUrlToBlob(dataUrl, fallbackType) {
    var parts = String(dataUrl || "").split(",");
    if (parts.length < 2) throw new Error("Invalid attachment data");
    var header = parts[0];
    var base64 = parts.slice(1).join(",");
    var typeMatch = header.match(/^data:([^;]+);base64$/i);
    var type = typeMatch ? typeMatch[1] : (fallbackType || "application/octet-stream");
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: type });
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

  function showMessage(title, message) {
    showModal('<section class="modal"><h2>' + esc(title) + '</h2><p class="description">' + esc(message) + '</p><div class="modal-actions"><button type="button" data-action="close-modal">Close</button></div></section>');
  }

  function item(trip, date, time, location, description, notes, id, attachments, links) {
    return { id: id || createId(), trip: trip, date: date, time: time, location: location, description: description, notes: notes, attachments: attachments || [], links: links || [] };
  }

  function initializeStorage() {
    return loadIndexedState().then(function (indexedState) {
      if (indexedState && indexedState.entries && (!localState.entries || indexedState.updatedAt >= localState.updatedAt)) {
        entries = indexedState.entries;
        tripResources = indexedState.tripResources || {};
        appSettings = indexedState.appSettings || defaultSettings();
      } else if (localState.entries) {
        return saveIndexedState(localState);
      }
    }).catch(function () {
      return null;
    }).then(function () {
      storageReady = true;
    });
  }

  function saveEntries() {
    if (!storageReady) return Promise.resolve();
    var state = {
      entries: normalizeEntries(entries),
      tripResources: normalizeTripResources(tripResources),
      appSettings: normalizeSettings(appSettings),
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.entries));
      localStorage.setItem(storageKey + "-trips", JSON.stringify(state.tripResources));
      localStorage.setItem(storageKey + "-settings", JSON.stringify(state.appSettings));
      localStorage.setItem(storageMetaKey, JSON.stringify({ updatedAt: state.updatedAt }));
    } catch (error) {
      // Mobile browsers can reject larger backups with attachments. IndexedDB below is the durable path.
    }
    return saveIndexedState(state).catch(function () {
      return null;
    });
  }

  function loadEntries() {
    var state = loadLocalState();
    return state.entries;
  }

  function loadLocalState() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return { entries: null, tripResources: {}, appSettings: defaultSettings(), updatedAt: 0 };
      var meta = {};
      try {
        meta = JSON.parse(localStorage.getItem(storageMetaKey) || "{}");
      } catch (error) {
        meta = {};
      }
      return {
        entries: normalizeEntries(JSON.parse(raw)),
        tripResources: normalizeTripResources(JSON.parse(localStorage.getItem(storageKey + "-trips") || "{}")),
        appSettings: normalizeSettings(JSON.parse(localStorage.getItem(storageKey + "-settings") || "{}")),
        updatedAt: Number(meta.updatedAt || 0)
      };
    } catch (error) {
      return { entries: null, tripResources: {}, appSettings: defaultSettings(), updatedAt: 0 };
    }
  }

  function loadIndexedState() {
    if (!window.indexedDB) return Promise.resolve(null);
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(databaseStore, "readonly");
        var request = transaction.objectStore(databaseStore).get(storageKey);
        request.onsuccess = function () {
          var value = request.result;
          resolve(value && Array.isArray(value.entries) ? {
            entries: normalizeEntries(value.entries),
            tripResources: normalizeTripResources(value.tripResources || {}),
            appSettings: normalizeSettings(value.appSettings || {}),
            updatedAt: Number(value.updatedAt || 0)
          } : null);
        };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function saveIndexedState(state) {
    if (!window.indexedDB) return Promise.resolve();
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(databaseStore, "readwrite");
        transaction.oncomplete = function () { resolve(); };
        transaction.onerror = function () { reject(transaction.error); };
        transaction.objectStore(databaseStore).put({
          id: storageKey,
          entries: normalizeEntries(state.entries),
          tripResources: normalizeTripResources(state.tripResources || {}),
          appSettings: normalizeSettings(state.appSettings || {}),
          updatedAt: Number(state.updatedAt || Date.now())
        });
      });
    });
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(databaseStore)) {
          db.createObjectStore(databaseStore, { keyPath: "id" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
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
      entryAttachments(entry).map(function (attachment) { return attachment.name; }).join(" "),
      entryLinks(entry).map(function (link) { return link.label + " " + link.url; }).join(" "),
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

  function descriptionSearchUrl(description) {
    var query = encodeURIComponent(String(description || ""));
    var method = normalizeSettings(appSettings).descriptionSearchMethod;
    if (method === "grok") return "https://grok.com/?q=" + query;
    if (method === "gemini") return "https://gemini.google.com/app?q=" + query;
    if (method === "google") return "https://www.google.com/search?q=" + query;
    return "https://chatgpt.com/?q=" + query;
  }

  function locationPageUrl(entry) {
    return "./place.html?location=" + encodeURIComponent(entry.location || "") + "&trip=" + encodeURIComponent(entry.trip || "") + "&mapQuery=" + encodeURIComponent(mapQueryForEntry(entry));
  }

  function mapQueryForEntry(entry) {
    var location = String(entry.location || "").trim();
    var description = String(entry.description || "").trim();
    var specific = specificPlaceFromDescription(description);
    if (specific && !isRouteDescription(description)) return specific;
    return location;
  }

  function specificPlaceFromDescription(value) {
    var match = String(value || "").match(/\b(?:hotel|check\s*-?\s*in|stay|lodging|reservation|arrive(?:\s+at)?)\b[^:-]*(?:-|:)\s*(.+)$/i);
    if (!match) return "";
    return match[1].replace(/\([^)]*\)/g, "").trim();
  }

  function isRouteDescription(value) {
    return /\b(?:to|from)\b/i.test(value) && /\b(?:fly|flight|train|drive|bus|ferry|ship|depart|arrive)\b/i.test(value);
  }

  function groupByTrip(list) {
    var groups = {};
    list.forEach(function (entry) {
      if (!groups[entry.trip]) groups[entry.trip] = [];
      groups[entry.trip].push(entry);
    });
    return Object.keys(groups).map(function (trip) {
      return [trip, groups[trip]];
    }).sort(function (a, b) {
      return tripStart(a[1]) - tripStart(b[1]);
    });
  }

  function tripStart(list) {
    var sorted = sortByDate(list);
    return sorted.length ? stamp(sorted[0]) : 0;
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

  function formatPrintedAt(value) {
    var datePart = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value);
    var timePart = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(value);
    return datePart + ", " + timePart;
  }

  function normalizeEntries(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (entry) {
      return item(
        entry.trip || "Untitled Trip",
        entry.date || today(),
        entry.time || "",
        entry.location || "Unspecified",
        entry.description || "Travel event",
        entry.notes || "",
        entry.id || createId(),
        normalizeAttachments(entry.attachments),
        normalizeLinks(entry.links)
      );
    });
  }

  function normalizeTripResources(resources) {
    var normalized = {};
    Object.keys(resources || {}).forEach(function (trip) {
      normalized[trip] = {
        attachments: normalizeAttachments(resources[trip] && resources[trip].attachments),
        links: normalizeLinks(resources[trip] && resources[trip].links)
      };
    });
    return normalized;
  }

  function normalizeAttachments(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (attachment) {
      return attachment && attachment.dataUrl && attachment.name;
    }).map(function (attachment) {
      return {
        id: attachment.id || createId(),
        name: String(attachment.name || "attachment"),
        type: String(attachment.type || "application/octet-stream"),
        size: Number(attachment.size || 0),
        addedAt: attachment.addedAt || "",
        dataUrl: String(attachment.dataUrl || "")
      };
    });
  }

  function normalizeLinks(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (link) {
      return link && link.url;
    }).map(function (link) {
      return {
        id: link.id || createId(),
        label: String(link.label || link.url || "Link"),
        url: String(link.url || "")
      };
    });
  }

  function defaultSettings() {
    return { descriptionSearchMethod: "chatgpt" };
  }

  function normalizeSettings(settings) {
    var method = settings && settings.descriptionSearchMethod;
    if (["chatgpt", "grok", "gemini", "google"].indexOf(method) === -1) method = "chatgpt";
    return { descriptionSearchMethod: method };
  }

  function compressText(text) {
    var stream = new Blob([text], { type: "application/json;charset=utf-8" }).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(stream).blob();
  }

  function readBackupFile(file) {
    return file.arrayBuffer().then(function (buffer) {
      var isGzip = /\.gz$/i.test(file.name || "") || startsWithGzip(buffer);
      if (isGzip) return decompressBuffer(buffer);
      return new TextDecoder().decode(buffer);
    }).then(function (text) {
      return JSON.parse(text);
    });
  }

  function decompressBuffer(buffer) {
    if (!window.DecompressionStream) return Promise.reject(new Error("Gzip restore is not supported in this browser."));
    var stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }

  function startsWithGzip(buffer) {
    var bytes = new Uint8Array(buffer);
    return bytes.length > 2 && bytes[0] === 31 && bytes[1] === 139;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function pad(value) {
    return String(value).length === 1 ? "0" + value : String(value);
  }

  function exportValue(value) {
    return String(value || "").replace(/\r?\n/g, "\\n").replace(/\|/g, "\\|");
  }

  function importValue(value) {
    return String(value || "").replace(/\\\|/g, "|").replace(/\\n/g, "\n");
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
