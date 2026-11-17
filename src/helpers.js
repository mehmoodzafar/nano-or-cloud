// Two helpers that use hybrid inference themselves, each with the mode that fits the job.
import { makeModel, run, InferenceMode } from './hybrid.js';

// Drafting a few test inputs is easy and cheap: try Nano first, cloud if Nano is missing.
const DRAFT_SCHEMA = {
  type: 'object',
  properties: { inputs: { type: 'array', items: { type: 'string' } } },
  required: ['inputs'],
};
let drafter;
export async function draftInputs(system) {
  drafter ??= makeModel({
    mode: InferenceMode.PREFER_ON_DEVICE,
    system: 'You write realistic test inputs for an AI task. Return 3 short, varied user messages, including one tricky edge case.',
    schema: DRAFT_SCHEMA,
  });
  const r = await run(drafter, `The AI task instructions are:\n${system}\n\nWrite 3 test inputs.`);
  return { inputs: (r.json?.inputs || []).slice(0, 3).map(String), source: r.source, ms: r.ms };
}

// Rewriting a prompt so a small model can follow it needs the stronger model.
// Prefer cloud, but still work offline with Nano.
const FIX_SCHEMA = {
  type: 'object',
  properties: { prompt: { type: 'string' }, changes: { type: 'string' } },
  required: ['prompt', 'changes'],
};
let fixer;
export async function fixPrompt(task, failures) {
  fixer ??= makeModel({
    mode: InferenceMode.PREFER_IN_CLOUD,
    system: 'You improve system prompts so that a small on-device model (Gemini Nano) gets them right. Small models need: explicit field definitions, one example of correct output, units spelled out, and no ambiguity. Keep the same task and output fields. "changes" = one sentence on what you changed.',
    schema: FIX_SCHEMA,
  });
  const list = failures.map((f, i) => `${i + 1}. Input: ${f.input}\n   Nano said: ${f.nano}\n   Expected (cloud): ${f.cloud}\n   Grader: ${f.reason}`).join('\n');
  const r = await run(fixer, `CURRENT SYSTEM PROMPT:\n${task.system}\n\nOUTPUT SCHEMA:\n${JSON.stringify(task.schema)}\n\nWHERE NANO FAILED:\n${list}\n\nRewrite the system prompt.`);
  return { ...(r.json || { prompt: task.system, changes: 'No change returned.' }), source: r.source, ms: r.ms };
}
