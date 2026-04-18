const express = require("express");
const https = require("https");
const app = express();
const PORT = process.env.PORT || 3000;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "FestIslandDonate/1.0"
      }
    };
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

app.get("/games/v2/users/:userId/games", async (req, res) => {
  try {
    const data = await httpsGet("https://games.roblox.com/v2/users/" + req.params.userId + "/games?accessFilter=Public&limit=50&sortOrder=Asc");
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/games/v1/games/:universeId/game-passes", async (req, res) => {
  try {
    const universeId = req.params.universeId;
    
    // Try the standard API first
    try {
      const data = await httpsGet("https://games.roblox.com/v1/games/" + universeId + "/game-passes?limit=100&sortOrder=Asc");
      if (data.data && data.data.length > 0) {
        res.json(data);
        return;
      }
    } catch (e) {}

    // Fallback: use the old roblox.com endpoint
    try {
      const raw = await httpsGet("https://www.roblox.com/games/getgamepassesjson?universeId=" + universeId + "&sortOrder=Asc&limit=25");
      if (raw && raw.GamePasses) {
        const passes = raw.GamePasses.map(function(p) {
          return {
            id: p.GamePassID || p.ID || p.Id,
            name: p.Name || p.Name,
            price: p.PriceInRobux || p.Price || 0,
            iconImageAssetId: p.IconImageAssetID || 0
          };
        }).filter(function(p) { return p.price > 0; });
        res.json({ previousPageCursor: null, nextPageCursor: null, data: passes });
        return;
      }
    } catch (e2) {}

    // Last fallback: search.roblox.com catalog json
    try {
      const searchData = await httpsGet("https://search.roblox.com/catalog/json?Category=34&GameFilter=" + universeId + "&SortType=3&SortAggregation=5&ResultsPerPage=25");
      if (searchData && Array.isArray(searchData)) {
        const passes = searchData.map(function(item) {
          return {
            id: item.Id || item.AssetId,
            name: item.Name,
            price: item.PriceInRobux || item.Price || 0,
            iconImageAssetId: 0
          };
        }).filter(function(p) { return p.price > 0; });
        res.json({ previousPageCursor: null, nextPageCursor: null, data: passes });
        return;
      }
    } catch (e3) {}

    res.json({ previousPageCursor: null, nextPageCursor: null, data: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "fest-island-donate" });
});

app.listen(PORT, () => {
  console.log("Fest Island Donate backend running on port " + PORT);
});
