# Nano or Cloud?

**Is Gemini Nano good enough for *your* prompt, or do you need the cloud? Stop guessing. Test it.**

Live app: https://nano-or-cloud.web.app (Chrome with Gemini Nano for the on-device side)

Built for the Firebase Hybrid AI Hackathon (Nov 2026) with **Firebase AI Logic hybrid inference** and **App Check**.

## The problem

Every web developer adding AI to a Chrome app hits the same question: can the small on-device model handle my task, or do I pay for cloud calls? Today people guess. Guess "cloud" and you pay for every call and send user data off the device. Guess "Nano" and some answers break in production.

## What it does

One page, four steps:

1. **Task.** Pick a starter (support ticket triage, review sentiment, receipt photo to JSON, Roman Urdu property lead) or write your own: system prompt, optional JSON schema, and 3 to 5 test inputs (text or a JPEG/PNG photo).
2. **Run.** Every input runs twice, side by side: `ONLY_ON_DEVICE` (Gemini Nano) and `ONLY_IN_CLOUD` (Gemini). You see both answers, the time in ms, and the real `inferenceSource` badge from the response.
3. **Grade.** Cloud Gemini grades Nano's answer against the cloud answer (score 1 to 5 with a one-line reason). Plain code also checks the JSON against your schema.
4. **Verdict.** The app recommends `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `PREFER_IN_CLOUD` or `ONLY_IN_CLOUD`, explains why in plain rules (quality, schema pass rate, speed, privacy and offline needs), and gives you the `getGenerativeModel` config to copy into your app.

Two helpers use hybrid inference themselves:
- **Draft 3 inputs** runs `PREFER_ON_DEVICE`: test data is cheap, so it stays on the device when it can.
- **Fix my prompt** runs `PREFER_IN_CLOUD`: rewriting a prompt needs the stronger model, with Nano as the offline fallback.

A real finding from testing: on the Roman Urdu lead task, Nano read "10 marla" as "1 marla". The cloud got it right. That is exactly the kind of failure you want to find before shipping, not after.

## How Firebase is used

| Piece | Where |
|---|---|
| Firebase AI Logic, hybrid inference (`getGenerativeModel` with `mode`, `onDeviceParams`, `inCloudParams`) | `src/hybrid.js` |
| All four `InferenceMode` values | `src/main.js`, `src/helpers.js`, `src/grade.js`, `src/verdict.js` |
| Structured output on both sides: `responseConstraint` on device, `responseJsonSchema` in cloud | `src/hybrid.js` |
| Multimodal input (image) on both sides | `src/hybrid.js`, receipt task |
| `inferenceSource` to show where each answer really ran | `src/hybrid.js` |
| On-device model download with progress (`initializeDeviceModel`) | `src/hybrid.js` |
| App Check with reCAPTCHA Enterprise (Fraud Defense) | `src/firebase.js` |
| Firebase Hosting | `firebase.json` |

Cloud model: `gemini-3.5-flash-lite` through the Gemini Developer API. Free tier.

## Run it yourself

1. Chrome with Gemini Nano. Launch flags used in testing:
   `--enable-features=PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput,OptimizationGuideOnDeviceModel`
2. Create a Firebase project, enable **AI Logic** with the Gemini Developer API, register a web app, and register it in **App Check** with a reCAPTCHA Enterprise site key.
3. `cp .env.example .env.local` and fill in the web config and site key. For localhost, set an App Check debug token.
4. `npm install`, then `npm run dev`. Deploy with `npm run build` and `npx firebase deploy --only hosting`.

## Built during the hackathon

All code in this repo was written during the hackathon period (started 17 Nov 2026), with Claude Code as the coding assistant. No pre-existing code.

## License

Apache-2.0. See `LICENSE`.
