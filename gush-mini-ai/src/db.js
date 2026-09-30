import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "data", "brain.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      text TEXT NOT NULL,
      normalized TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      topic TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'local',
      quality REAL NOT NULL DEFAULT 0.7,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS token_counts (
      token TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bigrams (
      left_token TEXT NOT NULL,
      right_token TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(left_token, right_token)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_text TEXT NOT NULL,
      assistant_text TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sentences_normalized ON sentences(normalized);
    CREATE INDEX IF NOT EXISTS idx_examples_input ON examples(input);
  `);

  const count = db.prepare("SELECT COUNT(*) AS n FROM examples").get().n;
  if (count === 0) {
    const add = db.prepare(`
      INSERT INTO examples (input, output, topic, source, quality)
      VALUES (?, ?, ?, ?, ?)
    `);
    const seed = [
      ["hello", "Hello. I am Gush Mini AI. I am still learning, but I can answer from my local knowledge.", "greeting", "seed", 1],
      ["who are you", "I am Gush Mini AI, a small local learning system built in JavaScript.", "identity", "seed", 1],
      ["what can you do", "I can learn from text, retrieve related knowledge, remember training examples, and improve as more trusted material is added.", "identity", "seed", 1],
      ["help me write", "I can help with short local drafts. Tell me what you want to write and the key points you want included.", "writing", "seed", 1]
    ];
    const tx = db.transaction(rows => rows.forEach(r => add.run(...r)));
    tx(seed);
  }
}
