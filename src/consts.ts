export const HTTP_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  NO_CONTENT: 204, // Added NO_CONTENT code
};

export interface StremioMetaPreview {
  id: string;
  type: string;
  name: string;
  poster: string;
}

export interface StremioMeta {
  id: string;
  type: string;
  name: string;
  poster: string;
  [key: string]: any; // Allow other properties for flexibility
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: Number(process.env.PORT),
  ADDON_MAX_PAGES_FETCHED: Number(process.env.ADDON_MAX_PAGES_FETCHED), // Added
} as const;
