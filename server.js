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
  const universeId = req.params.universeId;
  let allPasses = [];

  // Method 1: catalog.roblox.com (most reliable)
  try {
    const searchData = await httpsGet("https://catalog.roblox.com/v1/search/items?category=GamePass&sortType=3&universeId=" + universeId + "&limit=10");
    if (searchData && searchData.data && Array.isArray(searchData.data)) {
      for (const item of searchData.data) {
        allPasses.push({
          id: item.id || item.assetId || 0,
          name: item.name || "Game Pass",
          price: item.price || 0
        });
      }
    }
  } catch (e) {
    console.log("Method 1 failed:", e.message);
  }

  // Method 2: games.roblox.com API
  if (allPasses.length === 0) {
    try {
      const gameData = await httpsGet("https://games.roblox.com/v1/games/" + universeId + "/game-passes?limit=100&sortOrder=Asc");
      if (gameData && gameData.data && Array.isArray(gameData.data)) {
        for (const item of gameData.data) {
          allPasses.push({
            id: item.id || 0,
            name: item.name || "Game Pass",
            price: item.price || 0
          });
        }
      }
    } catch (e2) {
      console.log("Method 2 failed:", e2.message);
    }
  }

  // Filter out free passes
  allPasses = allPasses.filter(function(p) { return p.price > 0; });

  res.json({ previousPageCursor: null, nextPageCursor: null, data: allPasses });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "fest-island-donate" });
});

app.listen(PORT, () => {
  console.log("Fest Island Donate backend running on port " + PORT);
});
