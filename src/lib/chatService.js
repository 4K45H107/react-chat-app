import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export const MESSAGE_PAGE_SIZE = 30;

const mapMessageDocs = (docs) =>
  docs.map((messageDoc) => ({
    id: messageDoc.id,
    ...messageDoc.data(),
  }));

/** Create a 1:1 chat doc and sidebar entries for both users. */
export const createChat = async ({ currentUserId, otherUserId }) => {
  const newChatRef = doc(collection(db, "chats"));

  await setDoc(newChatRef, {
    createdAt: serverTimestamp(),
    type: "direct",
    participantIds: [currentUserId, otherUserId],
  });

  const entryForOther = {
    chatId: newChatRef.id,
    receiverId: currentUserId,
    lastMessage: "",
    updatedAt: Date.now(),
    muted: false,
    archived: false,
  };

  const entryForCurrent = {
    chatId: newChatRef.id,
    receiverId: otherUserId,
    lastMessage: "",
    updatedAt: Date.now(),
    muted: false,
    archived: false,
  };

  await updateDoc(doc(db, "userChats", otherUserId), {
    chats: arrayUnion(entryForOther),
  });

  await updateDoc(doc(db, "userChats", currentUserId), {
    chats: arrayUnion(entryForCurrent),
  });

  return newChatRef.id;
};

/**
 * Create a group chat (creator + at least 2 others) and sidebar entries
 * for every member.
 */
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
    createdAt: serverTimestamp(),
    type: "group",
    name: groupName,
    createdBy: creatorId,
    participantIds,
  });

  const sidebarEntry = {
    chatId: newChatRef.id,
    isGroup: true,
    groupName,
    lastMessage: "",
    updatedAt: Date.now(),
    muted: false,
    archived: false,
  };

  for (const participantId of participantIds) {
    await updateDoc(doc(db, "userChats", participantId), {
      chats: arrayUnion(sidebarEntry),
    });
  }

  return newChatRef.id;
};

/** Remove current user from a group and drop their sidebar entry. */
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

  const userChatsRef = doc(db, "userChats", userId);
  const userChatsSnap = await getDoc(userChatsRef);
  if (!userChatsSnap.exists()) return;

  const chats = (userChatsSnap.data().chats ?? []).filter(
    (chat) => chat.chatId !== chatId
  );
  await updateDoc(userChatsRef, { chats });
};

/** Set group avatar on the chat doc and denormalize to each member's sidebar. */
export const updateGroupAvatar = async ({ chatId, avatarUrl, currentUserId }) => {
  const url = String(avatarUrl ?? "").trim();
  if (!url) return;

  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return;

  const chatData = chatSnap.data();
  if (chatData.type !== "group") return;
  if (!(chatData.participantIds ?? []).includes(currentUserId)) {
    throw new Error("Not a group member");
  }

  await updateDoc(chatRef, { avatar: url });

  for (const participantId of chatData.participantIds ?? []) {
    try {
      const userChatsRef = doc(db, "userChats", participantId);
      const userChatsSnap = await getDoc(userChatsRef);
      if (!userChatsSnap.exists()) continue;

      const chats = [...(userChatsSnap.data().chats ?? [])];
      const chatIndex = chats.findIndex((c) => c.chatId === chatId);
      if (chatIndex === -1) continue;

      chats[chatIndex] = {
        ...chats[chatIndex],
        groupAvatar: url,
      };
      await updateDoc(userChatsRef, { chats });
    } catch (error) {
      console.warn(
        "[chatService] Failed to sync group avatar for participant:",
        participantId,
        error.code,
        error.message
      );
    }
  }
};

/** Return true if current user already has a 1:1 chat with receiverId. */
export const hasExistingChatWith = async (currentUserId, receiverId) => {
  const snap = await getDoc(doc(db, "userChats", currentUserId));
  const chats = snap.data()?.chats ?? [];
  return chats.some(
    (chat) => !chat.isGroup && chat.receiverId === receiverId
  );
};

export const markChatAsSeen = async (currentUserId, chatId) => {
  const userChatsRef = doc(db, "userChats", currentUserId);
  const snap = await getDoc(userChatsRef);
  if (!snap.exists()) return;

  const chats = [...(snap.data().chats ?? [])];
  const chatIndex = chats.findIndex((c) => c.chatId === chatId);
  if (chatIndex === -1 || chats[chatIndex].isSeen) return;

  chats[chatIndex] = { ...chats[chatIndex], isSeen: true };
  await updateDoc(userChatsRef, { chats });
};

