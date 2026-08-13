import { create } from "zustand";
import { useUserStore } from "./userStore";
import { normalizeUser } from "./normalizeUser";
import { getBlockFlags } from "./blockFlags";

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
    const { isCurrentUserBlocked, isReceiverBlocked } = getBlockFlags(
      currentUser,
      partner
    );

    set({
      chatId,
      user: partner,
      isCurrentUserBlocked,
      isReceiverBlocked,
      showDetails: false,
    });
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
