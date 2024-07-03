import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { fetchFilms } from "./fetcher.js";
import { doesLetterboxdResourceExist, parseLetterboxdURLToID, parseConfig } from "./util.js";
import { env } from "./env.js";
import { lruCache } from "./lib/lruCache.js";
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

if (env.isProduction) {
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
  return metas.map((film) => ({
    id: film.id,
    type: film.type,
    name: film.name,
    poster: film.poster,
  }));
}

/** Recommends a list */
app.get("/recommend", async (_req: Request, res: Response) => {
  const recommendedList = listManager.recommend();
  if (!recommendedList) return res.status(HTTP_CODES.NOT_FOUND).send();
  return res.status(HTTP_CODES.OK).json(recommendedList);
});

/** Redirects to /configure */
app.get("/", (_req: Request, res: Response) => {
  return res.redirect("/configure");
});

/** Redirects to /configure with provided config */
app.get("/:id/configure", (req: Request, res: Response) => {
  const base = !env.isProduction ? "http://localhost:4321/" : "";
  return res.redirect(`${base}/configure?id=${encodeURIComponent(req.params.id)}`);
});

/** Provide a base Manifest.json for Stremio Community and Stremio Unofficial Addons */
app.get("/manifest.json", (_req: Request, res: Response) => {
  const cloned_manifest = { ...manifest };
  cloned_manifest.description =
    "!! Letterboxd requires configuration! Click Configure instead or go to https://letterboxd.almosteffective.com/ !!";
  res.setHeader("Content-Type", "application/json");
  res.json(cloned_manifest);
});

/** Provide a manifest for the provided config. */
app.get("/:providedConfig/manifest.json", async (req: Request, res: Response) => {
  const log = logBase.extend("manifest");
  const { providedConfig } = req.params;
  let cachedConfig: Awaited<ReturnType<typeof prisma.config.findFirstOrThrow>> | undefined;
  try {
    cachedConfig = await prisma.config.findFirstOrThrow({
      where: { id: providedConfig },
    });
  } catch (error) {
    log("No config found for providedConfig", providedConfig);
    log(error);
  }
  const config = parseConfig(cachedConfig ? cachedConfig.config : providedConfig);
  if (!config) {
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json();
  }

  const cloned_manifest = { ...manifest } as ManifestExpanded;
  cloned_manifest.id = `${env.isDev ? "dev-" : ""}com.github.megadrive.letterboxd-watchlist-${config.pathSafe}`;
  cloned_manifest.name = `Letterboxd - ${config.catalogName}`;
  cloned_manifest.description = `Provides a list of films at https://letterboxd.com${config.path} as a catalog.`;
  cloned_manifest.catalogs = [
    {
      id: config.path,
      type: "letterboxd",
      name: config.catalogName,
      extra: [
        { name: "skip", isRequired: false },
      ],
    },
  ];

  return res.json(cloned_manifest);
});

