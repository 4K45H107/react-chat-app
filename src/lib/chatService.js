import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";

export const MESSAGE_PAGE_SIZE = 30;

/** Longest sidebar preview stored on the chat doc (matches firestore.rules). */
export const PREVIEW_MAX_LENGTH = 200;

const mapMessageDocs = (docs) =>
  docs.map((messageDoc) => ({
    id: messageDoc.id,
    ...messageDoc.data(),
  }));

/**
 * A direct chat's id is both user ids, sorted and joined, so each pair has
 * exactly one chat (the rules enforce the same format).
 */
export const directChatId = (userA, userB) =>
  [userA, userB].sort().join("_");

/** Return true if the two users already have a direct chat. */
export const hasExistingChatWith = async (currentUserId, otherUserId) => {
  const snap = await getDoc(
    doc(db, "chats", directChatId(currentUserId, otherUserId))
  );
  return snap.exists();
};

/**
 * Create the direct chat between two users, or return the existing one.
 * @returns {Promise<{ chatId: string, created: boolean }>}
 */
export const createChat = async ({ currentUserId, otherUserId }) => {
  const chatId = directChatId(currentUserId, otherUserId);
  const chatRef = doc(db, "chats", chatId);

  const created = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chatRef);
    if (snap.exists()) return false;

    transaction.set(chatRef, {
      type: "direct",
      participantIds: [currentUserId, otherUserId].sort(),
      createdBy: currentUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readAt: {},
    });
    return true;
  });

  return { chatId, created };
};

/** Create a group chat (creator + at least 2 others). */
export const createGroupChat = async ({
  creatorId,
  name,
  memberIds = [],
}) => {
  const groupName = String(name ?? "").trim();
  if (!groupName) {
    throw new Error("Group name is required");
  }

  const participantIds = [
    ...new Set(
      [creatorId, ...memberIds].filter((id) => typeof id === "string" && id)
    ),
  ];

  if (participantIds.length < 3) {
    throw new Error("Pick at least 2 other people for a group");
  }

  const newChatRef = doc(collection(db, "chats"));

  await setDoc(newChatRef, {
    type: "group",
    name: groupName,
    createdBy: creatorId,
    participantIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readAt: {},
  });

  return newChatRef.id;
};

/** Remove the current user from a group and clear their settings for it. */
export const leaveGroupChat = async ({ chatId, userId }) => {
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return;

  const chatData = chatSnap.data();
  if (chatData.type !== "group") return;

  const participantIds = (chatData.participantIds ?? []).filter(
    (id) => id !== userId
  );

  await updateDoc(chatRef, { participantIds });

  await setDoc(
    doc(db, "userChats", userId),
    { prefs: { [chatId]: deleteField() } },
    { merge: true }
  );
};

/** Set the group photo on the chat doc (every member sees it from there). */
export const updateGroupAvatar = async ({ chatId, avatarUrl }) => {
  const url = String(avatarUrl ?? "").trim();
  if (!url) return;

  await updateDoc(doc(db, "chats", chatId), { avatar: url });
};

/** Move the current user's read marker to now. */
export const markChatAsSeen = async (currentUserId, chatId) => {
  await updateDoc(doc(db, "chats", chatId), {
    [`readAt.${currentUserId}`]: serverTimestamp(),
  });
};

/** Update muted/archived flags in the current user's private settings. */
export const updateOwnChatFlags = async (currentUserId, chatId, flags) => {
  await setDoc(
    doc(db, "userChats", currentUserId),
    { prefs: { [chatId]: flags } },
    { merge: true }
  );
};

/** Live map of chatId → { muted, archived } for the current user. */
export const listenChatPrefs = (userId, { onData, onError }) => {
  return onSnapshot(
    doc(db, "userChats", userId),
    (snap) => onData(snap.data()?.prefs ?? {}),
    onError
  );
};

/**
 * Live list of the user's chats, newest activity first. Pending server
 * timestamps resolve to local estimates so new messages sort immediately.
 */
