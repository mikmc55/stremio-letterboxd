import dotenv from "dotenv";

dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: Number(process.env.PORT),
  ADDON_MAX_PAGES_FETCHED: Number(process.env.ADDON_MAX_PAGES_FETCHED), // Added
} as const;