/** Provide the catalog for the provided config. */
app.get("/:providedConfig/catalog/:type/:id/:extra?", async (req: Request, res: Response) => {
  const { providedConfig, type, id, extra } = req.params;
  const parsedExtras = (() => {
    if (!extra) return undefined;
    const rextras = /([A-Za-z]+)=([A-Za-z0-9]+)/g;
    const matched = [...extra.matchAll(rextras)];
    const rv: Record<string, string> = {};
    for (const match of matched) {
      rv[match[1]] = match[2];
    }
    return rv;
  })();
  const log = logBase.extend(`catalog:${id}`);
  let cachedConfig: Awaited<ReturnType<typeof prisma.config.findFirst>> | undefined;
  try {
    cachedConfig = await prisma.config.findFirst({
      where: { id: providedConfig },
    });
    if (!cachedConfig) {
      log(`No config found for ${providedConfig}, using provided config`);
    }
  } catch (error) {
    log(error);
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json({ metas: [] });
  }
  const config = parseConfig(cachedConfig ? cachedConfig.config : providedConfig);
  const username = config.username;

  if (parsedExtras?.letterboxdhead) {
    const metas = await fetchFilms(config.path, { head: true });
    return res.status(HTTP_CODES.OK).json(metas);
  }

  const consoleTime = `[${config.path}] catalog`;
  console.time(consoleTime);

  if (type !== "movie" && type !== "letterboxd") {
    log(`Wrong type: ${type}, giving nothing.`);
    return res.status(HTTP_CODES.BAD_REQUEST).json({ metas: [] });
  }

  try {
    if (!(await doesLetterboxdResourceExist(config.path))) {
      log(`${config.path} doesn't exist`);
      return res.status(HTTP_CODES.NOT_FOUND).send();
    }

    const sCache = lruCache.get(config.pathSafe);
    if (!sCache) {
      log(`No cache found for ${username}`);
    }

    const paginate = (arr: unknown[], skip?: number): unknown[] => {
      const amt = parsedExtras?.skip ? +parsedExtras.skip + 99 : 199;
      let skipAmt = skip ? skip : +(parsedExtras?.skip ?? 0);
      return arr.slice(skipAmt, amt);
    };

    if (sCache) {
      log("serving cached");
      res.setHeader("Content-Type", "application/json");
      let metas: typeof sCache = sCache;
      if (config.posters) {
        log(`Replacing Letterboxd posters for ${config.path}`);
        metas = await replacePosters(sCache);
      }

      console.timeEnd(consoleTime);
      return res.json({
        count: metas.length,
        metas: paginate(metas),
      });
    }

    let films = await fetchFilms(config.path, {
      head: Boolean(parsedExtras?.letterboxdhead),
    });
    films = toStremioMetaPreview(films);
    if (!parsedExtras?.letterboxdhead) {
      lruCache.save(config.pathSafe, films);
    }

    if (config.posters) {
      log(`Replacing Letterboxd posters for ${config.path}`);
      films = await replacePosters(films);
    }

    log(`[${config.path}] serving fresh`);
    log(`[${config.path}] serving ${films.length}`);
    console.timeEnd(consoleTime);
    return res.json({ metas: paginate(films) });
  } catch (error) {
    log(error);
    console.timeEnd(consoleTime);
    return res.json({ metas: [] });
  }
});

/** Get the cached config for the provided config ID. */
app.get("/getConfig/:id", async (req: Request, res: Response) => {
  const log = logBase.extend("getConfig");
  let cachedConfig: Awaited<ReturnType<typeof prisma.config.findFirst>> | undefined;
  try {
    cachedConfig = await prisma.config.findFirst({
      where: { id: req.params.id },
    });
    const config = parseConfig(cachedConfig ? cachedConfig.config : req.params.id);
    return res.json(config);
  } catch (error) {
    log(error);
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).send();
  }
});

/**
 * Verifies and creates a config for the provided string.
 *
 * Base64 encoded JSON.stringified object:
 * {url: string, posters: boolean, base: string, customListName: string}
 */
