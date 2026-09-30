# Gush Mini AI v0.1

A starter "small brain" written in JavaScript/Node.js.

This is intentionally **not a pretrained LLM**. Version 0.1 gives you the infrastructure we need before adding a true neural language model:

- persistent SQLite memory
- trusted text ingestion
- token and bigram learning
- local question/answer retrieval
- a basic local writing intent
- direct human teaching
- optional Gemini teacher
- local confidence scores
- self-test endpoint
- browser dashboard
- URL ingestion with local/private-network protection

## Requirements

- Node.js 20+
- npm

For production, Node.js 22 LTS is a good target.

## Install

```bash
cp .env.example .env
npm install
npm start
```

Then open:

```text
http://localhost:3030
```

No API key is required for the local brain.

## Optional Gemini teacher

Edit `.env`:

```env
TEACHER_ENABLED=true
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Restart the application.

The teacher does **not** answer normal `/api/chat` requests. Its job is to transform trusted material into training examples that become part of your local dataset.

Turn it off at any time:

```env
TEACHER_ENABLED=false
```

The local database and learned material remain.

## Main APIs

### Chat locally

`POST /api/chat`

```json
{
  "message": "What is the capital of Nigeria?"
}
```

### Teach one example

`POST /api/teach`

```json
{
  "input": "What is the capital of Nigeria?",
  "output": "Abuja is the capital of Nigeria.",
  "topic": "Nigeria"
}
```

### Ingest text

`POST /api/ingest/text`

```json
{
  "title": "Nigeria notes",
  "text": "Nigeria is a country in West Africa...",
  "useTeacher": false
}
```

### Ingest a public webpage

`POST /api/ingest/url`

```json
{
  "url": "https://example.org/article"
}
```

### Self-test

`POST /api/self-test`

```json
{
  "limit": 20
}
```

## Brain database

The first run creates:

```text
data/brain.db
```

Tables:

- `documents`
- `sentences`
- `examples`
- `token_counts`
- `bigrams`
- `conversations`

The SQLite database is the persistent brain/memory for v0.1.

## Current learning model

The local system currently uses:

1. intent detection
2. tokenization
3. word/bigram frequency learning
4. lexical similarity retrieval
5. stored input/output examples
6. confidence scoring

This makes the project useful immediately while keeping CPU/RAM use very small.

It is **not yet** a transformer, and it will not magically gain general reasoning simply by storing millions of webpages.

## Recommended development path

### v0.2 — Better knowledge engine

- FTS5 full-text search
- entities and relationships
- source reliability metadata
- duplicate detection
- timestamps and freshness
- trusted-source approval queue
- RSS ingestion

### v0.3 — Semantic memory

- local embedding model
- vector search
- paragraph/chunk retrieval
- better contextual answers

### v0.4 — Small neural language model

Add a separate model layer:

```text
src/model/
  tokenizer.js
  dataset.js
  train.js
  inference.js
  checkpoints/
```

Train on approved datasets rather than raw unverified web content.

### v0.5 — Teacher/student distillation

The external model can generate or grade examples while the local model learns from the approved results.

Track:

```text
local_answer_rate
teacher_required_rate
self_test_accuracy
unknown_rate
```

The objective is for `local_answer_rate` to rise without sacrificing accuracy.

## Important data rule

Do not automatically treat every webpage as truth.

Use this pipeline:

```text
source
  -> temporary ingestion
  -> validation / licensing check
  -> trusted knowledge
  -> training examples
  -> model training
```

For Wikipedia, news sites, search engines and other third-party sources, follow their licenses, API terms, robots rules and redistribution/training requirements. Prefer official APIs, RSS feeds and datasets rather than scraping search-result pages.

## Why Gemini is optional

The architecture deliberately separates:

```text
TEACHER
   |
   v
TRAINING DATA
   |
   v
LOCAL BRAIN
```

Normal local questions do not call Gemini.

That makes it possible to improve the student, disable the teacher, and measure how much the local system can do by itself.
