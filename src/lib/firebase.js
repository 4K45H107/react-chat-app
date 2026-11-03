import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// `npm run dev:emulators` talks to the local Firebase emulators instead of
// the live project.
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

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

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: useEmulators
    ? memoryLocalCache()
    : persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
});
export const auth = getAuth(app);
export const storage = getStorage(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
