import { LetterboxdRegex } from "./consts.js";
import { env } from "./env.js";

// Generates a URL for a given path with optional pagination and AJAX request handling
export const generateURL = (path: string, page = 1, isAjaxRequest = false): string => {
  let split = path.replace(/\/+/g, "/").split("/");
  if (isAjaxRequest) {
    split = [split[1], "ajax", ...split.slice(2)];
  }
  return `https://letterboxd.com/${split.join("/")}/page/${page}`;
};

// Checks if a Letterboxd resource exists by sending a request to the generated URL
export async function doesLetterboxdResourceExist(path: string): Promise<boolean> {
  try {
    const generatedURL = generateURL(path);
    const res = await fetch(generatedURL);
    if (res.ok) return true;
    throw new Error(res.statusText);
  } catch (error) {
    console.warn(`Couldn't determine if ${path} exists: ${error.message}`);
    return false;
  }
}

// Parses a Letterboxd URL to extract the ID using a regex pattern
export const parseLetterboxdURLToID = (url: string): string => {
  console.log(`Parsing URL: ${url}`);
  const match = LetterboxdRegex.exec(url);
  if (!match) return "";
  const username = match[2];
  const listId = match[4];
  return `${username}${listId ? `|${listId}` : ""}`;
};

// Determines if a given datetime is older than a specified duration
export const isOld = (datetime: Date, howOld: number): boolean => {
  const now = Date.now();
  return now - datetime.getTime() > howOld;
};

// Formats the time difference between two timestamps
export const formatTimeBetween = (
  from: ReturnType<typeof Date.now>,
  to = Date.now()
): string => {
  const seconds = (to - from) / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(0)}m ${seconds % 60}s`;
};

// Utility functions for handling IDs
export const IDUtil = {
  // Splits an ID into components and determines its type
  split: (
    id: string
  ): {
    username: string;
    listId?: string;
    listName: string;
    type: "list" | "watchlist";
  } => {
    const [username, unparsedListId] = id.split("|");
    const [listId] = unparsedListId?.split(",") ?? [];
    console.log({ unparsedListId, listId });
    const listName = listId ? listId.replace(/-/g, " ") : "watchlist";
    return { username, listId, listName, type: listId ? "list" : "watchlist" };
  }
};

// Prepends 'dev' to a string if not in production
export const PrependWithDev = (s: string, separator = "."): string =>
  !env.isProduction ? `dev${separator}${s}` : s;
