// End-to-end flows through the app's own services, against emulators seeded
// by scripts/seed.mjs. Run with `npm run test:integration`.
import { beforeAll, describe, expect, it } from "vitest";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth } from "../../src/lib/firebase";
import { db } from "../../src/lib/db";
import * as chats from "../../src/lib/chatService";
import {
  createCall,
  postCallHistoryMessage,
  setCallAnswer,
  updateCallStatus,
} from "../../src/lib/callService";

/** Resolve with the first snapshot from a `listen…(id, { onData, onError })`. */
const firstSnapshot = (listen, id) =>
  new Promise((resolve, reject) => {
    const unsubscribe = listen(id, {
      onData: (data) => {
        unsubscribe();
        resolve(data);
      },
      onError: reject,
    });
  });

const signInAs = async (name) => {
  if (auth.currentUser) await signOut(auth);
  const { user } = await signInWithEmailAndPassword(
    auth,
    `${name}@reactchat.dev`,
    "Password123!"
  );
  return user.uid;
};

const chatData = async (chatId) =>
  (await getDoc(doc(db, "chats", chatId))).data();

let nadia, tanvir, rafi, sadia;

beforeAll(async () => {
  sadia = await signInAs("sadia");
  rafi = await signInAs("rafi");
  tanvir = await signInAs("tanvir");
  nadia = await signInAs("nadia");
});

describe("sidebar", () => {
  it("lists the user's chats, newest first, with unread state", async () => {
    const list = (await firstSnapshot(chats.listenUserChats, nadia)).map(
      (chat) => ({ chatId: chat.chatId, ...chats.getChatActivity(chat, nadia) })
    );

    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({
      chatId: chats.directChatId(nadia, sadia),
      lastMessage: "Rafi might join too",
      isSeen: false,
    });
    expect(list.slice(1).every((chat) => chat.isSeen)).toBe(true);
  });

  it("marks a chat read when it's opened", async () => {
    const chatId = chats.directChatId(nadia, sadia);
    await chats.markChatAsSeen(nadia, chatId);
    expect(chats.getChatActivity(await chatData(chatId), nadia).isSeen).toBe(
      true
    );
  });

  it("keeps mute and archive in private settings", async () => {
    const chatId = chats.directChatId(nadia, tanvir);
    await chats.updateOwnChatFlags(nadia, chatId, { muted: true });
    await chats.updateOwnChatFlags(nadia, chatId, { archived: true });

    const prefs = await firstSnapshot(chats.listenChatPrefs, nadia);
    expect(prefs[chatId]).toEqual({ muted: true, archived: true });
  });
});

describe("messages", () => {
  it("writes the message and preview together; the partner sees it unread", async () => {
    const chatId = chats.directChatId(nadia, tanvir);
    const messageId = await chats.sendMessage({
      chatId,
      senderId: nadia,
      text: "See you at standup",
    });

    const chat = await chatData(chatId);
    expect(chat.lastMessage).toEqual({
      text: "See you at standup",
      senderId: nadia,
    });
    expect(chats.getChatActivity(chat, tanvir).isSeen).toBe(false);

    await chats.editMessage(chatId, { id: messageId }, "See you at 10");
    await chats.deleteMessage(chatId, { id: messageId });
    const message = await getDoc(
      doc(db, "chats", chatId, "messages", messageId)
    );
    expect(message.data()).toMatchObject({ deleted: true, text: "" });
  });

  it("previews photos and voice messages", async () => {
    const chatId = chats.directChatId(nadia, tanvir);
    await chats.sendMessage({
      chatId,
      senderId: nadia,
      img: "https://example.com/photo.png",
      preview: "Photo",
    });
    expect((await chatData(chatId)).lastMessage.text).toBe("Photo");

    await chats.sendMessage({
      chatId,
      senderId: nadia,
      audio: "https://example.com/voice.webm",
      audioDuration: 3,
      preview: "Voice message",
    });
    expect((await chatData(chatId)).lastMessage.text).toBe("Voice message");
  });

  it("are refused in both directions once someone blocks", async () => {
    const chatId = chats.directChatId(nadia, rafi);
    await chats.createChat({ currentUserId: nadia, otherUserId: rafi });
    await updateDoc(doc(db, "users", nadia), { blocked: arrayUnion(rafi) });

    await expect(
      chats.sendMessage({ chatId, senderId: nadia, text: "hi" })
    ).rejects.toThrow();
    await signInAs("rafi");
    await expect(
      chats.sendMessage({ chatId, senderId: rafi, text: "hi" })
    ).rejects.toThrow();
    await signInAs("nadia");
  });
});

