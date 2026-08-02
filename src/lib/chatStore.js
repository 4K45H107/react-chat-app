import { create } from "zustand";
import { useUserStore } from "./userStore";
import { normalizeUser } from "./normalizeUser";

const emptyChatState = {
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
};

export const useChatStore = create((set) => ({
  ...emptyChatState,

  changeChat: (chatId, user) => {
    const currentUser = normalizeUser(useUserStore.getState().currentUser);
    const partner = normalizeUser(user);
    if (!partner || !currentUser) return;

    // blocked is always an array after normalizeUser — safe to call .includes()
    if (partner.blocked.includes(currentUser.id)) {
      set({
        chatId,
        user: partner,
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
      return;
    }

    if (currentUser.blocked.includes(partner.id)) {
      set({
        chatId,
        user: partner,
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
      return;
    }

    set({
      chatId,
      user: partner,
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
    });
  },

  changeBlock: () => {
    set((state) => ({
      ...state,
      isReceiverBlocked: !state.isReceiverBlocked,
    }));
  },

  // Leave the active chat (mobile back) or clear on logout
  closeChat: () => set(emptyChatState),

  resetChat: () => set(emptyChatState),
}));
