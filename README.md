# Travel Log App

A mobile-first static Travel Log app for managing trip events. It runs with plain HTML and JavaScript, with no build step, backend, or package install required.

## Run Locally

Open `index.html` in a browser.

## Current Files

- `index.html` - primary load page with inline app styles and fallback markup
- `travel-log.js` - app logic, rendering, persistence, import, search, and PDF export
- `PROJECT_NOTES.md` - background/context for future development

## Features

- Trips grouped by trip name
- Events sorted by date inside each trip
- Compact one-line event display
- Add and edit events
- Save, delete, and cancel controls on the edit screen
- Edit trip names
- Delete entire trips with typed-name confirmation
- Local search across trip, date, time, location, description, and notes
- Import freeform trip notes from pasted text or a file
- File import can add to current data or replace all current browser data
- Export a shareable text itinerary that can be imported back into the app
- Review imported entries before adding them
- Reload the built-in sample itinerary from the import screen
- Persistent browser storage with `localStorage`
- PDF export in a new print-friendly tab
- PDF page break between trips
- PDF keeps each event together on one page
- Highlights `not booked` with a red alert marker and bold red text

## Storage

Data is stored in the browser using `localStorage` under:

```text
travel-log-entries-v1
```

This means edits survive refreshes on the same browser/device, but data is not shared across devices or stored on the web server.

## Deploy To Nginx

Copy these files to your Nginx web directory:

```text
index.html
travel-log.js
```

Example Fedora/Nginx path:

```bash
sudo mkdir -p /usr/share/nginx/html/travel-log
sudo cp index.html travel-log.js /usr/share/nginx/html/travel-log/
sudo systemctl reload nginx
```

Then open:

```text
http://your-server/travel-log/
```

## Development Note

When changing `travel-log.js`, bump the script version in `index.html`, for example:

```html
<script src="./travel-log.js?v=21" defer></script>
```

This helps browsers load the newest script instead of using a cached copy.
