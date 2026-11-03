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
import { auth, db } from "../../src/lib/firebase";
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

let ayesha, rafi, nadia, tanvir;

beforeAll(async () => {
  tanvir = await signInAs("tanvir");
  nadia = await signInAs("nadia");
  rafi = await signInAs("rafi");
  ayesha = await signInAs("ayesha");
});

describe("sidebar", () => {
  it("lists the user's chats, newest first, with unread state", async () => {
    const list = (await firstSnapshot(chats.listenUserChats, ayesha)).map(
      (chat) => ({ chatId: chat.chatId, ...chats.getChatActivity(chat, ayesha) })
    );

    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({
      chatId: chats.directChatId(ayesha, nadia),
      lastMessage: "Tanvir might join too",
      isSeen: false,
    });
    expect(list.slice(1).every((chat) => chat.isSeen)).toBe(true);
  });

  it("marks a chat read when it's opened", async () => {
    const chatId = chats.directChatId(ayesha, nadia);
    await chats.markChatAsSeen(ayesha, chatId);
    expect(chats.getChatActivity(await chatData(chatId), ayesha).isSeen).toBe(
      true
    );
  });

  it("keeps mute and archive in private settings", async () => {
    const chatId = chats.directChatId(ayesha, rafi);
    await chats.updateOwnChatFlags(ayesha, chatId, { muted: true });
    await chats.updateOwnChatFlags(ayesha, chatId, { archived: true });

    const prefs = await firstSnapshot(chats.listenChatPrefs, ayesha);
    expect(prefs[chatId]).toEqual({ muted: true, archived: true });
  });
});

describe("messages", () => {
  it("writes the message and preview together; the partner sees it unread", async () => {
    const chatId = chats.directChatId(ayesha, rafi);
    const messageId = await chats.sendMessage({
      chatId,
      senderId: ayesha,
      text: "See you at standup",
    });

    const chat = await chatData(chatId);
    expect(chat.lastMessage).toEqual({
      text: "See you at standup",
      senderId: ayesha,
    });
    expect(chats.getChatActivity(chat, rafi).isSeen).toBe(false);

    await chats.editMessage(chatId, { id: messageId }, "See you at 10");
    await chats.deleteMessage(chatId, { id: messageId });
    const message = await getDoc(
      doc(db, "chats", chatId, "messages", messageId)
    );
    expect(message.data()).toMatchObject({ deleted: true, text: "" });
  });

  it("previews photos and voice messages", async () => {
    const chatId = chats.directChatId(ayesha, rafi);
    await chats.sendMessage({
      chatId,
      senderId: ayesha,
      img: "https://example.com/photo.png",
      preview: "Photo",
    });
    expect((await chatData(chatId)).lastMessage.text).toBe("Photo");

    await chats.sendMessage({
      chatId,
      senderId: ayesha,
      audio: "https://example.com/voice.webm",
      audioDuration: 3,
      preview: "Voice message",
    });
    expect((await chatData(chatId)).lastMessage.text).toBe("Voice message");
  });

  it("are refused in both directions once someone blocks", async () => {
    const chatId = chats.directChatId(ayesha, tanvir);
    await chats.createChat({ currentUserId: ayesha, otherUserId: tanvir });
    await updateDoc(doc(db, "users", ayesha), { blocked: arrayUnion(tanvir) });

    await expect(
      chats.sendMessage({ chatId, senderId: ayesha, text: "hi" })
    ).rejects.toThrow();
    await signInAs("tanvir");
    await expect(
      chats.sendMessage({ chatId, senderId: tanvir, text: "hi" })
    ).rejects.toThrow();
    await signInAs("ayesha");
  });
});

describe("chats", () => {
  it("creates one direct chat per pair", async () => {
    expect(await chats.hasExistingChatWith(rafi, nadia)).toBe(false);
    await signInAs("rafi");
    const first = await chats.createChat({ currentUserId: rafi, otherUserId: nadia });
    const second = await chats.createChat({ currentUserId: rafi, otherUserId: nadia });
    expect([first.created, second.created]).toEqual([true, false]);
    expect(first.chatId).toBe(chats.directChatId(rafi, nadia));
    await signInAs("ayesha");
  });

  it("supports a group's whole life: create, photo, typing, message, leave", async () => {
    const chatId = await chats.createGroupChat({
      creatorId: ayesha,
      name: "Book club",
      memberIds: [rafi, nadia],
    });
    await chats.updateGroupAvatar({ chatId, avatarUrl: "https://example.com/g.png" });
    await chats.setTypingStatus(chatId, ayesha, true);
    await chats.setTypingStatus(chatId, ayesha, false);
    await chats.sendMessage({ chatId, senderId: ayesha, text: "First book?" });
    await chats.leaveGroupChat({ chatId, userId: ayesha });

    const list = await firstSnapshot(chats.listenUserChats, ayesha);
    expect(list.some((chat) => chat.chatId === chatId)).toBe(false);
  });
});

describe("calls", () => {
  it("rings, connects, ends and logs exactly one history message", async () => {
    const chatId = chats.directChatId(ayesha, rafi);
    const callId = await createCall({
      chatId,
      callerId: ayesha,
      calleeId: rafi,
      type: "voice",
      offer: { type: "offer", sdp: "offer-sdp" },
    });

    await signInAs("rafi");
    await setCallAnswer(callId, { type: "answer", sdp: "answer-sdp" });
    await updateCallStatus(callId, "ended", { endedBy: rafi });
    const entry = { chatId, callId, type: "voice", status: "ended", durationSec: 42 };
    expect(await postCallHistoryMessage({ ...entry, senderId: rafi })).toBe(true);

    await signInAs("ayesha");
    expect(await postCallHistoryMessage({ ...entry, senderId: ayesha })).toBe(false);
    expect((await chatData(chatId)).lastMessage.text).toBe("Voice call · 0:42");
  });
});

describe("privacy", () => {
  it("keeps other users' settings, chats and emails out of reach", async () => {
    await expect(getDoc(doc(db, "userChats", rafi))).rejects.toThrow();
    await expect(getDocs(collection(db, "chats"))).rejects.toThrow();
    const profile = (await getDoc(doc(db, "users", rafi))).data();
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
