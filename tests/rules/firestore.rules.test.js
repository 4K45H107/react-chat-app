// Firestore security rules tests. Run with `npm run test:rules`, which starts
// the Firestore emulator and runs this file against firestore.rules.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

let env;

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const profile = (id, extra = {}) => ({
  id,
  username: id,
  avatar: "",
  blocked: [],
  ...extra,
});

const chat = (participantIds, extra = {}) => ({
  type: "direct",
  participantIds,
  createdBy: participantIds[0],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  readAt: {},
  ...extra,
});

const message = (id, senderId, extra = {}) => ({
  id,
  senderId,
  text: "hello",
  createdAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-reactchat",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const id of ["alice", "bob", "carol", "mallory"]) {
      await setDoc(doc(db, "users", id), profile(id));
    }
    await setDoc(doc(db, "users", "eve"), profile("eve", { blocked: ["alice"] }));
    await setDoc(doc(db, "userChats", "alice"), { prefs: {} });

    await setDoc(doc(db, "chats", "alice_bob"), chat(["alice", "bob"]));
    await setDoc(doc(db, "chats", "alice_eve"), chat(["alice", "eve"]));
    await setDoc(
      doc(db, "chats", "group1"),
      chat(["alice", "bob", "carol"], { type: "group", name: "Trip" })
    );
    await setDoc(doc(db, "chats", "alice_bob", "messages", "m1"), {
      id: "m1",
      senderId: "alice",
      text: "hi",
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "calls", "call1"), {
      id: "call1",
      chatId: "alice_bob",
      callerId: "alice",
      calleeId: "bob",
      callerName: "alice",
      calleeName: "bob",
      type: "video",
      status: "ringing",
      offer: { type: "offer", sdp: "x" },
      answer: null,
      createdAt: Timestamp.now(),
      endedAt: null,
      endedBy: null,
    });
  });
});

describe("users", () => {
  it("are readable by signed-in users only", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "users", "alice")));
    await assertFails(getDoc(doc(anon(), "users", "alice")));
  });

  it("can be created by their owner without an email", async () => {
    await assertSucceeds(
      setDoc(doc(as("frank"), "users", "frank"), profile("frank"))
    );
  });

  it("refuse an email field, so emails can't be harvested", async () => {
    await assertFails(
      setDoc(
        doc(as("frank"), "users", "frank"),
        profile("frank", { email: "frank@example.com" })
      )
    );
  });

  it("can't be written by anyone else", async () => {
    await assertFails(
      updateDoc(doc(as("mallory"), "users", "alice"), { username: "pwned" })
    );
  });
});

describe("userChats (private settings)", () => {
  it("can be read and written by their owner", async () => {
    const db = as("alice");
    await assertSucceeds(getDoc(doc(db, "userChats", "alice")));
    await assertSucceeds(
      setDoc(
        doc(db, "userChats", "alice"),
        { prefs: { alice_bob: { muted: true } } },
        { merge: true }
      )
    );
  });

  it("can't be read by anyone else", async () => {
    await assertFails(getDoc(doc(as("bob"), "userChats", "alice")));
  });

  it("can't be overwritten by anyone else", async () => {
    await assertFails(
      setDoc(doc(as("mallory"), "userChats", "alice"), { prefs: {} })
    );
  });
});

