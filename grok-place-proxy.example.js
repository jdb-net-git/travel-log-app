const http = require("http");
const { URL } = require("url");

const port = Number(process.env.PORT || 8790);
const apiKey = process.env.XAI_API_KEY;
const model = process.env.XAI_MODEL || "grok-4.3";

if (!apiKey) {
  console.error("Set XAI_API_KEY before starting this proxy.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname !== "/api/grok-place") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const location = String(url.searchParams.get("location") || "").trim();
  if (!location) {
    sendJson(res, 400, { error: "Missing location" });
    return;
  }

  try {
    const result = await lookupPlace(location);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 502, { error: "Grok lookup failed" });
  }
});

server.listen(port, () => {
  console.log(`Grok place proxy listening on http://127.0.0.1:${port}`);
});

async function lookupPlace(location) {
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "Return concise, factual travel-place data as strict JSON only. Do not include markdown."
        },
        {
          role: "user",
          content: [
            "Find travel-relevant knowledge for this place:",
            location,
            "",
            "Return JSON with keys:",
            "title: canonical place name",
            "summary: 2-4 sentence factual overview for a traveler",
            "source: best public source URL if known, otherwise https://grok.com/?q=<encoded query>",
            "lat: latitude number if known, otherwise null",
            "lon: longitude number if known, otherwise null"
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`xAI request failed: ${response.status}`);
  const data = await response.json();
  return parseJsonResponse(data.output_text || "");
}

function parseJsonResponse(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object returned");
  const parsed = JSON.parse(match[0]);
  return {
    title: String(parsed.title || ""),
    summary: String(parsed.summary || ""),
    source: String(parsed.source || ""),
    lat: typeof parsed.lat === "number" ? parsed.lat : null,
    lon: typeof parsed.lon === "number" ? parsed.lon : null
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "http://127.0.0.1:8787"
  });
  res.end(JSON.stringify(payload));
}
