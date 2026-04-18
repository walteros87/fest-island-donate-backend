const express = require("express");
const https = require("https");
const app = express();
const PORT = process.env.PORT || 3000;

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      path: path,
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "FestIslandDonate/1.0"
      }
    };
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        try {
          const redirectUrl = new URL(res.headers.location);
          httpsGet(redirectUrl.hostname, redirectUrl.pathname + redirectUrl.search)
            .then(resolve).catch(reject);
        } catch (e) {
          reject(new Error("Invalid redirect URL: " + res.headers.location));
        }
        return;
      }
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error("HTTP " + res.statusCode + ": " + body.substring(0, 200)));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("Invalid JSON: " + body.substring(0, 200))); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Request timeout")); });
    req.end();
  });
}

app.get("/games/v2/users/:userId/games", async (req, res) => {
  try {
    const data = await httpsGet("games.roblox.com", "/v2/users/" + req.params.userId + "/games?accessFilter=Public&limit=50&sortOrder=Asc");
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/games/v1/games/:universeId/game-passes", async (req, res) => {
  try {
    const universeId = req.params.universeId;
    const data = await httpsGet("games.roblox.com", "/v1/games/" + universeId + "/game-passes?limit=100&sortOrder=Asc");
    if (data.errors && data.errors.length > 0 && !data.data) {
      const fallbackData = await httpsGet("search.roblox.com", "/catalog?Category=34&GameFilter=" + universeId + "&SortType=3&SortAggregation=5&Limit=25");
      if (fallbackData && fallbackData.data) {
        const passes = fallbackData.data.map(function(item) {
          return {
            id: item.id,
            name: item.name,
            price: item.price != null ? item.price : 0,
            iconImageAssetId: item.assetThumbnailUrl || 0
          };
        }).filter(function(p) { return p.price > 0; });
        res.json({ previousPageCursor: null, nextPageCursor: null, data: passes });
      } else {
        res.json({ previousPageCursor: null, nextPageCursor: null, data: [] });
      }
    } else {
      res.json(data);
    }
  } catch (e) {
    try {
      const universeId = req.params.universeId;
      const fallbackData = await httpsGet("search.roblox.com", "/catalog?Category=34&GameFilter=" + universeId + "&SortType=3&SortAggregation=5&Limit=25");
      if (fallbackData && fallbackData.data) {
        const passes = fallbackData.data.map(function(item) {
          return {
            id: item.id,
            name: item.name,
            price: item.price != null ? item.price : 0,
            iconImageAssetId: 0
          };
        }).filter(function(p) { return p.price > 0; });
        res.json({ previousPageCursor: null, nextPageCursor: null, data: passes });
      } else {
        res.json({ previousPageCursor: null, nextPageCursor: null, data: [] });
      }
    } catch (e2) {
      res.status(500).json({ error: e.message, fallbackError: e2.message });
    }
  }
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "fest-island-donate" });
});

app.listen(PORT, () => {
  console.log("Fest Island Donate backend running on port " + PORT);
});
