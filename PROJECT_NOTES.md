# Travel Log App Project Notes

## Purpose

This is a mobile-first Travel Log app for tracking trip events. It is designed to run as a simple static app, including from `file://` during local editing and from Nginx on Fedora.

## Main Files

- `index.html`: Primary load page. Contains all app layout CSS inline, fallback static itinerary markup, and the script tag for the app logic.
- `travel-log.js`: Main app behavior, data model, rendering, editing, importing, search, persistence, and PDF export.
- `place.html`: Local destination dashboard opened from itinerary location links.
- `place.js`: Destination dashboard data loading, OpenStreetMap tile rendering, weather, nearby places, and itinerary card rendering.
- `grok-place-proxy.example.js`: Optional server-side xAI Grok API proxy. It reads `XAI_API_KEY` from the server environment so the key is not exposed in browser JavaScript.
- `README.md`: Short run/deploy notes.

Older/generated files such as `styles.css`, `src/`, and `travel-log-fresh.html` are not required for the current app unless intentionally reused later.

## Current Load Page

Use:

```text
index.html
```

The current app script is loaded with a cache-busting query string:

```html
<script src="./travel-log.js?v=54" defer></script>
```

When changing `travel-log.js`, bump the version number in `index.html` so browsers pick up the latest script.

## Data Storage

The app stores trip/event data in browser IndexedDB, with `localStorage` compatibility for existing saved data:

```js
travel-log-entries-v1
```

This means:

- Edits persist across browser refreshes.
- Links and attachments are stored in browser data. Attachments are data URLs. IndexedDB is the durable path for larger mobile restores because localStorage can reject larger attachment backups on iOS.
- Data is per browser/device.
- Nginx only serves static files; it does not store centralized trip data.
- Clearing browser site data will reset the app to seeded sample data.
- The app should not automatically migrate or rewrite saved dates/trip names. Saved data is used as-is.

## Current Features

- Trip list grouped by trip.
- Trips sorted by the first event in each trip, earliest first.
- Events sorted by date inside each trip.
- One event per line/card.
- Floating `Add Event` button at the top center for adding an event.
- Floating `Settings` button opens app settings.
- Header action row includes `BACKUP`, `READ ME`, `TXT`, and `PDF`; `READ ME` opens an embedded read-only README copy from `readmeText()` in `travel-log.js`; keep it synchronized whenever `README.md` changes.
- Settings include the default description-link search method: ChatGPT, Grok, Gemini, or Google Search.
- Event edit button on each entry.
- Event add/edit Trip field is typed text with a visible existing-trip dropdown that fills the text field.
- Event add/edit supports file attachments and links stored with the event.
- Trip edit supports trip-level attachments and links, displayed below the trip heading above the first event.
- Existing links and attachments can be deleted from the event or trip edit screen.
- A `Delete checked` action removes only selected links or attachments without deleting the event or trip itself.
- Attached events show an `A` marker in the app.
- Event deletion opens a confirmation warning because it deletes the event plus its links and attachments.
- Attachment links open in a new tab through temporary `blob:` URLs rather than direct `data:` URLs because some browsers open raw data URLs as `about:blank`. They do not fall back to replacing the main app page.
- Entry edit modal with `Save`, `Delete`, and `Cancel`.
- Trip edit button next to each trip.
- Trip rename updates all linked events.
- Trip delete requires typing the displayed trip name, case-insensitive, before deleting all linked events.
- Search filters events by trip, date, time, location, description, and notes.
- Event descriptions link to ChatGPT search URLs in a new tab.
- Event locations link to `place.html` with location and trip query parameters.
- Main-page location and description links are visibly highlighted and underlined.
- Location dashboards try an optional xAI Grok API proxy first, then Wikipedia, then a Google Search source link if no encyclopedia data is found.
- The browser checks `window.TRAVEL_LOG_GROK_ENDPOINT`, then same-origin `/api/grok-place`, then `http://127.0.0.1:8790/api/grok-place` during local HTTP development.
- The Grok proxy uses the xAI Responses API at `https://api.x.ai/v1/responses` with the `XAI_API_KEY` environment variable.
- Location dashboards load map tiles from OpenStreetMap and current weather from Open-Meteo.
- Location dashboards also show matching events from localStorage as itinerary cards.
- Location dashboards filter Wikipedia search results so unrelated partial matches, such as `Santa Irene` resolving to `Irene Ryan`, are rejected before falling back to map/geocoding data.
- Location dashboards open Google Maps. When an event description includes a specific place, such as `Hotel Check In- Parador De Alcala`, the generated map query uses that specific place plus the city/location context.
- Import supports freeform pasted text and text-like file input.
- File import asks whether to add to current data or replace all current browser data.
- Import converts freeform events into proposed entries and shows checkboxes for approval.
- Import splits multi-location events into separate entries when possible.
- Import screen has a guarded reload option that clears local data and restores the built-in sample itinerary.
- TXT export downloads a shareable text itinerary that can be imported back into the app.
- BACKUP opens a backup/restore choice. Backup includes a trip dropdown (default **ALL TRIPS**, or one trip). It exports matching entries, trip resources, app settings, links, and attachments to one file, using gzip when the browser supports native `CompressionStream`; restore still replaces all data from the selected backup file (JSON or gzip).
- PDF export opens a new print-friendly tab and automatically launches the print/PDF dialog.
- PDF export includes a trip dropdown (default **ALL TRIPS**, or one trip), then asks whether to include notes.
- PDF output has one page per trip.
- PDF keeps events together; events should not split across pages.
- PDF event rows show location, date, time, and description on one line; the date appears only on the first event of each day.
- PDF export ignores attachment file contents but appends `-A` to the description for attached events.
- Events containing `not booked` show a red `!` badge and highlight `not booked` in bold red in both app view and PDF export.

