import { db } from "./db.js";
import { detectIntent, overlapScore, tokenize } from "./text.js";

function findBestExample(query) {
  const rows = db.prepare(`
    SELECT id, input, output, topic, source, quality
    FROM examples
    ORDER BY quality DESC, id DESC
    LIMIT 500
  `).all();

  let best = null;
  for (const row of rows) {
    const score = overlapScore(query, row.input) * Number(row.quality || 0.7);
    if (!best || score > best.score) best = { ...row, score };
  }
  return best;
}

function findKnowledge(query) {
  const keywords = tokenize(query, false).slice(0, 10);
  if (!keywords.length) return [];

  const rows = db.prepare(`
    SELECT text, source
    FROM sentences
    ORDER BY id DESC
    LIMIT 3000
  `).all();

  return rows
    .map(row => ({ ...row, score: overlapScore(query, row.text) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function localWriter(prompt, knowledge) {
  const cleaned = prompt
    .replace(/\b(help me|please|can you|could you)\b/gi, "")
    .replace(/\b(write|draft|compose)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const context = knowledge.map(k => k.text).slice(0, 2).join(" ");
  const topic = cleaned || "your topic";

  if (context) {
    return `Here is a simple draft about ${topic}:\n\n${context}\n\nYou can teach me examples of the tone you prefer, and I will reuse those patterns locally.`;
  }

  return `I can draft this locally, but my writing brain is still small. Topic: ${topic}. Add a few facts or teach me an example first, then I can produce a better local draft without an external model.`;
}

export function answerLocally(message) {
  const intent = detectIntent(message);
  const example = findBestExample(message);
  const knowledge = findKnowledge(message);

  if (intent === "writing") {
    return {
      answer: localWriter(message, knowledge),
      confidence: knowledge.length ? Math.min(0.8, 0.45 + knowledge[0].score) : 0.35,
      source: knowledge.length ? "local-writing+knowledge" : "local-writing",
      intent,
      evidence: knowledge
    };
  }

  if (example && example.score >= 0.72) {
    return {
      answer: example.output,
      confidence: Math.min(0.99, example.score),
      source: `example:${example.source}`,
      intent,
      evidence: []
    };
  }

  if (knowledge.length && knowledge[0].score >= 0.2) {
    const selected = knowledge.slice(0, 3).map(k => k.text);
    return {
      answer: selected.join(" "),
      confidence: Math.min(0.9, 0.35 + knowledge[0].score),
      source: "local-knowledge",
      intent,
      evidence: knowledge
    };
  }

  if (example && example.score >= 0.25) {
    return {
      answer: example.output,
      confidence: Math.min(0.65, 0.25 + example.score),
      source: `weak-example:${example.source}`,
      intent,
      evidence: []
    };
  }

  return {
    answer: "I do not know enough about that yet. Teach me the answer or ingest trusted material, and I will store it for future local use.",
    confidence: 0.08,
    source: "unknown",
    intent,
    evidence: []
  };
}

export function getStats() {
  const one = sql => db.prepare(sql).get().n;
  return {
    documents: one("SELECT COUNT(*) AS n FROM documents"),
    sentences: one("SELECT COUNT(*) AS n FROM sentences"),
    examples: one("SELECT COUNT(*) AS n FROM examples"),
    vocabulary: one("SELECT COUNT(*) AS n FROM token_counts"),
    bigrams: one("SELECT COUNT(*) AS n FROM bigrams"),
    conversations: one("SELECT COUNT(*) AS n FROM conversations"),
    teacher: process.env.TEACHER_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY)
  };
}