export const listenUserChats = (userId, { onData, onError }) => {
  const chatsQuery = query(
    collection(db, "chats"),
    where("participantIds", "array-contains", userId),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(
    chatsQuery,
    (snap) => {
      onData(
        snap.docs.map((chatDoc) => ({
          chatId: chatDoc.id,
          ...chatDoc.data({ serverTimestamps: "estimate" }),
        }))
      );
    },
    onError
  );
};

const toMillis = (value) =>
  value?.toMillis ? value.toMillis() : typeof value === "number" ? value : 0;

/**
 * Sidebar state for one chat, from the current user's point of view.
 * @param {{ lastMessage?: { text?: string, senderId?: string }, updatedAt?: unknown, readAt?: Record<string, unknown> }} chat
 * @param {string} currentUserId
 */
export const getChatActivity = (chat, currentUserId) => {
  const updatedAt = toMillis(chat.updatedAt);
  const lastMessage = chat.lastMessage ?? null;
  const readAt = toMillis(chat.readAt?.[currentUserId]);

  return {
    lastMessage: lastMessage?.text ?? "",
    updatedAt,
    isSeen:
      !lastMessage ||
      lastMessage.senderId === currentUserId ||
      readAt >= updatedAt,
  };
};

const previewFor = ({ text, img, audio, preview }) =>
  String(preview ?? (text || (img ? "Photo" : audio ? "Voice message" : "")))
    .slice(0, PREVIEW_MAX_LENGTH);

/**
 * Write a message and the chat's sidebar preview in one atomic batch.
 * @returns {Promise<string>} the new message id
 */
export const sendMessage = async ({
  chatId,
  senderId,
  text = "",
  img,
  audio,
  audioDuration,
  call,
  messageId = crypto.randomUUID(),
  preview,
}) => {
  const batch = writeBatch(db);

  batch.set(doc(db, "chats", chatId, "messages", messageId), {
    id: messageId,
    senderId,
    text,
    ...(img ? { img } : {}),
    ...(audio ? { audio } : {}),
    ...(typeof audioDuration === "number" ? { audioDuration } : {}),
    ...(call ? { call } : {}),
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, "chats", chatId), {
    lastMessage: {
      text: previewFor({ text, img, audio, preview }),
      senderId,
    },
    updatedAt: serverTimestamp(),
    [`readAt.${senderId}`]: serverTimestamp(),
  });

  await batch.commit();
  return messageId;
};

/** Soft-delete own message (keeps doc for thread continuity). */
export const deleteMessage = async (chatId, message) => {
  if (!message?.id) return;

  await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
    text: "",
    deleted: true,
    img: deleteField(),
    audio: deleteField(),
    audioDuration: deleteField(),
    call: deleteField(),
  });
};

/** Edit own message text (not allowed on deleted messages). */
export const editMessage = async (chatId, message, text) => {
  const nextText = String(text ?? "").trim();
  if (!message?.id || !nextText || message.deleted) return;

  await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
    text: nextText,
    edited: true,
    editedAt: serverTimestamp(),
  });
};

export const SHARED_PHOTOS_LIMIT = 100;

/** Live gallery of recent image messages for the details panel. */
export const listenSharedPhotos = (chatId, { onData, onError }) => {
  const messagesQuery = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "desc"),
    limit(SHARED_PHOTOS_LIMIT)
  );

  return onSnapshot(
    messagesQuery,
    (snap) => {
      onData(
        mapMessageDocs(snap.docs).filter(
          (msg) => typeof msg.img === "string" && msg.img && !msg.deleted
        )
      );
    },
    onError
  );
};

/** Listen to the newest page of messages (newest-first query, reversed in callback). */
export const listenLatestMessages = (chatId, { onData, onError }) => {
  const messagesQuery = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "desc"),
    limit(MESSAGE_PAGE_SIZE)
  );

  return onSnapshot(
    messagesQuery,
    (snap) => {
      onData({
        messages: mapMessageDocs(snap.docs).reverse(),
        oldestDoc: snap.docs[snap.docs.length - 1] ?? null,
        hasMore: snap.docs.length === MESSAGE_PAGE_SIZE,
      });
    },
    onError
  );
};

export const loadOlderMessages = async (chatId, oldestDoc) => {
  const olderQuery = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "desc"),
    startAfter(oldestDoc),
    limit(MESSAGE_PAGE_SIZE)
  );
  const snap = await getDocs(olderQuery);

  return {
    messages: mapMessageDocs(snap.docs).reverse(),
    oldestDoc: snap.docs[snap.docs.length - 1] ?? oldestDoc,
    hasMore: snap.docs.length === MESSAGE_PAGE_SIZE,
  };
};

/** Short-lived typing signal on the chat document. */
export const setTypingStatus = async (chatId, userId, isTyping) => {
  await updateDoc(doc(db, "chats", chatId), {
    typing: {
      userId: isTyping ? userId : null,
      updatedAt: Date.now(),
    },
  });
};

export const listenChatTyping = (chatId, { onData, onError }) => {
  return onSnapshot(
    doc(db, "chats", chatId),
    (snap) => {
      onData(snap.data()?.typing ?? null);
    },
    onError
  );
};
