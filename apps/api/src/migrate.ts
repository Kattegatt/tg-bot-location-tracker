import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config";

const { Pool } = pg;

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const defaultMigrationsDir = path.resolve(currentDir, "../../../db/migrations");
const migrationsDir = process.env.MIGRATIONS_DIR || defaultMigrationsDir;

async function run() {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(
      `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
      `
    );

    const applied = await client.query("SELECT filename FROM schema_migrations");
    const appliedSet = new Set(applied.rows.map((row: { filename: string }) => row.filename));

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Migration failed", error);
  process.exit(1);
});
