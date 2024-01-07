import { config as dotenv } from "dotenv";
dotenv();

import { join } from "path";

import manifest from "./manifest";
import cors from "cors";
import express from "express";
import { watchlist_fetcher } from "./fetcher";
const app = express();

const PORT = 3030;

app.use(cors());

app.get("/", (req, res, next) => {
  return res.redirect("/configure");
});

app.get("/configure", function (req, res, next) {
  return res.sendFile(join(__dirname, "/static/index.html"));
});

// Create the catalog
app.get("/:username/manifest.json", async function (req, res, next) {
  manifest.catalogs.push({
    id: `com.github.megadrive.letterboxd-watchlist-${req.params.username}`,
    type: "movie",
    name: `Letterboxd - ${req.params.username}`,
  });

  return res.json(manifest);
});

// Serve the meta items
app.get("/:username/catalog/:type/:id?", async (req, res) => {
  const { username, type, id } = req.params;

  if (type !== "movie") return res.send("bad");

  const films = await watchlist_fetcher(username);

  return res.json(films);
});

app.listen(PORT, () => console.log(`Addon URL: http://localhost:${PORT}`));
