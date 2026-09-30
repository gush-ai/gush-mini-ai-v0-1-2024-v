import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, db } from "./src/db.js";
import { answerLocally, getStats } from "./src/brain.js";
import { ingestText, ingestUrl } from "./src/ingest.js";
import { createTrainingExamplesWithTeacher, teacherStatus } from "./src/teacher.js";
import { runSelfTest } from "./src/trainer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initDb();

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: process.env.APP_NAME || "Gush Mini AI",
    teacher: teacherStatus()
  });
});

app.get("/api/stats", (req, res) => {
  res.json(getStats());
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });

    const result = answerLocally(message);

    db.prepare(`
      INSERT INTO conversations (user_text, assistant_text, confidence, source)
      VALUES (?, ?, ?, ?)
    `).run(message, result.answer, result.confidence, result.source);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ingest/text", async (req, res) => {
  try {
    const title = String(req.body?.title || "Manual text").trim();
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "text is required" });

    const local = ingestText({ title, text, source: "manual" });

    let teacher = null;
    if (req.body?.useTeacher === true) {
      teacher = await createTrainingExamplesWithTeacher(text, title);
    }

    res.json({ ok: true, local, teacher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ingest/url", async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "url is required" });

    const result = await ingestUrl(url);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/teach", async (req, res) => {
  try {
    const input = String(req.body?.input || "").trim();
    const output = String(req.body?.output || "").trim();
    if (!input || !output) {
      return res.status(400).json({ error: "input and output are required" });
    }

    db.prepare(`
      INSERT INTO examples (input, output, topic, source, quality)
      VALUES (?, ?, ?, ?, ?)
    `).run(input, output, String(req.body?.topic || ""), "human", 1);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/self-test", (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit || 20), 1), 200);
    res.json(runSelfTest(limit));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(Number(process.env.PORT || 3030), () => {
  console.log(`${process.env.APP_NAME || "Gush Mini AI"} running on http://localhost:${process.env.PORT || 3030}`);
});
