import { create } from "zustand";
import { useUserStore } from "./userStore";
import { normalizeUser } from "./normalizeUser";

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,

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

  // Clear active chat when the session ends so the next login starts fresh
  resetChat: () => {
    set({
      chatId: null,
      user: null,
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
    });
  },
}));
