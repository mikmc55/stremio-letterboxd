export const env = cleanEnv(process.env, {
  /** Database URL, must relate to a Prisma-supported database. See /prisma.schema for more info. */
  DATABASE_URL: str(),
  /** Server port to run on. If you deploy this to a service, they'll override this. */
  PORT: num({ default: 3030 }),
  /**
