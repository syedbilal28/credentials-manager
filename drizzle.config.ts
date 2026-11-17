import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Neon recommends a direct (non-pooled) connection for migrations. Vercel's
// Neon integration provides it as DATABASE_URL_UNPOOLED.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  throw new Error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED) to run drizzle-kit.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
