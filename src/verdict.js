// Turns measured results into a recommended inference mode. Plain rules, shown to the user.
import { InferenceMode } from './hybrid.js';

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * @param rows  [{ nano: {ms, ok, schemaErrs}, cloud: {ms, ok, schemaErrs}, grade: {score} }]
 * @param needs { privacy: boolean, offline: boolean }
 */
export function decide(rows, needs) {
  const scored = rows.filter((r) => r.grade && r.grade.score > 0);
  const avg = scored.length ? scored.reduce((a, r) => a + r.grade.score, 0) / scored.length : null;
  const nanoRan = rows.filter((r) => r.nano?.ok);
  const schemaPass = nanoRan.length ? nanoRan.filter((r) => !r.nano.schemaErrs.length).length / nanoRan.length : null;
  const stats = {
    avg: avg === null ? null : Math.round(avg * 10) / 10,
    schemaPass,
    nanoMs: median(rows.map((r) => r.nano?.ms)),
    cloudMs: median(rows.map((r) => r.cloud?.ms)),
    n: rows.length,
  };

  if (!nanoRan.length) {
    return { mode: null, stats, why: ['Nano did not run in this browser, so there is nothing to compare. Turn on Gemini Nano (see the setup box) and run again.'] };
  }
  if (avg === null) {
    return { mode: null, stats, why: ['The cloud side did not answer, so Nano could not be graded. Check your connection and run again.'] };
  }

  const good = avg >= 4 && schemaPass === 1;
  const okish = avg >= 3;
  const why = [];
  let mode;

  if (needs.privacy) {
    mode = InferenceMode.ONLY_ON_DEVICE;
    why.push('You said this data must not leave the device, so cloud fallback is not allowed.');
    if (!good) why.push(`Warning: Nano scored ${stats.avg}/5 here. Improve the prompt or schema before you ship, or users get weak answers.`);
    why.push('Users without Gemini Nano will get an error. Show them a clear "not supported on this device" message.');
  } else if (good) {
    mode = InferenceMode.PREFER_ON_DEVICE;
    why.push(`Nano matched the cloud (${stats.avg}/5, valid JSON every time). Run it on-device: free, private, works offline.`);
    why.push('Users without Nano fall back to the cloud automatically.');
  } else if (okish && needs.offline) {
    mode = InferenceMode.PREFER_ON_DEVICE;
    why.push(`Nano is usable (${stats.avg}/5) and you need offline, so on-device first.`);
    why.push('Expect some answers to be weaker than the cloud.');
  } else if (needs.offline) {
    mode = InferenceMode.PREFER_IN_CLOUD;
    why.push(`Nano is weak on this task (${stats.avg}/5). Use the cloud when online.`);
    why.push('When offline, Nano is still a better answer than none.');
  } else if (okish) {
    mode = InferenceMode.PREFER_IN_CLOUD;
    why.push(`Nano is close but not there (${stats.avg}/5). Cloud first gives better answers; Nano covers outages.`);
  } else {
    mode = InferenceMode.ONLY_IN_CLOUD;
    why.push(`Nano is not good enough for this task (${stats.avg}/5). Use the cloud only.`);
  }
  if (schemaPass !== null && schemaPass < 1) why.push(`Nano broke the JSON schema in ${Math.round((1 - schemaPass) * 100)}% of runs.`);
  return { mode, stats, why };
}

/** The config snippet a developer can copy. */
export function configSnippet(mode, task) {
  const name = Object.entries(InferenceMode).find(([, v]) => v === mode)?.[0] || 'PREFER_ON_DEVICE';
  const schema = task.schema ? JSON.stringify(task.schema, null, 2).replace(/\n/g, '\n      ') : null;
  const sys = JSON.stringify(task.system || '');
  return `import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';

const ai = getAI(app, { backend: new GoogleAIBackend() });
${schema ? `const schema = ${schema.replace(/\n {6}/g, '\n')};\n` : ''}
const model = getGenerativeModel(ai, {
  mode: InferenceMode.${name},
  onDeviceParams: {
    createOptions: {
      initialPrompts: [{ role: 'system', content: [{ type: 'text', value: ${sys} }] }],
    },${schema ? `\n    promptOptions: { responseConstraint: schema },` : ''}
  },
  inCloudParams: {
    model: 'gemini-3.5-flash-lite',
    systemInstruction: ${sys},${schema ? `\n    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },` : ''}
  },
});

const result = await model.generateContent(userInput);
console.log(result.response.inferenceSource); // 'on_device' or 'in_cloud'`;
}
