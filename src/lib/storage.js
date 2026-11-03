import { connectStorageEmulator, getStorage } from "firebase/storage";
import { app, useEmulators } from "./firebase";

export const storage = getStorage(app);

if (useEmulators) {
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
