const express = require("express");
const https = require("https");
const app = express();
const PORT = process.env.PORT || 3000;

function robloxGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "roblox.com",
      path: path,
      method: "GET",
      headers: { "Accept": "application/json" }
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

app.get("/games/v2/users/:userId/games", async (req, res) => {
  try {
    const data = await robloxGet(`/games/v2/users/${req.params.userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/games/v1/games/:universeId/game-passes", async (req, res) => {
  try {
    const data = await robloxGet(`/games/v1/games/${req.params.universeId}/game-passes?limit=100&sortOrder=Asc`);
    res.json(data);
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
