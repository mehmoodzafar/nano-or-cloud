// Firebase setup: app, App Check, and Firebase AI Logic.
// The web config below is public by design (it identifies the project, it is not a secret).
// App Check is what stops other sites from using this project's AI quota.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// True once the Firebase project is wired in (.env.local). Until then only Nano runs.
export const cloudConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.appId);

export const app = initializeApp(cloudConfigured ? firebaseConfig : { apiKey: 'not-set', appId: 'not-set', projectId: 'not-set' });

// On localhost, App Check uses a debug token (printed in the console the first time;
// register it in Firebase console > App Check > Manage debug tokens).
// On the hosted site, App Check uses Fraud Defense (reCAPTCHA Enterprise). Classic v3 is deprecated and locked in the console (23 Nov 2026).
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if (isLocal) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
}

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY || 'missing-site-key'),
  isTokenAutoRefreshEnabled: true,
});

export const ai = getAI(app, { backend: new GoogleAIBackend() });
