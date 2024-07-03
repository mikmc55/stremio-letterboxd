import { LetterboxdRegex } from "./consts.js";
import { env } from "./env.js";

export const generateURL = (path: string, page = 1, isAjaxRequest = false) => {
  let split = path.replace(/\/+/g, "/").split("/");
  if (isAjaxRequest) {
    split = [split[1], "ajax", ...split.slice(2)];
  }
  return `https://letterboxd.com/${split.join("/")}/page/${page}`;
};

export async function doesLetterboxdResourceExist(path: string) {
  try {
    const generatedURL = generateURL(path);
    const res = await fetch(generatedURL);
    if (res.ok) return true;
    throw new Error(res.statusText);
  } catch (error) {
    console.warn(`Couldn't determine if ${path} exists: ${error.message}`);
  }
  return false;
}

export const parseLetterboxdURLToID = (url: string) => {
  console.log(`testing ${url}`);
  const match = LetterboxdRegex.exec(url);
  if (!match) return "";
  const username = match[2];
  const listid = match[4];
  return `${username}${listid ? `|${listid}` : ""}`;
};

export const isOld = (datetime: Date, howOld: number): boolean => {
  const rv = Date.now() - datetime.getTime() > howOld;
  return rv;
};

export const formatTimeBetween = (
  from: ReturnType<(typeof Date)["now"]>,
  to = Date.now(),
) => {
  const seconds = (to - from) / 1000;
  if (seconds < 60) {
    return `${(to - from) / 1000}s`;
  }
  const minutes = seconds / 60;
  return `${minutes}m ${seconds}s`;
};

export const IDUtil = {
  split: (
    id: string,
  ): {
    username: string;
    listId?: string;
    listName: string;
    type: "list" | "watchlist";
  } => {
    const [username, unparsedListId] = id.split("|");
    const [listId] = unparsedListId?.split(",") ?? "";
    console.log({ unparsedListId, listId });
    const listName = listId ? `${listId.replace(/-/g, " ")}` : "watchlist";
    return { username, listId, listName, type: listId ? "list" : "watchlist" };
  },
};

export const PrependWithDev = (s: string, seperator = ".") =>
  !env.isProduction ? `dev${seperator}${s}` : s;
