# Travel Log App Project Notes

## Purpose

This is a mobile-first Travel Log app for tracking trip events. It is designed to run as a simple static app, including from `file://` during local editing and from Nginx on Fedora.

## Main Files

- `index.html`: Primary load page. Contains all app layout CSS inline, fallback static itinerary markup, and the script tag for the app logic.
- `travel-log.js`: Main app behavior, data model, rendering, editing, importing, search, persistence, and PDF export.
- `README.md`: Short run/deploy notes.

Older/generated files such as `styles.css`, `src/`, and `travel-log-fresh.html` are not required for the current app unless intentionally reused later.

## Current Load Page

Use:

```text
index.html
```

The current app script is loaded with a cache-busting query string:

```html
<script src="./travel-log.js?v=16" defer></script>
```

When changing `travel-log.js`, bump the version number in `index.html` so browsers pick up the latest script.

## Data Storage

The app stores trip/event data in browser `localStorage`:

```js
travel-log-entries-v1
```

This means:

- Edits persist across browser refreshes.
- Data is per browser/device.
- Nginx only serves static files; it does not store centralized trip data.
- Clearing browser site data will reset the app to seeded sample data.

## Current Features

- Trip list grouped by trip.
- Events sorted by date inside each trip.
- One event per line/card.
- Floating `+` button at the top center for adding an event.
- Event edit button on each entry.
- Entry edit modal with `Save`, `Delete`, and `Cancel`.
- Trip edit button next to each trip.
- Trip rename updates all linked events.
- Trip delete requires typing the displayed trip name, case-insensitive, before deleting all linked events.
- Search filters events by trip, date, time, location, description, and notes.
- Import supports freeform pasted text and text-like file input.
- Import converts freeform events into proposed entries and shows checkboxes for approval.
- Import splits multi-location events into separate entries when possible.
- PDF export opens a new print-friendly tab and automatically launches the print/PDF dialog.
- PDF output has one page per trip.
- PDF keeps events together; events should not split across pages.
- PDF event rows show date, time, location, and description on one line.
- Events containing `not booked` show a red `!` badge and highlight `not booked` in bold red in both app view and PDF export.

## Sample Data

Seed data includes:

- `Alaska Trip`
- `Spain 2027 Trip`

These are only used when no localStorage data exists.

## Important Design Choices

- The app is intentionally dependency-free: no build step, no npm, no backend.
- Styles are inline in `index.html` to avoid earlier `file://` and embedded-browser loading issues.
- App behavior is in a small separate `travel-log.js` file for easier editing.
- Keep JavaScript conservative and plain ES5-ish where possible because the in-app browser had previously become unstable with larger inline scripts.
- The visible static itinerary in `index.html` acts as a fallback before JavaScript renders the live state.

## PDF Export Notes

PDF export is handled by `openPdfTab()` in `travel-log.js`.

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
- PDF export depends on browser print behavior.
- There is no undo after delete, except browser localStorage/manual recovery if implemented later.

## Good Future Improvements

- Add an export/import JSON backup for localStorage data.
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
