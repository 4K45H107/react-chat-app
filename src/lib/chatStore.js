import { create } from "zustand";
import { useUserStore } from "./userStore";
import { normalizeUser } from "./normalizeUser";

const emptyChatState = {
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
  showDetails: false,
};

export const useChatStore = create((set) => ({
  ...emptyChatState,

  changeChat: (chatId, user) => {
    const currentUser = normalizeUser(useUserStore.getState().currentUser);
    const partner = normalizeUser(user);
    if (!partner || !currentUser) return;

    // Selecting a chat opens the conversation only — details stays closed
    // until the user toggles it from the chat header.
    const next = {
      chatId,
      user: partner,
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
      showDetails: false,
    };

    // blocked is always an array after normalizeUser — safe to call .includes()
    if (partner.blocked.includes(currentUser.id)) {
      set({
        ...next,
        isCurrentUserBlocked: true,
      });
      return;
    }

    if (currentUser.blocked.includes(partner.id)) {
      set({
        ...next,
        isReceiverBlocked: true,
      });
      return;
    }

    set(next);
  },

  changeBlock: () => {
    set((state) => ({
      ...state,
      isReceiverBlocked: !state.isReceiverBlocked,
    }));
  },

  toggleDetails: () => {
    set((state) => ({
      ...state,
      showDetails: !state.showDetails,
    }));
  },

  // Leave the active chat (mobile back) or clear on logout
  closeChat: () => set(emptyChatState),

  resetChat: () => set(emptyChatState),
}));
