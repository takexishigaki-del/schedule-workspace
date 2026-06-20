import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit は .env.local を自動で読まないため、明示的に読み込む
config({ path: ".env.local" });

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // マイグレーション用には直接接続（non-pooling）を使う
    url: (process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL)!,
  },
} satisfies Config;
