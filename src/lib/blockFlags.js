import { normalizeUser } from "./normalizeUser";

/**
 * Derive block flags used by the chat store when opening a conversation.
 * @param {import("../types").AppUser|null|undefined} currentUser
 * @param {import("../types").AppUser|null|undefined} partner
 * @returns {{ isCurrentUserBlocked: boolean, isReceiverBlocked: boolean }}
 */
export const getBlockFlags = (currentUser, partner) => {
  const me = normalizeUser(currentUser);
  const them = normalizeUser(partner);

  if (!me || !them) {
    return { isCurrentUserBlocked: false, isReceiverBlocked: false };
  }

  if (them.blocked.includes(me.id)) {
    return { isCurrentUserBlocked: true, isReceiverBlocked: false };
  }

  if (me.blocked.includes(them.id)) {
    return { isCurrentUserBlocked: false, isReceiverBlocked: true };
  }

  return { isCurrentUserBlocked: false, isReceiverBlocked: false };
};
