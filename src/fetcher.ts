import { addonFetch } from "./lib/fetch.js";
import { load as cheerio } from "cheerio";
import { prisma } from "./prisma.js";
import {
  type CinemetaMovieResponseLive,
  type StremioMetaPreview,
  type StremioMeta,
  config,
  LetterboxdUsernameOrListRegex,
} from "./consts.js";
import {
  generateURL,
  doesLetterboxdResourceExist,
  isOld,
  formatTimeBetween,
} from "./util.js";
import { find } from "./providers/letterboxd.js";
import { find as findImdb } from "./providers/imdbSuggests.js";
import { logger } from "./logger.js";
import { env } from "./env.js";

const logBase = logger("fetcher");

/** Gets many IMDB ID from films */
async function getImdbIDs(films: string[], userId: string): Promise<string[]> {
  const result = await Promise.all(
    films.map((film) => findImdb(film, userId)),
  );
  return result.filter((id) => id);
}

function getOffset(): number {
  return Math.floor(Math.random() * env.ADDON_MAX_PAGES_FETCHED);
}

export async function fetchFilms(
  path: string,
  { limit, skip, head }: { limit?: number; skip?: number; head?: boolean } = {},
): Promise<StremioMeta[]> {
  if (head) {
    return [];
  }

  const config = await prisma.config.findFirstOrThrow({
    where: {
      id: path,
    },
  });

  const page = getOffset();

  const url = generateURL(config.username, page, skip);
  const response = await addonFetch(url);

  if (!response.ok) {
    logBase(`Failed to fetch ${url}, response code: ${response.status}`);
    throw new Error("Failed to fetch page");
  }

  const body = await response.text();
  const $ = cheerio(body);

  const metas: StremioMeta[] = [];
  $(".poster").each((_, elem) => {
    const posterUrl = $(elem).attr("src") || "";
    const movieId = $(elem).attr("data-id") || "";
    const title = $(elem).attr("alt") || "";
    metas.push({
      id: movieId,
      name: title,
      poster: posterUrl,
      type: "movie",
    });
  });

  return metas.slice(0, limit);
}
