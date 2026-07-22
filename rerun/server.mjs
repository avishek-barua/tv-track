// Minimal local JSON-file database for RERUN.
// Run with: node server.mjs   (needs: npm install express cors)
import express from "express";
import cors from "cors";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const DB_PATH = path.join(process.cwd(), "db.json");
const DEFAULT_DATA = { shows: {}, watchedLog: {}, movies: {} };

async function readDb() {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf-8"));
  } catch (e) {
    return DEFAULT_DATA;
  }
}

app.get("/api/data", async (req, res) => {
  res.json(await readDb());
});

app.post("/api/data", async (req, res) => {
  try {
    await writeFile(DB_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`RERUN db server → http://localhost:${PORT}  (writing to ${DB_PATH})`));
