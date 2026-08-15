import { create } from "zustand";
import { useUserStore } from "./userStore";
import { normalizeUser } from "./normalizeUser";
import { getBlockFlags } from "./blockFlags";

const emptyChatState = {
  chatId: null,
  user: null,
  isGroup: false,
  groupName: null,
  groupAvatar: null,
  participantIds: [],
  members: [],
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
  showDetails: false,
};

export const useChatStore = create((set) => ({
  ...emptyChatState,

  /**
   * Open a chat.
   * @param {string} chatId
   * @param {import("./types").AppUser | {
   *   isGroup: true,
   *   groupName?: string,
   *   groupAvatar?: string,
   *   participantIds?: string[],
   *   members?: import("./types").AppUser[],
   * }} userOrGroup Partner user (DM) or group payload
   */
  changeChat: (chatId, userOrGroup) => {
    const currentUser = normalizeUser(useUserStore.getState().currentUser);
    if (!currentUser || !chatId) return;

    if (userOrGroup?.isGroup) {
      set({
        chatId,
        user: null,
        isGroup: true,
        groupName: userOrGroup.groupName || "Group",
        groupAvatar: userOrGroup.groupAvatar || null,
        participantIds: userOrGroup.participantIds ?? [],
        members: (userOrGroup.members ?? [])
          .map((member) => normalizeUser(member))
          .filter(Boolean),
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
        showDetails: false,
      });
      return;
    }

    const partner = normalizeUser(userOrGroup);
    if (!partner) return;

    const { isCurrentUserBlocked, isReceiverBlocked } = getBlockFlags(
      currentUser,
      partner
    );

    set({
      chatId,
      user: partner,
      isGroup: false,
      groupName: null,
      groupAvatar: null,
      participantIds: [currentUser.id, partner.id].filter(Boolean),
      members: [partner],
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
