import { config as dotenvConfig } from "dotenv";

// Load environment variables from a .env file
dotenvConfig();

// Define and export an environment object with type annotations
export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV === 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DB_URI: process.env.DB_URI || '',
  // Add other environment variables as needed
};
