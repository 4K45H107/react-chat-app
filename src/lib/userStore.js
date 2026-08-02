import { doc, getDoc } from "firebase/firestore";
import { create } from "zustand";
import { db } from "./firebase";
import { normalizeUser } from "./normalizeUser";

export const useUserStore = create((set) => ({
  currentUser: null,
  isLoading: true,

  fetchUserInfo: async (uid) => {
    if (!uid) {
      console.info("[userStore] No auth session — showing login");
      return set({ currentUser: null, isLoading: false });
    }

    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.info("[userStore] User profile loaded:", uid);
        set({ currentUser: normalizeUser(docSnap.data()), isLoading: false });
      } else {
        console.warn(
          "[userStore] Auth user exists but Firestore doc missing:",
          uid
        );
        set({ currentUser: null, isLoading: false });
      }
    } catch (error) {
      console.error(
        "[userStore] Failed to fetch user profile:",
        error.code,
        error.message,
        error
      );
      set({ currentUser: null, isLoading: false });
    }
  },
}));
