// JSON database for RERUN.
// Locally: writes to db.json on disk (no setup needed).
// In production: if DATABASE_URL is set, stores the same JSON blob in a
// Postgres table instead — needed because free hosts like Render's free web
// service tier have an ephemeral filesystem that gets wiped every time the
// service spins back up from idle, silently losing db.json.
// Run with: node server.mjs   (needs: npm install express cors pg)
import express from "express";
import cors from "cors";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import pg from "pg";

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const DEFAULT_DATA = { shows: {}, watchedLog: {}, movies: {} };
const DB_PATH = path.join(process.cwd(), "db.json");

const usingPg = Boolean(process.env.DATABASE_URL);
let pool = null;

if (usingPg) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // most free Postgres hosts (Neon, Supabase, etc.) require SSL
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rerun_data (
      id INT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
}

async function readDb() {
  if (usingPg) {
    try {
      const { rows } = await pool.query("SELECT data FROM rerun_data WHERE id = 1");
      return rows[0] ? rows[0].data : DEFAULT_DATA;
    } catch (e) {
      console.error("Postgres read failed", e);
      return DEFAULT_DATA;
    }
  }
  try {
    return JSON.parse(await readFile(DB_PATH, "utf-8"));
  } catch (e) {
    return DEFAULT_DATA;
  }
}

async function writeDb(data) {
  if (usingPg) {
    await pool.query(
      `INSERT INTO rerun_data (id, data) VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = $1::jsonb`,
      [JSON.stringify(data)]
    );
    return;
  }
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

app.get("/api/data", async (req, res) => {
  res.json(await readDb());
});

app.post("/api/data", async (req, res) => {
  try {
    await writeDb(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(
  `RERUN db server → :${PORT} (${usingPg ? "Postgres" : `local ${DB_PATH}`})`
));
