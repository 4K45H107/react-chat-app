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
 * @property {string} receiverId
 * @property {string} lastMessage
 * @property {boolean} isSeen
 * @property {number} updatedAt
 * @property {boolean} [muted]
 * @property {boolean} [archived]
 * @property {AppUser} [user]
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} senderId
 * @property {string} text
 * @property {string} [img]
 * @property {boolean} [deleted]
 * @property {boolean} [edited]
 * @property {import("firebase/firestore").Timestamp|Date|null} [editedAt]
 * @property {import("firebase/firestore").Timestamp|Date|null} [createdAt]
 *
 * @typedef {Object} ChatDoc
 * @property {string[]} participantIds
 * @property {import("firebase/firestore").Timestamp|Date|null} [createdAt]
 * @property {Record<string, number>} [typing]
 * @property {ChatMessage[]} [messages] Legacy array (migrated on open)
 */

export {};
