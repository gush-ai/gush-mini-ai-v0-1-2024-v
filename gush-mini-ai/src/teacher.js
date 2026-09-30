import { GoogleGenAI } from "@google/genai";
import { db } from "./db.js";

export function teacherStatus() {
  return {
    enabled: process.env.TEACHER_ENABLED === "true",
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash"
  };
}

function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Teacher did not return a JSON array.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function createTrainingExamplesWithTeacher(text, title = "Untitled") {
  if (process.env.TEACHER_ENABLED !== "true") {
    return { skipped: true, reason: "TEACHER_ENABLED is false" };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { skipped: true, reason: "GEMINI_API_KEY is missing" };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const prompt = `
You are a training-data teacher for a small local AI.
From the trusted source below, create at most 12 factual question/answer examples.
Return ONLY a JSON array.
Each object must contain: input, output, topic.
Do not invent information not present in the source.

TITLE: ${title}

SOURCE:
${String(text).slice(0, 18000)}
  `.trim();

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  const items = extractJson(response.text || "[]");
  const insert = db.prepare(`
    INSERT INTO examples (input, output, topic, source, quality)
    VALUES (?, ?, ?, ?, ?)
  `);

  let saved = 0;
  const tx = db.transaction(() => {
    for (const item of items) {
      if (!item?.input || !item?.output) continue;
      insert.run(
        String(item.input).slice(0, 1000),
        String(item.output).slice(0, 4000),
        String(item.topic || "").slice(0, 200),
        "gemini-teacher",
        0.85
      );
      saved++;
    }
  });
  tx();

  return { skipped: false, generated: items.length, saved };
}
