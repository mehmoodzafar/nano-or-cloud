// Small wrapper around Firebase AI Logic hybrid inference.
// One place decides, per task, whether it may leave the device.
import { getGenerativeModel, InferenceMode, InferenceSource } from 'firebase/ai';
import { ai } from './firebase.js';

export { InferenceMode, InferenceSource };

const CLOUD_MODEL = 'gemini-3.5-flash-lite';

/**
 * Build a hybrid model for one task.
 * @param {object} o
 * @param {string} o.mode      one of InferenceMode.*
 * @param {string} [o.system]  system instruction (sent to both sides)
 * @param {object} [o.schema]  JSON Schema for structured output (both sides)
 * @param {boolean} [o.image]  task may include a JPEG/PNG image
 */
export function makeModel({ mode, system, schema, image = false }) {
  const expectedInputs = [{ type: 'text', languages: ['en'] }];
  if (image) expectedInputs.push({ type: 'image' });

  const onDeviceParams = {
    createOptions: {
      expectedInputs,
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    },
  };
  if (system) {
    onDeviceParams.createOptions.initialPrompts = [
      { role: 'system', content: [{ type: 'text', value: system }] },
    ];
  }
  if (schema) onDeviceParams.promptOptions = { responseConstraint: schema };

  const inCloudParams = { model: CLOUD_MODEL };
  if (system) inCloudParams.systemInstruction = system;
  if (schema) {
    inCloudParams.generationConfig = {
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
    };
  }

  return getGenerativeModel(ai, { mode, onDeviceParams, inCloudParams });
}

/** Turn a File (JPEG/PNG) into an inline-data part. */
export async function imagePart(file) {
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return { inlineData: { data: b64, mimeType: file.type } };
}

/**
 * Run one request and report where it ran and how long it took.
 * @returns {Promise<{text: string, json: any, source: string, ms: number}>}
 */
export async function run(model, parts) {
  const t0 = performance.now();
  const result = await model.generateContent(parts);
  const ms = Math.round(performance.now() - t0);
  const text = result.response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* plain text answer */ }
  return { text, json, source: result.response.inferenceSource || 'unknown', ms };
}

/** Is Gemini Nano usable in this browser? 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'no-api' */
export async function nanoStatus() {
  if (!('LanguageModel' in self)) return 'no-api';
  try {
    return await self.LanguageModel.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  } catch {
    return 'unavailable';
  }
}

/** Start the Nano download (must follow a user click). onProgress gets 0..100. */
export function downloadNano(model, onProgress) {
  return model.initializeDeviceModel((v) => onProgress(Math.round(v * 10000) / 100));
}
