import fetch from "cross-fetch";
import name_to_imdb from "name-to-imdb";
import { promisify } from "util";
import { load as cheerio } from "cheerio";
const nameToImdb = promisify(name_to_imdb);

const Watchlist_URL = (username: string) =>
  `https://letterboxd.com/${username}/watchlist`;

type Movie = {
  name: string;
  id: string;
};

async function get_imdb_id(film_name: string): Promise<Movie> {
  const id = await nameToImdb(film_name);
  return {
    id,
    name: film_name,
  };
}

async function names_to_imdb_id(film_names: string[]): Promise<Movie[]> {
  return Promise.all(film_names.map(get_imdb_id));
}

export async function watchlist_fetcher(username: string): Promise<Movie[]> {
  const rawHtml = await (await fetch(Watchlist_URL(username))).text();
  const $ = cheerio(rawHtml);

  const filmSlugs = $(".poster")
    .map(function () {
      return $(this).data().filmSlug;
    })
    .toArray() as string[];

  const films = filmSlugs.map((slug) => slug.replace(/-/g, " "));

  const finished_result = await names_to_imdb_id(films);

  console.log(finished_result);

  return finished_result;
}
