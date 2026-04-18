const express = require("express");
const https = require("https");
const app = express();
const PORT = process.env.PORT || 3000;

function robloxRequest(hostname, path) {
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
        const redirectUrl = new URL(res.headers.location);
        robloxRequest(redirectUrl.hostname, redirectUrl.pathname + redirectUrl.search)
          .then(resolve).catch(reject);
        return;
      }
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("Invalid JSON: " + body.substring(0, 200))); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

app.get("/games/v2/users/:userId/games", async (req, res) => {
  try {
    const path = "/v2/users/" + req.params.userId + "/games?accessFilter=Public&limit=50&sortOrder=Asc";
    const data = await robloxRequest("games.roblox.com", path);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/games/v1/games/:universeId/game-passes", async (req, res) => {
  try {
    const path = "/v1/games/" + req.params.universeId + "/game-passes?limit=100&sortOrder=Asc";
    const data = await robloxRequest("games.roblox.com", path);
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
