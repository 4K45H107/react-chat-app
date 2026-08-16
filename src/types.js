/**
 * Core app typedefs (JSDoc). Import with `import("./types").AppUser` etc.
 *
 * @typedef {Object} AppUser
 * @property {string} id
 * @property {string} [username]
 * @property {string} [email]
 * @property {string} [avatar]
 * @property {string[]} blocked
 * @property {import("firebase/firestore").Timestamp|Date|null} [lastActive]
 *
 * @typedef {Object} ChatMeta
 * @property {string} chatId
 * @property {string} [receiverId]
 * @property {boolean} [isGroup]
 * @property {string} [groupName]
 * @property {string} [groupAvatar]
 * @property {string} lastMessage
 * @property {boolean} isSeen
 * @property {number} updatedAt
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
 * @typedef {Object} ChatDoc
 * @property {string[]} participantIds
 * @property {"direct"|"group"} [type]
 * @property {string} [name]
 * @property {string} [avatar]
 * @property {string} [createdBy]
 * @property {import("firebase/firestore").Timestamp|Date|null} [createdAt]
 * @property {{ userId?: string|null, updatedAt?: number }} [typing]
 * @property {ChatMessage[]} [messages] Legacy array (migrated on open)
 */

export {};
