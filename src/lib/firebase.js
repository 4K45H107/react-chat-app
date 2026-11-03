// Firebase app + Auth only. The login screen needs nothing else, so Firestore
// (src/lib/db.js) and Storage (src/lib/storage.js) live in their own modules
// and load in a later chunk.
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";

// `npm run dev:emulators` talks to the local Firebase emulators instead of
// the live project.
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

const firebaseConfig = useEmulators
  ? {
      apiKey: "demo-key",
      projectId: "demo-reactchat",
      storageBucket: "demo-reactchat.appspot.com",
    }
  : {
      apiKey: import.meta.env.VITE_API_KEY,
      authDomain: "reactchat-ed5f2.firebaseapp.com",
      projectId: "reactchat-ed5f2",
      storageBucket: "reactchat-ed5f2.appspot.com",
      messagingSenderId: "154253592516",
      appId: "1:154253592516:web:27d64937a8baf2a05e0691",
    };

export const app = initializeApp(firebaseConfig);

// initializeAuth instead of getAuth: the app only uses email/password, so it
// skips the popup/redirect sign-in code that getAuth bundles.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
