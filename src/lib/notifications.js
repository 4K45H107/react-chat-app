/**
 * Browser Notification API helpers (no FCM yet).
 */

export const canUseNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

/** @returns {Promise<"granted"|"denied"|"default"|"unsupported">} */
export const ensureNotificationPermission = async () => {
  if (!canUseNotifications()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
};

/**
 * Show a chat notification when the tab is hidden or another chat is open.
 * @param {{ title: string, body: string, tag?: string, onClick?: () => void }} options
 */
export const showChatNotification = ({ title, body, tag, onClick }) => {
  if (!canUseNotifications() || Notification.permission !== "granted") {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: "./avatar.png",
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    return notification;
  } catch (error) {
    console.warn("[notifications] Failed to show notification:", error);
    return null;
  }
};

/**
 * Find newly unread chats worth notifying about (skip first hydrate).
 * @param {Array<{ chatId: string, lastMessage?: string, isSeen?: boolean, updatedAt?: number, user?: { username?: string } }>} nextChats
 * @param {Map<string, { updatedAt?: number, lastMessage?: string }>|null} previousById
 * @param {string|null} activeChatId
 */
export const getUnreadNotificationTargets = (
  nextChats,
  previousById,
  activeChatId
) => {
  if (!previousById) return [];

  return nextChats.filter((chat) => {
    if (chat.isSeen || !chat.lastMessage) return false;
    if (chat.chatId === activeChatId) return false;

    const prev = previousById.get(chat.chatId);
    if (!prev) {
      // Brand-new sidebar entry with unread preview
      return true;
    }

    return (
      chat.updatedAt > (prev.updatedAt ?? 0) ||
      chat.lastMessage !== prev.lastMessage
    );
  });
};