describe("creating chats", () => {
  const newChat = (ids, extra = {}) => ({
    type: "direct",
    participantIds: ids,
    createdBy: ids.includes("bob") ? "bob" : ids[0],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readAt: {},
    ...extra,
  });

  it("allows a direct chat under its sorted-pair id", async () => {
    await assertSucceeds(
      setDoc(doc(as("bob"), "chats", "bob_carol"), newChat(["bob", "carol"]))
    );
  });

  it("refuses a direct chat under any other id", async () => {
    await assertFails(
      setDoc(doc(as("bob"), "chats", "random"), newChat(["bob", "carol"]))
    );
  });

  it("refuses a direct chat with someone who blocked you", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "users", "carol"), {
        blocked: ["bob"],
      });
    });
    await assertFails(
      setDoc(doc(as("bob"), "chats", "bob_carol"), newChat(["bob", "carol"]))
    );
  });

  it("refuses a chat the creator isn't in", async () => {
    await assertFails(
      setDoc(
        doc(as("mallory"), "chats", "bob_carol"),
        newChat(["bob", "carol"], { createdBy: "mallory" })
      )
    );
  });

  it("allows a group of three or more", async () => {
    await assertSucceeds(
      setDoc(
        doc(as("bob"), "chats", "group2"),
        newChat(["bob", "carol", "alice"], { type: "group", name: "Team" })
      )
    );
  });

  it("refuses a group of two", async () => {
    await assertFails(
      setDoc(
        doc(as("bob"), "chats", "group2"),
        newChat(["bob", "carol"], { type: "group", name: "Team" })
      )
    );
  });
});

describe("reading chats", () => {
  it("lets members read a chat and strangers not", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "chats", "alice_bob")));
    await assertFails(getDoc(doc(as("mallory"), "chats", "alice_bob")));
  });

  it("allows checking whether a chat exists yet", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "chats", "bob_carol")));
  });

  it("allows listing your own chats, not everyone's", async () => {
    const db = as("bob");
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "chats"),
          where("participantIds", "array-contains", "bob"),
          orderBy("updatedAt", "desc")
        )
      )
    );
    await assertFails(getDocs(collection(db, "chats")));
    await assertFails(
      getDocs(
        query(
          collection(db, "chats"),
          where("participantIds", "array-contains", "alice")
        )
      )
    );
  });
});

