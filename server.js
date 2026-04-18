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
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

function extractPasses(data) {
  var passes = [];
  if (!data) return passes;
  var items = data.data || data.GamePasses || data.items || [];
  if (!Array.isArray(items)) return passes;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var id = item.id || item.Id || item.gamePassId || item.GamePassID || item.assetId || 0;
    var name = item.name || item.Name || "Game Pass";
    var price = item.price || item.Price || item.PriceInRobux || 0;
    if (id > 0 && price > 0) {
      passes.push({ id: id, name: name, price: price });
    }
  }
  return passes;
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
  var universeId = req.params.universeId;
  var passes = [];

  // Try 1: catalog.roblox.com with gameFilter
  try {
    var d = await httpsGet("https://catalog.roblox.com/v1/search/items?category=34&sortType=3&gameFilter=" + universeId + "&limit=10");
    passes = extractPasses(d);
    if (passes.length > 0) { res.json({ data: passes }); return; }
  } catch (e) {}

  // Try 2: catalog.roblox.com with universeId param
  try {
    var d = await httpsGet("https://catalog.roblox.com/v1/search/items?category=GamePass&sortType=3&universeId=" + universeId + "&limit=10");
    passes = extractPasses(d);
    if (passes.length > 0) { res.json({ data: passes }); return; }
  } catch (e) {}

  // Try 3: games.roblox.com standard API
  try {
    var d = await httpsGet("https://games.roblox.com/v1/games/" + universeId + "/game-passes?limit=100&sortOrder=Asc");
    passes = extractPasses(d);
    if (passes.length > 0) { res.json({ data: passes }); return; }
  } catch (e) {}

  // Try 4: old www.roblox.com endpoint with universeId
  try {
    var d = await httpsGet("https://www.roblox.com/games/getgamepassesjson?universeId=" + universeId);
    passes = extractPasses(d);
    if (passes.length > 0) { res.json({ data: passes }); return; }
  } catch (e) {}

  // Try 5: search.roblox.com with placeId
  try {
    var d = await httpsGet("https://search.roblox.com/catalog/json?Category=34&GameFilter=" + universeId + "&SortType=3&ResultsPerPage=10");
    passes = extractPasses(d);
    if (passes.length > 0) { res.json({ data: passes }); return; }
  } catch (e) {}

  res.json({ data: [] });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "fest-island-donate" });
});

app.listen(PORT, () => {
  console.log("Fest Island Donate backend running on port " + PORT);
});
