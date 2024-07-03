import { config as dotenv } from "dotenv";
dotenv();

import manifest, { type ManifestExpanded } from "./manifest.js";
import cors from "cors";
import express from "express";
import { fetchFilms } from "./fetcher.js";
import { doesLetterboxdResourceExist } from "./util.js";
import { env } from "./env.js";
// import { parseLetterboxdURLToID } from "./util.js"; // Removed if not used
import { lruCache } from "./lib/lruCache.js";
import { parseConfig } from "./lib/config.js";
import { replacePosters } from "./providers/letterboxd.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import type { StremioMeta, StremioMetaPreview } from "./consts.js";
import { HTTP_CODES } from "./consts.js";
import { publishToCentral } from "./lib/publishToStremioOfficialRepository.js";
import { ListManager } from "./providers/listManager.js";

const listManager = new ListManager();
listManager.startPolling();

const app = express();

const logBase = logger("server");

if (env.isProd || env.isProduction) {
  publishToCentral("https://letterboxd.almosteffective.com/").then(() => {
    logBase(
      `Published to stremio official repository as ${manifest.name} with ID ${manifest.id} and version ${manifest.version}`,
    );
  });
} else {
  logBase("Not in Production, not publishing to stremio official repository");
}

const PORT = env.PORT;

app.use(cors());
app.use(express.static("static"));

function toStremioMetaPreview(metas: StremioMeta[]): StremioMetaPreview[] {
  return metas.map((film) => {
    return {
      id: film.id,
      type: film.type,
      name: film.name,
      poster: film.poster,
    };
  });
}

/** Recommends a list */
app.get("/recommend", async (_req, res) => {
  const recommendedList = listManager.recommend();
  if (!recommendedList) return res.status(HTTP_CODES.NOT_FOUND).send();
  return res.status(HTTP_CODES.OK).json(recommendedList);
});

/** Redirects to /configure */
app.get("/", (_req, res) => {
  return res.redirect("/configure");
});

/** Redirects to /configure with provided config */
app.get("/:id/configure", (req, res) => {
  const base = !env.isProduction ? "http://localhost:4321/" : "";

  return res.redirect(
    `${base}/configure?id=${encodeURIComponent(req.params.id)}`,
  );
});

/** Provide a base Manifest.json for Stremio Community and Stremio Unofficial Addons */
app.get("/manifest.json", (_req, res) => {
  const cloned_manifest = Object.assign({}, manifest);
  cloned_manifest.description =
    "!! Letterboxd requires configuration! Click Configure instead or go to https://letterboxd.almosteffective.com/ !!";
  res.setHeader("Content-Type", "application/json");
  res.json(cloned_manifest);
});

/** Provide a manifest for the provided config. */
app.get("/:providedConfig/manifest.json", async (req, res) => {
  const log = logBase.extend("manifest");
  const { providedConfig } = req.params;
  let cachedConfig:
    | Awaited<ReturnType<typeof prisma.config.findFirstOrThrow>>
    | undefined = undefined;
  try {
    cachedConfig = await prisma.config.findFirstOrThrow({
      where: {
        id: providedConfig,
      },
    });
  } catch (error) {
    log("No config found for providedConfig", providedConfig);
    log(error);
  }
  const config = parseConfig(
    cachedConfig ? cachedConfig.config : providedConfig,
  );
  if (!config) {
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json();
  }

  const cloned_manifest = JSON.parse(
    JSON.stringify(manifest),
  ) as ManifestExpanded;
  cloned_manifest.id = `${
    env.isDevelopment ? "dev-" : ""
  }com.github.megadrive.letterboxd-watchlist-${config.pathSafe}`;
  cloned_manifest.name = `Letterboxd - ${config.catalogName}`;

  cloned_manifest.description = `Provides a list of films at https://letterboxd.com${config.path} as a catalog.`;

  cloned_manifest.catalogs = [
    {
      id: config.path,
      /** @ts-ignore next-line */
      type: "letterboxd",
      name: config.catalogName,
      extra: [
        {
          name: "skip",
          isRequired: false,
        },
      ],
    },
  ];

  return res.json(cloned_manifest);
});

/** Provide the catalog for the provided config. */
app.get("/:providedConfig/catalog/:type/:id/:extra?", async (req, res) => {
  // We would use {id} if we had more than one list.
  const { providedConfig, type, id, extra } = req.params;
  const parsedExtras = (() => {
    if (!extra) return undefined;

    const rextras = /([A-Za-z]+)+=([A-Za-z0-9]+)/g;
    const matched = [...extra.matchAll(rextras)];
    const rv: Record<string, string> = {};
    for (const match of matched) {
      rv[match[1]] = match[2];
    }
    return rv;
  })();
  const log = logBase.extend(`catalog:${id}`);
  let cachedConfig: Awaited<ReturnType<typeof prisma.config.findFirst>>;
  try {
    cachedConfig = await prisma.config.findFirst({
      where: {
        id: providedConfig,
      },
    });
    if (!cachedConfig) {
      log(`No config found for ${providedConfig}, using provided config`);
    }
  } catch (error) {
    log(error);
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json({ metas: [] });
  }
  // if we have a cacched config, use it, otherwise use the provided one
  const config = parseConfig(
    cachedConfig ? cachedConfig.config : providedConfig,
  );

  const username = config.username;

  if (parsedExtras?.letterboxdhead) {
    // Perform a HEAD-style request to confirm the resource exists and has at least 1 movie.
    const metas = await fetchFilms(config.path, { head: true });
    return res.status(HTTP_CODES.OK).json(metas);
  }

  const consoleTime = `[${config.path}] catalog`;
  console.time(consoleTime);

  // We still keep movie here for legacy purposes, so current users don't break.
  if (type !== "movie" && type !== "letterboxd") {
    log(`Wrong type: ${type}, giving nothing.`);
    return res.status(HTTP_CODES.BAD_REQUEST).json({ metas: [] });
  }

  try {
    if ((await doesLetterboxdResourceExist(config.path)) === false) {
      log(`${config.path} doesn't exist`);
      return res.status(HTTP_CODES.NOT_FOUND).send();
    }

    const sCache = lruCache.get(config.pathSafe);
    if (!sCache) {
      log(`No cache found for ${username}`);
    }
    const cachedMetas: StremioMeta[] | undefined =
      sCache && sCache.extras == extra ? sCache.metas : undefined;
    const metas =
      cachedMetas ||
      (await fetchFilms(config.path, {
        limit: parsedExtras?.skip
          ? Number(parsedExtras?.skip) + 100
          : undefined,
        skip: parsedExtras?.skip ? Number(parsedExtras.skip) : undefined,
      }));

    if (sCache?.extras != extra) {
      lruCache.set(config.pathSafe, {
        metas,
        extras: extra,
      });
    }

    console.timeEnd(consoleTime);

    if (metas) return res.status(HTTP_CODES.OK).json({ metas });
    return res.status(HTTP_CODES.NO_CONTENT).send();
  } catch (error) {
    log(error);
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json({ metas: [] });
  }
});

const server = app.listen(PORT, () =>
  logBase(`Addon running on port ${PORT}. Debug at http://localhost:${PORT}`),
);

process.on("SIGTERM", () => {
  logBase("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logBase("HTTP server closed");
  });
});
