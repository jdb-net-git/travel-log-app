(function () {
  var storageKey = "travel-log-entries-v1";
  var databaseName = "travel-log-storage";
  var databaseStore = "state";
  var params = new URLSearchParams(window.location.search);
  var place = (params.get("location") || "Madrid").trim();
  var trip = (params.get("trip") || "").trim();
  var mapQuery = (params.get("mapQuery") || place).trim();
  var storedEntries = [];
  var state = {
    title: place,
    summary: "",
    image: "",
    source: "",
    sourceName: "",
    lat: null,
    lon: null,
    nearby: []
  };

  document.addEventListener("DOMContentLoaded", function () {
    setText("place-title", place);
    setText("saved-place", place);
    setText("trip-label", trip || "Travel Log");
    loadEntries().then(function (entries) {
      storedEntries = entries;
      renderCalendar(matchingEntries());
      renderCards(matchingEntries());
      loadPlace();
    });
  });

  function loadPlace() {
    setStatus("Loading live data");
    lookupGrokPlace(place)
      .then(function (result) {
        if (result) return result;
        setStatus("Searching Wikipedia");
        return lookupWikipedia(place);
      })
      .then(function (result) {
        if (result) {
          applyPlaceResult(result);
        } else {
          setStatus("Using Google search");
          state.source = googleSearchUrl(place);
          state.sourceName = "Google Search";
        }
        updateHero();
        return state.lat && state.lon ? state : geocodePlace(place);
      })
      .then(function () {
        updateMap();
        updateCoordinates();
        return Promise.all([loadWeather(), loadNearby()]);
      })
      .then(function () {
        renderCards(matchingEntries());
        setStatus(state.sourceName === "Google Search" ? "Google search ready" : "Loaded from " + (state.sourceName || "web data"));
      })
      .catch(function () {
        setStatus("Using local itinerary");
        updateHero();
        geocodePlace(place).then(function () {
          updateMap();
          updateCoordinates();
          loadWeather();
          loadNearby().then(function () {
            renderCards(matchingEntries());
          });
        });
      });
  }

  function lookupGrokPlace(query) {
    setStatus("Searching Grok");
    return tryGrokPlaceEndpoints(query, grokPlaceEndpoints(), 0)
      .catch(function () {
        return null;
      });
  }

  function tryGrokPlaceEndpoints(query, endpoints, index) {
    if (index >= endpoints.length) return Promise.resolve(null);
    return fetchJson(endpoints[index] + "?location=" + encodeURIComponent(query))
      .then(function (result) {
        if (!result || !result.summary || !isRelevantWikipediaTitle(query, result.title || query)) return null;
        return {
          sourceName: "Grok",
          title: result.title || query,
          summary: result.summary || "",
          source: result.source || "https://grok.com/?q=" + encodeURIComponent(query),
          lat: result.lat || null,
          lon: result.lon || null
        };
      })
      .catch(function () {
        return tryGrokPlaceEndpoints(query, endpoints, index + 1);
      });
  }

  function grokPlaceEndpoints() {
    var configured = window.TRAVEL_LOG_GROK_ENDPOINT;
    var endpoints = configured ? [configured] : [];
    endpoints.push("./api/grok-place");
    if (window.location.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)) {
      endpoints.push("http://127.0.0.1:8790/api/grok-place");
    }
    return unique(endpoints);
  }

  function lookupWikipedia(query) {
    return searchWikipedia(query)
      .then(function (title) {
        if (!title) return null;
        return fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title));
      })
      .then(function (summary) {
        if (!summary) return null;
        return {
          sourceName: "Wikipedia",
          title: summary.title || place,
          summary: summary.extract || "",
          image: summary.thumbnail && summary.thumbnail.source ? summary.thumbnail.source : "",
          source: summary.content_urls && summary.content_urls.desktop ? summary.content_urls.desktop.page : "",
          lat: summary.coordinates ? summary.coordinates.lat : null,
          lon: summary.coordinates ? summary.coordinates.lon : null
        };
      })
      .catch(function () {
        return null;
      });
  }

  function applyPlaceResult(result) {
    state.title = result.title || place;
    state.summary = result.summary || "";
    state.image = result.image || "";
    state.source = result.source || "";
    state.sourceName = result.sourceName || "";
    if (result.lat && result.lon) {
      state.lat = result.lat;
      state.lon = result.lon;
    }
    if (result.sourceName) setStatus("Loaded from " + result.sourceName);
  }

  function searchWikipedia(query) {
    var url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(query) + "&format=json&origin=*";
    return fetchJson(url).then(function (data) {
      var hits = data.query && data.query.search ? data.query.search : [];
      for (var i = 0; i < hits.length; i += 1) {
        if (isRelevantWikipediaTitle(query, hits[i].title)) return hits[i].title;
      }
      return "";
    });
  }

  function isRelevantWikipediaTitle(query, title) {
    var queryWords = meaningfulWords(query);
    var titleText = normalizeText(title);
    if (!queryWords.length) return false;
    if (queryWords.length === 1 && queryWords[0].length <= 3) return true;
    return queryWords.every(function (word) {
      return titleText.indexOf(word) !== -1;
    });
  }

  function meaningfulWords(value) {
    return normalizeText(value).split(" ").filter(function (word) {
      return word.length > 1 && ["the", "and", "de", "del", "la", "le", "of"].indexOf(word) === -1;
    });
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function unique(values) {
    var seen = {};
    return values.filter(function (value) {
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function geocodePlace(query) {
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query);
    return fetchJson(url).then(function (data) {
      if (!data || !data.length) return;
      state.lat = Number(data[0].lat);
      state.lon = Number(data[0].lon);
      if (!state.summary && data[0].display_name) state.summary = data[0].display_name;
    });
  }

  function loadWeather() {
    if (!state.lat || !state.lon) return Promise.resolve();
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(state.lat) + "&longitude=" + encodeURIComponent(state.lon) + "&current=temperature_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph";
    return fetchJson(url).then(function (data) {
      if (!data.current) return;
      setText("weather-temp", Math.round(data.current.temperature_2m) + " F");
      setText("weather-note", "Wind " + Math.round(data.current.wind_speed_10m) + " mph");
    }).catch(function () {
      setText("weather-note", "Weather unavailable");
    });
  }

  function loadNearby() {
    if (!state.lat || !state.lon) return Promise.resolve();
    var url = "https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=" + encodeURIComponent(state.lat + "|" + state.lon) + "&gsradius=10000&gslimit=4&format=json&origin=*";
    return fetchJson(url).then(function (data) {
      state.nearby = data.query && data.query.geosearch ? data.query.geosearch : [];
      if (state.nearby.length) {
        setText("nearby-value", state.nearby[0].title);
        setText("nearby-note", Math.round(state.nearby[0].dist / 100) / 10 + " km away");
      }
    }).catch(function () {
      setText("nearby-note", "Nearby places unavailable");
    });
  }

  function updateHero() {
    setText("place-title", state.title || place);
    setText("summary", state.summary || "No web summary found yet. Your local itinerary cards are still available below.");
    setText("saved-place", state.title || place);
    var source = document.getElementById("source-link");
    if (source && state.source) source.href = state.source;
  }

  function updateMap() {
    var mapCard = document.getElementById("map-card");
    var mapLink = document.getElementById("map-link");
    if (!mapCard) return;
    if (state.lat && state.lon) {
      mapCard.innerHTML = tileMapHtml(state.lat, state.lon) + '<div class="pin pin-one"><span>1</span></div><div class="pin pin-two"><span>2</span></div><div class="pin pin-three"><span>3</span></div>';
      if (mapLink) mapLink.href = googleMapsUrl();
    } else if (state.image) {
      mapCard.innerHTML = '<img alt="' + esc(state.title || place) + '" src="' + esc(state.image) + '">';
    } else {
      mapCard.innerHTML = '<div class="map-fallback">Map unavailable</div>';
    }
  }

  function tileMapHtml(lat, lon) {
    var zoom = 12;
    var centerX = lonToTile(lon, zoom);
    var centerY = latToTile(lat, zoom);
    var html = '<div class="tile-map" role="img" aria-label="Map of ' + esc(state.title || place) + '">';
    for (var y = centerY - 1; y <= centerY + 1; y += 1) {
      for (var x = centerX - 1; x <= centerX + 1; x += 1) {
        html += '<img alt="" src="https://tile.openstreetmap.org/' + zoom + "/" + x + "/" + y + '.png">';
      }
    }
    return html + "</div>";
  }

  function lonToTile(lon, zoom) {
    return Math.floor((Number(lon) + 180) / 360 * Math.pow(2, zoom));
  }

  function latToTile(lat, zoom) {
    var radians = Number(lat) * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  function updateCoordinates() {
    if (!state.lat || !state.lon) return;
    setText("coord-value", state.lat.toFixed(3) + ", " + state.lon.toFixed(3));
    setText("coord-note", "Resolved from web data");
  }

  function googleMapsUrl() {
    var query = mapQuery || state.title || place;
    if (query !== place && !queryHasExplicitPlaceContext(query, place)) {
      query += ", " + place;
    }
    if (state.lat && state.lon && query === place) {
      query += " " + state.lat + "," + state.lon;
    }
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  function googleSearchUrl(query) {
    return "https://www.google.com/search?q=" + encodeURIComponent(query);
  }

  function queryHasExplicitPlaceContext(query, location) {
    var normalizedQuery = String(query || "").toLowerCase();
    var normalizedLocation = String(location || "").toLowerCase();
    return normalizedLocation && normalizedQuery.indexOf(", " + normalizedLocation) !== -1;
  }

  function renderCards(entries) {
    var cards = document.getElementById("cards");
    if (!cards) return;
    var items = entries.slice(0, 4).map(function (entry) {
      return {
        title: entry.description || entry.location,
        label: formatDate(entry.date) + (entry.time ? " at " + formatTime(entry.time) : ""),
        body: entry.notes || entry.trip || "Travel Log"
      };
    });
    if (!items.length && state.nearby.length) {
      items = state.nearby.map(function (nearby) {
        return {
          title: nearby.title,
          label: Math.round(nearby.dist / 100) / 10 + " km away",
          body: "Nearby place from Wikipedia"
        };
      });
    }
    if (!items.length) {
      items = [{ title: state.title || place, label: "Destination", body: state.summary || "Add this place to an itinerary to see trip cards here." }];
    }
    cards.innerHTML = items.map(function (item) {
      return '<article class="card">' + (state.image ? '<img alt="" src="' + esc(state.image) + '">' : "") + '<div class="card-content"><span class="muted">' + esc(item.label) + '</span><h3>' + esc(item.title) + '</h3><p>' + esc(item.body) + '</p></div></article>';
    }).join("");
    setText("card-count", items.length + (items.length === 1 ? " card" : " cards"));
  }

  function renderCalendar(entries) {
    var grid = document.getElementById("calendar-grid");
    if (!grid) return;
    var base = entries.length ? new Date(entries[0].date + "T12:00:00") : new Date();
    var activeDays = {};
    entries.forEach(function (entry) {
      activeDays[Number(entry.date.slice(8, 10))] = true;
    });
    var month = base.getMonth();
    var year = base.getFullYear();
    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);
    var names = ["S", "M", "T", "W", "T", "F", "S"];
    var html = names.map(function (name) { return "<strong>" + name + "</strong>"; }).join("");
    for (var i = 0; i < first.getDay(); i += 1) html += "<span></span>";
    for (var day = 1; day <= last.getDate(); day += 1) {
      html += '<span class="day' + (activeDays[day] ? " active" : "") + '">' + day + "</span>";
    }
    grid.innerHTML = html;
    setText("calendar-title", new Intl.DateTimeFormat("en-US", { month: "long" }).format(base));
    setText("calendar-year", String(year));
  }

  function matchingEntries() {
    return storedEntries.filter(function (entry) {
      var samePlace = String(entry.location || "").toLowerCase() === place.toLowerCase();
      var sameTrip = !trip || String(entry.trip || "").toLowerCase() === trip.toLowerCase();
      return samePlace && sameTrip;
    }).sort(function (a, b) {
      return new Date(a.date + "T" + (a.time || "00:00")).getTime() - new Date(b.date + "T" + (b.time || "00:00")).getTime();
    });
  }

  function loadEntries() {
    var localEntries = loadLocalEntries();
    return loadIndexedEntries().then(function (indexedEntries) {
      return indexedEntries.length ? indexedEntries : localEntries;
    }).catch(function () {
      return localEntries;
    });
  }

  function loadLocalEntries() {
    try {
      var raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function loadIndexedEntries() {
    if (!window.indexedDB) return Promise.resolve([]);
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(databaseStore)) {
          db.createObjectStore(databaseStore, { keyPath: "id" });
        }
      };
      request.onerror = function () { reject(request.error); };
      request.onsuccess = function () {
        var db = request.result;
        var transaction = db.transaction(databaseStore, "readonly");
        var read = transaction.objectStore(databaseStore).get(storageKey);
        read.onsuccess = function () {
          var value = read.result;
          resolve(value && Array.isArray(value.entries) ? value.entries : []);
        };
        read.onerror = function () { reject(read.error); };
      };
    });
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Request failed");
      return response.json();
    });
  }


  function setStatus(value) {
    setText("status", value);
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value + "T12:00:00"));
  }

  function formatTime(value) {
    var parts = value.split(":");
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, Number(parts[0]), Number(parts[1])));
  }

  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
