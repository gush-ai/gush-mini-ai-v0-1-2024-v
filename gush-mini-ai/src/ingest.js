import dns from "node:dns/promises";
import net from "node:net";
import { db } from "./db.js";
import { normalize, splitSentences, tokenize } from "./text.js";

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return false;
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

async function assertPublicUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed.");
  }
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(r => isPrivateIp(r.address))) {
    throw new Error("Private/local network URLs are blocked.");
  }
  return url;
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function learnTokens(text) {
  const tokens = tokenize(text, true);
  const upsertToken = db.prepare(`
    INSERT INTO token_counts (token, count) VALUES (?, 1)
    ON CONFLICT(token) DO UPDATE SET count = count + 1
  `);
  const upsertBigram = db.prepare(`
    INSERT INTO bigrams (left_token, right_token, count) VALUES (?, ?, 1)
    ON CONFLICT(left_token, right_token) DO UPDATE SET count = count + 1
  `);

  const tx = db.transaction(() => {
    for (let i = 0; i < tokens.length; i++) {
      upsertToken.run(tokens[i]);
      if (i < tokens.length - 1) upsertBigram.run(tokens[i], tokens[i + 1]);
    }
  });
  tx();

  return tokens.length;
}

export function ingestText({ title, text, source = "manual", sourceUrl = null }) {
  const insertDoc = db.prepare(`
    INSERT INTO documents (title, source, source_url, content)
    VALUES (?, ?, ?, ?)
  `);
  const doc = insertDoc.run(title, source, sourceUrl, text);

  const sentences = splitSentences(text).slice(0, 5000);
  const insertSentence = db.prepare(`
    INSERT INTO sentences (document_id, text, normalized, source)
    VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(rows => {
    for (const s of rows) insertSentence.run(doc.lastInsertRowid, s, normalize(s), source);
  });
  tx(sentences);

  const tokensLearned = learnTokens(text);

  return {
    documentId: Number(doc.lastInsertRowid),
    sentences: sentences.length,
    tokensLearned
  };
}

export async function ingestUrl(rawUrl) {
  const url = await assertPublicUrl(rawUrl);
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "GushMiniAI/0.1 research-ingestor" }
  });

  if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}`);

  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/") && !type.includes("json")) {
    throw new Error(`Unsupported content type: ${type}`);
  }

  const raw = await response.text();
  if (raw.length > 3_000_000) throw new Error("Page is too large for this starter ingestor.");

  const text = type.includes("html") ? htmlToText(raw) : raw;
  const title = url.hostname + url.pathname;

  const local = ingestText({
    title,
    text,
    source: "url",
    sourceUrl: url.toString()
  });

  return { url: url.toString(), title, local };
}
