import * as dotenv from 'dotenv';

// Load environment variables from a .env file
dotenv.config();

// Define and export an environment object with type annotations
export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  dbUri: process.env.DB_URI || '',
  // Add other environment variables as needed
};
