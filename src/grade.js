// The grader: a cloud Gemini call that compares Nano's answer with the cloud answer.
// Only the grader needs the bigger model, so it is pinned to ONLY_IN_CLOUD.
import { makeModel, run, imagePart, InferenceMode } from './hybrid.js';

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 5 },
    verdict: { type: 'string', enum: ['match', 'minor_diff', 'partly_wrong', 'wrong'] },
    reason: { type: 'string' },
  },
  required: ['score', 'verdict', 'reason'],
};

const GRADER_SYSTEM = `You grade answers from a small on-device model (CANDIDATE) against a larger cloud model (REFERENCE) on the same task and input.
Score 5 = same meaning, every field correct. 4 = only wording differs. 3 = one field wrong or missing. 2 = several errors. 1 = wrong or unusable.
If the REFERENCE is itself wrong, judge the CANDIDATE against the input directly. Keep "reason" under 20 words and name the wrong field if any.`;

let grader;

export async function grade({ task, input, nanoText, cloudText }) {
  grader ??= makeModel({ mode: InferenceMode.ONLY_IN_CLOUD, system: GRADER_SYSTEM, schema: GRADE_SCHEMA, image: true });
  const prompt = `TASK INSTRUCTIONS:\n${task.system}\n\nINPUT:\n${input.text}\n\nREFERENCE (cloud):\n${cloudText}\n\nCANDIDATE (on-device):\n${nanoText}`;
  const parts = input.file ? [prompt, await imagePart(input.file)] : prompt;
  const r = await run(grader, parts);
  return r.json || { score: 0, verdict: 'wrong', reason: 'grader returned no JSON' };
}
