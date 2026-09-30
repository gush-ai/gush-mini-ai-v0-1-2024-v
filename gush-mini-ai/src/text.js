const STOP = new Set([
  "a","an","the","is","are","was","were","be","been","being","to","of","and","or","in","on",
  "at","for","from","with","as","by","it","this","that","these","those","i","you","he","she",
  "we","they","me","my","your","our","their","what","who","when","where","why","how","do","does",
  "did","can","could","would","should","please","help"
]);

export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text, keepStop = true) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  return keepStop ? tokens : tokens.filter(t => !STOP.has(t) && t.length > 1);
}

export function splitSentences(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 15);
}

export function overlapScore(query, candidate) {
  const q = new Set(tokenize(query, false));
  const c = new Set(tokenize(candidate, false));
  if (!q.size || !c.size) return 0;

  let common = 0;
  for (const token of q) if (c.has(token)) common++;

  const precision = common / c.size;
  const recall = common / q.size;
  const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
  return Number(f1.toFixed(4));
}

export function detectIntent(text) {
  const n = normalize(text);

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(n)) return "greeting";
  if (/\b(write|draft|compose|caption|email|message|post|letter)\b/.test(n)) return "writing";
  if (/\b(summarize|summary|shorten)\b/.test(n)) return "summary";
  if (/^(who|what|where|when|why|how|which)\b/.test(n)) return "question";
  return "general";
}