describe("chats", () => {
  it("creates one direct chat per pair", async () => {
    expect(await chats.hasExistingChatWith(rafi, sadia)).toBe(false);
    await signInAs("rafi");
    const first = await chats.createChat({ currentUserId: rafi, otherUserId: sadia });
    const second = await chats.createChat({ currentUserId: rafi, otherUserId: sadia });
    expect([first.created, second.created]).toEqual([true, false]);
    expect(first.chatId).toBe(chats.directChatId(rafi, sadia));
    await signInAs("nadia");
  });

  it("supports a group's whole life: create, photo, typing, message, leave", async () => {
    const chatId = await chats.createGroupChat({
      creatorId: nadia,
      name: "Book club",
      memberIds: [tanvir, sadia],
    });
    await chats.updateGroupAvatar({ chatId, avatarUrl: "https://example.com/g.png" });
    await chats.setTypingStatus(chatId, nadia, true);
    await chats.setTypingStatus(chatId, nadia, false);
    await chats.sendMessage({ chatId, senderId: nadia, text: "First book?" });
    await chats.leaveGroupChat({ chatId, userId: nadia });

    const list = await firstSnapshot(chats.listenUserChats, nadia);
    expect(list.some((chat) => chat.chatId === chatId)).toBe(false);
  });
});

describe("calls", () => {
  it("rings, connects, ends and logs exactly one history message", async () => {
    const chatId = chats.directChatId(nadia, tanvir);
    const callId = await createCall({
      chatId,
      callerId: nadia,
      calleeId: tanvir,
      type: "voice",
      offer: { type: "offer", sdp: "offer-sdp" },
    });

    await signInAs("tanvir");
    await setCallAnswer(callId, { type: "answer", sdp: "answer-sdp" });
    await updateCallStatus(callId, "ended", { endedBy: tanvir });
    const entry = { chatId, callId, type: "voice", status: "ended", durationSec: 42 };
    expect(await postCallHistoryMessage({ ...entry, senderId: tanvir })).toBe(true);

    await signInAs("nadia");
    expect(await postCallHistoryMessage({ ...entry, senderId: nadia })).toBe(false);
    expect((await chatData(chatId)).lastMessage.text).toBe("Voice call · 0:42");
  });
});

describe("privacy", () => {
  it("keeps other users' settings, chats and emails out of reach", async () => {
    await expect(getDoc(doc(db, "userChats", tanvir))).rejects.toThrow();
    await expect(getDocs(collection(db, "chats"))).rejects.toThrow();
    const profile = (await getDoc(doc(db, "users", tanvir))).data();
    expect(profile).not.toHaveProperty("email");
  });

  it("signs up with a public profile that can't hold an email", async () => {
    await signOut(auth);
    const { user } = await createUserWithEmailAndPassword(
      auth,
      `new-${Date.now()}@reactchat.dev`,
      "Password123!"
    );
    const ref = doc(db, "users", user.uid);
    const profile = { id: user.uid, username: "New user", blocked: [], avatar: "" };

    await setDoc(ref, profile);
    await updateDoc(ref, { avatar: "https://example.com/me.png" });
    await expect(
      setDoc(ref, { ...profile, email: "new@reactchat.dev" })
    ).rejects.toThrow();
  });
});
