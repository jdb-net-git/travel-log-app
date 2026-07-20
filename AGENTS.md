# Travel Log — agent notes

Static, mobile-first travel itinerary app. No build step, no npm, no backend required for the core app.

## Before changing code

1. Read `PROJECT_NOTES.md` (design choices, features, limitations).
2. Read `README.md` (run/deploy).
3. Prefer editing the live files below; ignore any legacy Codex folders elsewhere on disk.

## Live files

| File | Role |
|------|------|
| `index.html` | Load page, inline CSS, script tag |
| `travel-log.js` | Main app logic, storage, import, PDF, backup |
| `place.html` / `place.js` | Destination dashboard (maps, weather, place info) |
| `grok-place-proxy.example.js` | Optional server-side xAI Grok proxy (keep API keys off the client) |
| `README.md` | User-facing run/deploy notes |
| `PROJECT_NOTES.md` | Full project context for development |

## Conventions

- Keep the app dependency-free and plain JS (ES5-ish where practical).
- Styles stay inline in `index.html` unless there is a strong reason to split them.
- When changing `travel-log.js`, bump the cache-bust query on the script tag in `index.html` (e.g. `travel-log.js?v=54` → `?v=55`).
- The in-app **READ ME** button uses `readmeText()` in `travel-log.js`. Update that whenever `README.md` changes.
- Data is browser-local (IndexedDB + localStorage key `travel-log-entries-v1`). Do not auto-migrate or rewrite saved trip names/dates.
- Do not commit secrets. If wiring Grok place lookup, use a server-side proxy and env `XAI_API_KEY`.

## Run locally

Open `index.html` in a browser (or serve the folder over HTTP for features that need same-origin APIs).

## Good default task prompt

> Read PROJECT_NOTES.md, README.md, index.html, and travel-log.js, then help continue this Travel Log app.
