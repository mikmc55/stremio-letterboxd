import { config as dotenv } from "dotenv";
dotenv();

import { join } from "path";

import manifest from "./manifest";
import cors from "cors";
import express from "express";
import { watchlist_fetcher } from "./fetcher";
const app = express();

const PORT = process.env.PORT || 3030;

app.use(cors());

app.get("/", (req, res, next) => {
  return res.redirect("/configure");
});

app.get("/configure", function (req, res, next) {
  return res.sendFile(join(__dirname, "/static/index.html"));
});

// Create the catalog
app.get("/:username/manifest.json", async function (req, res, next) {
  manifest.id = `com.github.megadrive.letterboxd-watchlist-${req.params.username}`;
  manifest.name = `Letterboxd Watchlist - ${req.params.username}`;
  manifest.catalogs = [
    {
      id: req.params.username,
      type: "movie",
      name: `${req.params.username} - Letterboxd Watchlist`,
    },
  ];

  return res.json(manifest);
});

// Serve the meta items
app.get("/:username/catalog/:type/:id?", async (req, res) => {
  console.log(req.url);
  const { username, type, id } = req.params;

  if (type !== "movie") return res.json({ metas: [] });

  try {
    const films = await watchlist_fetcher(decodeURIComponent(username));

    return res.json(films);
  } catch (error) {
    // Return empty
    return res.json({ metas: [] });
  }
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
