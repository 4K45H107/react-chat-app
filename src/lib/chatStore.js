import { create } from "zustand";
import { useUserStore } from "./userStore";

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,

  changeChat: (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;
    if (!user || !currentUser) return;

    const theirBlockedList = user.blocked ?? [];
    const myBlockedList = currentUser.blocked ?? [];

    // Receiver blocked the current user — keep user for the header, flag blocks sending
    if (theirBlockedList.includes(currentUser.id)) {
      set({
        chatId,
        user,
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
      return;
    }

    // Current user blocked the receiver — show chat read-only from their side
    if (myBlockedList.includes(user.id)) {
      set({
        chatId,
        user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
      return;
    }

    set({
      chatId,
      user,
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