describe("updating chats", () => {
  it("lets a member post a preview as themselves", async () => {
    await assertSucceeds(
      updateDoc(doc(as("bob"), "chats", "alice_bob"), {
        lastMessage: { text: "hey", senderId: "bob" },
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("refuses a preview posted in someone else's name", async () => {
    await assertFails(
      updateDoc(doc(as("bob"), "chats", "alice_bob"), {
        lastMessage: { text: "hey", senderId: "alice" },
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("lets members move only their own read marker", async () => {
    const db = as("bob");
    await assertSucceeds(
      updateDoc(doc(db, "chats", "alice_bob"), {
        "readAt.bob": serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(db, "chats", "alice_bob"), {
        "readAt.alice": serverTimestamp(),
      })
    );
  });

  it("refuses adding someone to a group", async () => {
    await assertFails(
      updateDoc(doc(as("bob"), "chats", "group1"), {
        participantIds: ["alice", "bob", "carol", "mallory"],
      })
    );
  });

  it("lets a member leave a group but not remove others", async () => {
    await assertFails(
      updateDoc(doc(as("bob"), "chats", "group1"), {
        participantIds: ["bob", "carol"],
      })
    );
    await assertSucceeds(
      updateDoc(doc(as("bob"), "chats", "group1"), {
        participantIds: ["alice", "carol"],
      })
    );
  });

  it("refuses changing a chat's type", async () => {
    await assertFails(
      updateDoc(doc(as("bob"), "chats", "alice_bob"), { type: "group" })
    );
  });

  it("refuses updates from strangers and deletes from anyone", async () => {
    await assertFails(
      updateDoc(doc(as("mallory"), "chats", "alice_bob"), {
        typing: { userId: "mallory", updatedAt: 1 },
      })
    );
    await assertFails(deleteDoc(doc(as("alice"), "chats", "alice_bob")));
  });
});

describe("messages", () => {
  it("lets members send a message with its preview in one batch", async () => {
    const db = as("bob");
    const batch = writeBatch(db);
    batch.set(doc(db, "chats", "alice_bob", "messages", "m2"), message("m2", "bob"));
    batch.update(doc(db, "chats", "alice_bob"), {
      lastMessage: { text: "hello", senderId: "bob" },
      updatedAt: serverTimestamp(),
      "readAt.bob": serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it("are hidden from strangers", async () => {
    await assertFails(
      getDocs(collection(as("mallory"), "chats", "alice_bob", "messages"))
    );
    await assertFails(
      setDoc(
        doc(as("mallory"), "chats", "alice_bob", "messages", "m2"),
        message("m2", "mallory")
      )
    );
  });

  it("can't be sent in someone else's name", async () => {
    await assertFails(
      setDoc(
        doc(as("bob"), "chats", "alice_bob", "messages", "m2"),
        message("m2", "alice")
      )
    );
  });

  it("can't be backdated", async () => {
    await assertFails(
      setDoc(
        doc(as("bob"), "chats", "alice_bob", "messages", "m2"),
        message("m2", "bob", { createdAt: Timestamp.fromMillis(0) })
      )
    );
  });

  it("can't be sent to someone who blocked you", async () => {
    await assertFails(
      setDoc(
        doc(as("alice"), "chats", "alice_eve", "messages", "m2"),
        message("m2", "alice")
      )
    );
  });

  it("can be edited by their sender only", async () => {
    const edit = {
      text: "edited",
      edited: true,
      editedAt: serverTimestamp(),
    };
    await assertFails(
      updateDoc(doc(as("bob"), "chats", "alice_bob", "messages", "m1"), edit)
    );
    await assertSucceeds(
      updateDoc(doc(as("alice"), "chats", "alice_bob", "messages", "m1"), edit)
    );
  });

  it("can be soft-deleted by their sender but never hard-deleted", async () => {
    const ref = (db) => doc(db, "chats", "alice_bob", "messages", "m1");
    await assertSucceeds(
      updateDoc(ref(as("alice")), {
        text: "",
        deleted: true,
        img: deleteField(),
      })
    );
    await assertFails(deleteDoc(ref(as("alice"))));
  });
});

describe("calls", () => {
  const newCall = (id, extra = {}) => ({
    id,
    chatId: "alice_bob",
    callerId: "alice",
    calleeId: "bob",
    callerName: "alice",
    calleeName: "bob",
    type: "voice",
    status: "ringing",
    offer: { type: "offer", sdp: "x" },
    answer: null,
    createdAt: serverTimestamp(),
    endedAt: null,
    endedBy: null,
    ...extra,
  });

  it("can be started by a member of the direct chat", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "calls", "c2"), newCall("c2")));
  });

  it("can't be started for a chat you're not in", async () => {
    await assertFails(
      setDoc(
        doc(as("mallory"), "calls", "c2"),
        newCall("c2", { callerId: "mallory" })
      )
    );
  });

  it("are visible to the two parties only", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "calls", "call1")));
    await assertFails(getDoc(doc(as("mallory"), "calls", "call1")));
  });

  it("can be answered by the callee, not the caller", async () => {
    const answer = { answer: { type: "answer", sdp: "y" }, status: "active" };
    await assertFails(updateDoc(doc(as("alice"), "calls", "call1"), answer));
    await assertSucceeds(updateDoc(doc(as("bob"), "calls", "call1"), answer));
  });

  it("can be ended by either side, but not reopened", async () => {
    const end = (uid) => ({
      status: "ended",
      endedAt: serverTimestamp(),
      endedBy: uid,
    });
    await assertSucceeds(updateDoc(doc(as("alice"), "calls", "call1"), end("alice")));
    await assertFails(
      updateDoc(doc(as("bob"), "calls", "call1"), { status: "ringing" })
    );
  });

  it("accept ICE candidates only from the parties, in their own name", async () => {
    const ice = (from) => ({
      from,
      candidate: { candidate: "c" },
      createdAt: Date.now(),
    });
    await assertSucceeds(
      addDoc(collection(as("bob"), "calls", "call1", "iceCandidates"), ice("bob"))
    );
    await assertFails(
      addDoc(collection(as("bob"), "calls", "call1", "iceCandidates"), ice("alice"))
    );
    await assertFails(
      addDoc(
        collection(as("mallory"), "calls", "call1", "iceCandidates"),
        ice("mallory")
      )
    );
  });
});
