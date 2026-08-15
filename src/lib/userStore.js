import { doc, getDoc } from "firebase/firestore";
import { create } from "zustand";
import { db } from "./firebase";
import { normalizeUser } from "./normalizeUser";

/** Ignore overlapping fetchUserInfo results (signup race with onAuthStateChanged). */
let fetchSeq = 0;

export const useUserStore = create((set) => ({
  currentUser: null,
  isLoading: true,

  fetchUserInfo: async (uid) => {
    const seq = ++fetchSeq;

    if (!uid) {
      console.info("[userStore] No auth session — showing login");
      if (seq === fetchSeq) set({ currentUser: null, isLoading: false });
      return;
    }

    // Signup creates Auth before the users/{uid} doc exists; retry briefly.
    const maxAttempts = 8;
    const retryDelayMs = 250;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (seq !== fetchSeq) return;

        if (docSnap.exists()) {
          console.info("[userStore] User profile loaded:", uid);
          set({
            currentUser: normalizeUser(docSnap.data()),
            isLoading: false,
          });
          return;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }

        console.warn(
          "[userStore] Auth user exists but Firestore doc missing:",
          uid
        );
        set({ currentUser: null, isLoading: false });
      } catch (error) {
        if (seq !== fetchSeq) return;
        console.error(
          "[userStore] Failed to fetch user profile:",
          error.code,
          error.message,
          error
        );
        set({ currentUser: null, isLoading: false });
        return;
      }
    }
  },
}));
