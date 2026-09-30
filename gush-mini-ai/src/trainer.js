import { db } from "./db.js";
import { answerLocally } from "./brain.js";
import { overlapScore } from "./text.js";

export function runSelfTest(limit = 20) {
  const examples = db.prepare(`
    SELECT id, input, output, source
    FROM examples
    WHERE source != 'seed'
    ORDER BY RANDOM()
    LIMIT ?
  `).all(limit);

  if (!examples.length) {
    return {
      tested: 0,
      accuracy: 0,
      message: "No non-seed training examples yet. Teach the system or ingest data with the teacher enabled."
    };
  }

  const results = examples.map(ex => {
    const prediction = answerLocally(ex.input);
    const similarity = overlapScore(ex.output, prediction.answer);
    return {
      id: ex.id,
      input: ex.input,
      expected: ex.output,
      predicted: prediction.answer,
      similarity,
      pass: similarity >= 0.45
    };
  });

  const passed = results.filter(r => r.pass).length;
  return {
    tested: results.length,
    passed,
    accuracy: Number((passed / results.length).toFixed(4)),
    results
  };
}