## Sample Data

Seed data includes:

- `Alaska Trip`
- `Spain 2027 Trip`

These are only used when no saved browser data exists.

## Important Design Choices

- The app is intentionally dependency-free: no build step, no npm, no backend.
- Styles are inline in `index.html` to avoid earlier `file://` and embedded-browser loading issues.
- `index.html` uses the same dark navy, teal, and yellow accent palette as the destination dashboard in `place.html`.
- Modals are constrained to the viewport and scroll internally, including on iPhone Safari where the background page can otherwise scroll behind a tall edit dialog.
- App behavior is in a small separate `travel-log.js` file for easier editing.
- Keep JavaScript conservative and plain ES5-ish where possible because the in-app browser had previously become unstable with larger inline scripts.
- The visible static itinerary in `index.html` acts as a fallback before JavaScript renders the live state.

## PDF Export Notes

PDF export is handled by `askPdfNotes()` + `openPdfTab()` in `travel-log.js`.

Trip scope:

- Dropdown defaults to **ALL TRIPS**.
- Selecting one trip filters events before rendering the print tab.
- Helpers: `renderTripScopePicker()`, `selectedTripScope()`, `entriesForTripScope()`.

Backup scope uses the same picker pattern via `scopeDataForTrip()` in `createBackupFile()`. Single-trip backups still restore as a full replace of browser data (they do not merge into existing trips).

Current PDF styling highlights:

- App name `Travel Log` is `10px`, right-aligned.
- Trip heading is `16px`.
- Event rows are `12px`.
- Event row padding is `3px 0`.
- No separator line between events.
- Each trip starts on a new page.
- Events avoid page breaks inside the event.

Browsers require user confirmation for the final Save/Print PDF action. The app can open the dialog automatically but cannot silently save the PDF file.

## Import Notes

Import is handled by:

- `showImport()`
- `chooseImportFile()`
- `parseImportText()`
- `parseFreeformEvents()`
- `approveImport()`

The parser recognizes:

- Trip headings as non-date lines.
- Dates like `Wed 6/3`, `5/8`, `Thurs 6/4`.
- Years in trip headings, such as `Spain 2026 Trip`.
- Route-style lines like `LAX - Madrid`.
- Known place names including `LAX`, `Madrid`, `Bilbao`, `Santiago`, `Seattle`, `Ship`, `Train`, `Radisson Collection`, and `Parador`.
- Times such as `@ 10 AM`, `1:50 PM`, `4:45 PM`.

## Deployment

The app can run on Nginx/Fedora as static files. Required current files:

```text
index.html
travel-log.js
place.html
place.js
grok-place-proxy.example.js
```

Suggested Nginx path:

```text
/usr/share/nginx/html/travel-log/
```

URL after deploy:

```text
http://<server-ip>/travel-log/
```

## Known Limitations

- No centralized database or multi-device sync.
- Import parser is heuristic, not full natural language AI.
- Search is local only.
- Location dashboards need internet access for live place, map, and weather data.
- PDF export depends on browser print behavior.
- There is no undo after delete, except browser localStorage/manual recovery if implemented later.

## Good Future Improvements

- Add selective trip restore (merge one trip from a backup without replacing all data) or attachment size reporting.
- Add a reset sample data button guarded by confirmation.
- Add richer import review editing before approval.
- Add trip ordering controls.
- Add persistent server-side storage if multi-device access is needed.
- Add a small test page or sample input fixtures for the import parser.

## Recommended Future Codex Prompt

When continuing this project, start with:

```text
Please read PROJECT_NOTES.md, index.html, and travel-log.js, then help me continue editing this Travel Log app.
```
