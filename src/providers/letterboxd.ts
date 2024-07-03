import fetch from "node-fetch";
import { env } from "../env.js";
import { parseLetterboxdURLToID } from "../util.js"; // Ensure this is used or remove if not used

const baseURL = "https://letterboxd.com";

export async function doesLetterboxdResourceExist(url: string): Promise<boolean> {
  const id = parseLetterboxdURLToID(url);
  const response = await fetch(`${baseURL}/film/${id}`);
  return response.ok;
}
