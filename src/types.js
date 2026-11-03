/**
 * Core app typedefs (JSDoc). Import with `import("./types").AppUser` etc.
 *
 * @typedef {Object} AppUser
 * @property {string} id
 * @property {string} [username]
 * @property {string} [avatar]
 * @property {string[]} blocked
 * @property {import("firebase/firestore").Timestamp|Date|null} [lastActive]
 *
 * Sidebar item: a chat as the current user sees it.
 * @typedef {Object} ChatMeta
 * @property {string} chatId
 * @property {string} [receiverId]
 * @property {boolean} [isGroup]
 * @property {string} [groupName]
 * @property {string} [groupAvatar]
 * @property {string} lastMessage Preview text
 * @property {boolean} isSeen
 * @property {number} updatedAt Milliseconds
 * @property {boolean} [muted]
 * @property {boolean} [archived]
 * @property {AppUser} [user]
 * @property {AppUser[]} [members]
 * @property {string[]} [participantIds]
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} senderId
 * @property {string} text
 * @property {string} [img]
 * @property {string} [audio]
 * @property {number} [audioDuration]
 * @property {{ type: "voice"|"video", status: string, callId: string, durationSec?: number }} [call]
 * @property {boolean} [deleted]
 * @property {boolean} [edited]
 * @property {import("firebase/firestore").Timestamp|Date|null} [editedAt]
 * @property {import("firebase/firestore").Timestamp|Date|null} [createdAt]
 *
 * Shared chat document: chats/{chatId}. Direct chat ids are "<uidA>_<uidB>"
 * with the two ids sorted.
 * @typedef {Object} ChatDoc
 * @property {"direct"|"group"} type
 * @property {string[]} participantIds
 * @property {string} createdBy
 * @property {string} [name]
 * @property {string} [avatar]
 * @property {import("firebase/firestore").Timestamp|Date|null} createdAt
 * @property {import("firebase/firestore").Timestamp|Date|null} updatedAt Time of the newest message
 * @property {{ text: string, senderId: string }} [lastMessage]
 * @property {Record<string, import("firebase/firestore").Timestamp>} readAt Each member's read marker
 * @property {{ userId?: string|null, updatedAt?: number }} [typing]
 *
 * Private settings: userChats/{uid}
 * @typedef {Object} UserChatPrefs
 * @property {Record<string, { muted?: boolean, archived?: boolean }>} prefs
 */

export {};