app.get("/verify/:base64", async (req: Request, res: Response) => {
  const ERROR_CODES = {
    NO_URL: 1,
    NO_BASE: 2,
    BAD_URL: 3,
    CATASTROPHIC: 100,
  } as const;

  type VerifyConfig = {
    url: string;
    base: string;
    posters: boolean;
    customListName: string;
  };

  const log = logBase.extend("verify");
  const base64 = req.params.base64;
  let decoded: string;
  let userConfig: VerifyConfig;

  try {
    decoded = Buffer.from(base64, 'base64').toString('utf-8');
    log({ decoded });
    userConfig = JSON.parse(decoded) as VerifyConfig;
  } catch {
    log("Could not convert base64 to string or convert to userConfig", base64);
    return res
      .status(HTTP_CODES.INTERNAL_SERVER_ERROR)
      .json(`Error code ${ERROR_CODES.CATASTROPHIC}`);
  }

  log("Got userconfig:", userConfig);

  if (!userConfig.url || userConfig.url.length === 0) {
    log("no url in userconfig");
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json(`Error code ${ERROR_CODES.NO_URL}`);
  }

  const whitelistedDomains = ["letterboxd.com", "boxd.it"];
  try {
    if (!whitelistedDomains.includes(new URL(userConfig.url).hostname)) {
      log("URL is not whitelisted");
      throw new Error(`Error code ${ERROR_CODES.BAD_URL}`);
    }
  } catch (error) {
    log("URL is not whitelisted");
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json(`Error code ${ERROR_CODES.BAD_URL}`);
  }

  if (
    !userConfig.url.startsWith("https://letterboxd.com/") &&
    !userConfig.url.startsWith("https://boxd.it/")
  ) {
    log("URL is not a letterboxd url");
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json(`Error code ${ERROR_CODES.BAD_URL}`);
  }

  if (userConfig.url.startsWith("https://boxd.it/")) {
    log("converting boxd.it url");
    try {
      const fetchRes = await fetch(userConfig.url, { redirect: "follow" });
      if (!fetchRes.ok) {
        log(`couldn't resolve boxd.it url`);
        return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json();
      }
      userConfig.url = fetchRes.url;
    } catch (error) {
      log(`couldn't resolve boxd.it url: ${error.message}`);
      return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json(error.message);
    }
  }

  const path = new URL(userConfig.url).pathname;
  const opts = [];
  if (userConfig.posters) opts.push("p");
  if (userConfig?.customListName?.length) {
    opts.push(`cn=${userConfig.customListName}`);
  } else {
    try {
      const nameRes = await fetch(userConfig.url);
      if (!nameRes.ok) throw Error(`Couldn't get URL`);
      const html = await nameRes.text();
      const rogname = /<meta property="og:title" content="(.+)" \/>/;
      const title = rogname.exec(html);
      if (!title || title.length === 1) throw Error(`Couldn't get URL`);
      opts.push(`cn=${title[1]}`);
    } catch (error) {
      log(error.message);
    }
  }

  const unencoded = `${path}${opts.length ? `|${opts.join("|")}` : ""}`;
  const config = encodeURIComponent(unencoded);

  try {
    const catalogUrl = `${userConfig.base}/${encodeURIComponent(config)}/catalog/letterboxd/${encodeURIComponent(path)}/letterboxdhead=1.json`;
    log(`Can get metas? ${catalogUrl}`);
    const fetchRes = await fetch(catalogUrl);
    if (!fetchRes.ok) {
      log(`Couldn't get metas`);
      return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json();
    }
  } catch (error) {
    log(`Couldn't get metas`);
    return res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).json(error.message);
  }

  log("Got metas!");

  userConfig.base = userConfig.base.startsWith("https")
    ? userConfig.base.replace(/https/, "stremio")
    : userConfig.base;

  const cachedConfig = await prisma.config.create({
    data: { config },
  });

  return res
    .status(HTTP_CODES.OK)
    .json(`${userConfig.base}/${cachedConfig.id}/manifest.json`);
});

/**
 * Redirects a Letterboxd poster, setting the Referer header.
 *
 * @todo will be used when letterboxd posters later
 */
app.get("/poster/:letterboxdPath/:letterboxdId", async (req: Request, res: Response) => {
  const { letterboxdPath, letterboxdId } = req.params;
  const poster = await prisma.letterboxdPoster.findFirst({
    where: { letterboxdId },
  });
  if (!poster) {
    return res.status(HTTP_CODES.NOT_FOUND).send();
  }
  res.setHeader("Referer", "https://letterboxd.com/");
  return res.redirect(poster.url);
});

app.listen(PORT, () =>
  console.log(`Stremio-Letterboxd available at http://localhost:${PORT}`)
);
