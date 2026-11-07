import { defineConfig } from "prisma/config";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Client generation does not need a database. Migration and introspection
  // commands still require DATABASE_URL and will report it when absent.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
