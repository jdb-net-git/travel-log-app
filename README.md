# Travel Log App

A mobile-first static Travel Log app for managing trip events. It runs with plain HTML and JavaScript, with no build step, backend, or package install required.

## Run Locally

Open `index.html` in a browser.

## Current Files

- `index.html` - primary load page with inline app styles and fallback markup
- `travel-log.js` - app logic, rendering, persistence, import, search, and PDF export
- `place.html` - local location dashboard opened from itinerary location links
- `place.js` - location dashboard data loading, maps, weather, and itinerary cards
- `grok-place-proxy.example.js` - optional server-side xAI Grok API proxy; keeps `XAI_API_KEY` out of the browser
- `PROJECT_NOTES.md` - background/context for future development

## Features

- Trips grouped by trip name
- Main trip page and destination dashboards share a dark navy, teal, and yellow travel-planner color scheme
- The centered `Add Event` button creates new entries
- Header buttons include `BACKUP`, `READ ME`, `TXT`, and `PDF`; `READ ME` displays an embedded read-only copy of this README in the app
- Floating buttons include `Add Event` and `Settings`
- Settings can choose the default description-link search site: ChatGPT, Grok, Gemini, or Google Search
- Trips sorted by the first event in each trip, earliest first
- Events sorted by date inside each trip
- Compact one-line event display
- Add and edit events
- Add events with a Trip field that supports both typed text and a visible existing-trip dropdown
- Add one or more file attachments or links to events
- Add trip-level attachments or links from the trip edit screen
- Delete links and attachments from the event or trip edit screen
- Delete only checked links or attachments without deleting the event or trip
- Save, delete, and cancel controls on the edit screen
- Event deletion requires a confirmation because it also deletes that event's links and attachments
- Edit trip names
- Delete entire trips with typed-name confirmation
- Local search across trip, date, time, location, description, and notes
- Event descriptions link to a ChatGPT search in a new tab
- Event locations link to a local destination dashboard
- Main-page location and description links are visibly highlighted and underlined
- Destination dashboards try the optional xAI Grok API proxy first, then Wikipedia, then a Google Search source link if no encyclopedia data is found
- Destination dashboards pull map tiles from OpenStreetMap and weather from Open-Meteo
- Destination dashboards reject unrelated Wikipedia matches and fall back to mapped place data when needed
- Destination dashboards open Google Maps, using specific place names from event descriptions plus the city/location for better matching
- Import freeform trip notes from pasted text or a file
- File import can add to current data or replace all current browser data
- Export a shareable text itinerary that can be imported back into the app
- Review imported entries before adding them
- Reload the built-in sample itinerary from the import screen
- Persistent browser storage with IndexedDB, plus `localStorage` compatibility for existing browser data
- PDF export in a new print-friendly tab
- PDF export lets you choose ALL TRIPS or one trip, then whether to include notes
- PDF export marks events with attachments by appending `-A` to the description, but does not include the attachment files
- PDF rows display location, date, time, and description, with the date shown only on the first event of each day
- BACKUP can export or restore entries, trip resources, links, and attachments; backup lets you choose ALL TRIPS or one trip
- PDF page break between trips
- PDF keeps each event together on one page
- Highlights `not booked` with a red alert marker and bold red text

## Storage

Data is stored in the browser using IndexedDB, with `localStorage` compatibility under:

```text
travel-log-entries-v1
```

This means edits survive refreshes on the same browser/device, but data is not shared across devices or stored on the web server.

Links and attachments are stored inside the same browser data. Attachments use data URLs. The app uses IndexedDB as the more durable store for larger mobile restores, and keeps localStorage compatibility where available. Use `BACKUP` to move entries, links, and attachments between PC, iOS, and Android browsers.

The app does not automatically change saved trip names or dates. It uses saved browser data as-is, or loads the built-in 2027 sample itinerary when no saved data exists.

## Deploy To Nginx

Copy these files to your Nginx web directory:

```text
index.html
travel-log.js
place.html
place.js
grok-place-proxy.example.js
```

Example Fedora/Nginx path:

```bash
sudo mkdir -p /usr/share/nginx/html/travel-log
sudo cp index.html travel-log.js place.html place.js /usr/share/nginx/html/travel-log/
sudo systemctl reload nginx
```

The Grok lookup requires a server-side endpoint because xAI API keys should not be exposed in browser JavaScript. Use `grok-place-proxy.example.js` as a starting point, set `XAI_API_KEY`, and proxy `/api/grok-place` to that process.

Then open:

```text
http://your-server/travel-log/
```

## Development Note

When changing `travel-log.js`, bump the script version in `index.html`, for example:

```html
<script src="./travel-log.js?v=56" defer></script>
```

This helps browsers load the newest script instead of using a cached copy.

The `READ ME` button uses an embedded copy of this file in `travel-log.js`. Update `readmeText()` whenever `README.md` changes.

## GitHub

Source: https://github.com/jdb-net-git/travel-log-app
