import { cleanEnv, str, num } from 'envalid';

export const env = cleanEnv(process.env, {
  DATABASE_URL: str(),
  PORT: num({ default: 3030 }),
});