/** Update muted/archived flags on the current user's sidebar entry only. */
export const updateOwnChatFlags = async (currentUserId, chatId, flags) => {
  const userChatsRef = doc(db, "userChats", currentUserId);
  const snap = await getDoc(userChatsRef);
  if (!snap.exists()) return;

  const chats = [...(snap.data().chats ?? [])];
  const chatIndex = chats.findIndex((c) => c.chatId === chatId);
  if (chatIndex === -1) return;

  chats[chatIndex] = {
    ...chats[chatIndex],
    ...flags,
  };
  await updateDoc(userChatsRef, { chats });
};

export const syncSidebarPreview = async ({
  chatId,
  currentUserId,
  preview,
  /** @deprecated Prefer reading participants from the chat doc */
  otherUserId,
  participantIds: participantIdsOverride,
}) => {
  let participantIds = participantIdsOverride;

  if (!participantIds?.length) {
    try {
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      participantIds = chatSnap.data()?.participantIds;
    } catch (error) {
      console.warn(
        "[chatService] Failed to load chat participants for sidebar sync:",
        error.code,
        error.message
      );
    }
  }

  if (!participantIds?.length) {
    participantIds = otherUserId
      ? [currentUserId, otherUserId]
      : [currentUserId];
  }

  for (const participantId of participantIds) {
    try {
      const userChatsRef = doc(db, "userChats", participantId);
      const userChatsSnapshot = await getDoc(userChatsRef);
      if (!userChatsSnapshot.exists()) continue;

      const chats = userChatsSnapshot.data().chats ?? [];
      const chatIndex = chats.findIndex((c) => c.chatId === chatId);
      if (chatIndex === -1) continue;

      chats[chatIndex].lastMessage = preview;
      chats[chatIndex].isSeen = participantId === currentUserId;
      chats[chatIndex].updatedAt = Date.now();

      await updateDoc(userChatsRef, { chats });
    } catch (sidebarError) {
      console.warn(
        "[chatService] Failed to sync sidebar for participant:",
        participantId,
        sidebarError.code,
        sidebarError.message
      );
    }
  }
};

export const sendMessage = async ({
  chatId,
  senderId,
  text = "",
  img,
  audio,
  audioDuration,
}) => {
  const messageId = crypto.randomUUID();
  await setDoc(doc(db, "chats", chatId, "messages", messageId), {
    id: messageId,
    senderId,
    text,
    ...(img ? { img } : {}),
    ...(audio ? { audio } : {}),
    ...(typeof audioDuration === "number" ? { audioDuration } : {}),
    createdAt: serverTimestamp(),
  });
  return messageId;
};

/** Soft-delete own message (keeps doc for thread continuity). */
export const deleteMessage = async (chatId, message) => {
  if (!message?.id) return;

  await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
    id: message.id,
    senderId: message.senderId,
    text: "",
    deleted: true,
    createdAt: message.createdAt ?? serverTimestamp(),
    img: deleteField(),
    audio: deleteField(),
    audioDuration: deleteField(),
  });
};

/** Edit own message text (not allowed on deleted messages). */
export const editMessage = async (chatId, message, text) => {
  const nextText = String(text ?? "").trim();
  if (!message?.id || !nextText || message.deleted) return;

  await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
    id: message.id,
    senderId: message.senderId,
    text: nextText,
    edited: true,
    editedAt: serverTimestamp(),
    createdAt: message.createdAt ?? serverTimestamp(),
    ...(message.img ? { img: message.img } : {}),
    ...(message.audio ? { audio: message.audio } : {}),
    ...(typeof message.audioDuration === "number"
      ? { audioDuration: message.audioDuration }
      : {}),
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

/** Move legacy messages[] from the chat doc into the messages subcollection. */
export const migrateLegacyMessages = async (chatId) => {
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return false;

  const legacy = chatSnap.data()?.messages;
  if (!Array.isArray(legacy) || legacy.length === 0) return false;

  for (const msg of legacy) {
    const messageId = msg.id || crypto.randomUUID();
    await setDoc(
      doc(db, "chats", chatId, "messages", messageId),
      {
        id: messageId,
        senderId: msg.senderId,
        text: msg.text ?? "",
        ...(msg.img ? { img: msg.img } : {}),
        createdAt: msg.createdAt ?? new Date(),
      },
      { merge: true }
    );
  }

  await updateDoc(chatRef, { messages: deleteField() });
  return true;
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
