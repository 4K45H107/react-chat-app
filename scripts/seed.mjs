// Seeds demo accounts and a realistic chat history. Safe to re-run: it
// deletes the previous demo users and their chats first.
//
//   Emulators:  npm run emulators   (in another terminal)
//               npm run seed:emulators
//   Live:       GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed
//
// The Admin SDK bypasses security rules, which is what lets it write
// backdated timestamps. The app itself can't.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId =
  process.env.GCLOUD_PROJECT ||
  JSON.parse(readFileSync(".firebaserc", "utf8")).projects.default;
const bucketName = process.env.STORAGE_BUCKET || `${projectId}.appspot.com`;

initializeApp({
  projectId,
  storageBucket: bucketName,
  ...(usingEmulators ? {} : { credential: applicationDefault() }),
});

const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();

const DEMO_PASSWORD = "Password123!";

// Nadia and Tanvir are the advertised demo logins; Rafi and Sadia fill out
// the group and send each of them an unread message.
const PEOPLE = [
  { key: "nadia", username: "Nadia Karim", color: "#f97316" },
  { key: "tanvir", username: "Tanvir Ahmed", color: "#10b981" },
  { key: "rafi", username: "Rafi Hasan", color: "#0ea5e9" },
  { key: "sadia", username: "Sadia Islam", color: "#7c5cff" },
];

const emailFor = (key) => `${key}@reactchat.dev`;

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const now = Date.now();
const at = (msAgo) => Timestamp.fromMillis(now - msAgo);

// ── Images (generated SVGs, so the repo needs no binary assets) ───────────

const avatarSvg = (name, color) => {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="${color}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Helvetica, Arial, sans-serif" font-size="104" font-weight="700" fill="#fff">${initials}</text>
</svg>`;
};

const SUNSET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff9a5a"/><stop offset="0.6" stop-color="#ffcf7a"/><stop offset="1" stop-color="#ffe9b0"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="url(#sky)"/>
  <circle cx="640" cy="330" r="90" fill="#fff4d6"/>
  <path d="M0 420 L180 260 L330 400 L470 230 L640 410 L780 300 L960 420 L960 640 L0 640Z" fill="#5b4a8a"/>
  <path d="M0 500 L220 380 L420 500 L600 400 L820 500 L960 450 L960 640 L0 640Z" fill="#3b2f63"/>
  <rect y="560" width="960" height="80" fill="#2b5d7a"/>
</svg>`;

const TEA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="#2f5d3a"/>
  <path d="M0 260 Q200 200 400 260 T800 260 L800 340 Q600 280 400 340 T0 340Z" fill="#3f7a4c"/>
  <path d="M0 420 Q200 360 400 420 T800 420 L800 500 Q600 440 400 500 T0 500Z" fill="#4c9159"/>
  <path d="M0 580 Q200 520 400 580 T800 580 L800 660 Q600 600 400 660 T0 660Z" fill="#5aa867"/>
  <circle cx="620" cy="140" r="60" fill="#f6f1c7"/>
</svg>`;

/** Upload a file and return a Firebase download URL the client SDK can read. */
const uploadFile = async (path, contents, contentType) => {
  const token = randomUUID();
  await bucket.file(path).save(Buffer.from(contents), {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const host = usingEmulators
    ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
    : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
};

// ── Reset ─────────────────────────────────────────────────────────────────

const deleteExistingDemoUsers = async () => {
  for (const person of PEOPLE) {
    let uid;
    try {
      uid = (await auth.getUserByEmail(emailFor(person.key))).uid;
    } catch (error) {
      if (error.code === "auth/user-not-found") continue;
      throw error;
    }

    const chats = await db
      .collection("chats")
      .where("participantIds", "array-contains", uid)
      .get();
    for (const chatDoc of chats.docs) {
      await db.recursiveDelete(chatDoc.ref);
    }
    await db.doc(`users/${uid}`).delete();
    await db.doc(`userChats/${uid}`).delete();
    await bucket.deleteFiles({ prefix: `images/${uid}/` }).catch(() => {});
    await auth.deleteUser(uid);
  }
};

// ── Seed ──────────────────────────────────────────────────────────────────

const directId = (a, b) => [a, b].sort().join("_");

/**
 * Write a chat and its messages. Each message is [sender, msAgo, text, extra].
 * The newest message becomes the sidebar preview.
 */
const writeChat = async (chatId, chat, messages, readAtMsAgo) => {
  const sorted = [...messages].sort((a, b) => b[1] - a[1]);
  const newest = sorted[sorted.length - 1];
  const previewOf = ([, , text, extra = {}]) =>
    text || (extra.img ? "Photo" : extra.audio ? "Voice message" : "");

  await db.doc(`chats/${chatId}`).set({
    ...chat,
    createdAt: at(sorted[0][1] + MINUTE),
    updatedAt: at(newest[1]),
    lastMessage: { text: previewOf(newest).slice(0, 200), senderId: newest[0] },
    readAt: Object.fromEntries(
      Object.entries(readAtMsAgo).map(([uid, msAgo]) => [uid, at(msAgo)])
    ),
  });

  const batch = db.batch();
  for (const [senderId, msAgo, text, extra = {}] of sorted) {
    const { id: fixedId, ...fields } = extra;
    const id = fixedId ?? randomUUID();
    batch.set(db.doc(`chats/${chatId}/messages/${id}`), {
      id,
      senderId,
      text,
      createdAt: at(msAgo),
      ...fields,
    });
  }
  await batch.commit();
};

const seed = async () => {
  console.log(
    `Seeding ${usingEmulators ? "the emulators" : `live project ${projectId}`}…`
  );

  await deleteExistingDemoUsers();

  /** @type {Record<string, string>} key → uid */
  const uid = {};
  for (const person of PEOPLE) {
    const user = await auth.createUser({
      email: emailFor(person.key),
      password: DEMO_PASSWORD,
      displayName: person.username,
      emailVerified: true,
    });
    uid[person.key] = user.uid;

    const avatar = await uploadFile(
      `images/${user.uid}/avatar.svg`,
      avatarSvg(person.username, person.color),
      "image/svg+xml"
    );
    await db.doc(`users/${user.uid}`).set({
      id: user.uid,
      username: person.username,
      avatar,
      blocked: [],
      lastActive: at(3 * HOUR),
    });
  }

  const { nadia, tanvir, rafi, sadia } = uid;
  const sunset = await uploadFile(
    `images/${tanvir}/sunset.svg`,
    SUNSET_SVG,
    "image/svg+xml"
  );
  const tea = await uploadFile(`images/${nadia}/tea-garden.svg`, TEA_SVG, "image/svg+xml");

  // Nadia ↔ Tanvir: the main demo thread (photo, edit, delete, call log)
  const callId = randomUUID();
  await writeChat(
    directId(nadia, tanvir),
    {
      type: "direct",
      participantIds: [nadia, tanvir].sort(),
      createdBy: nadia,
    },
    [
      [nadia, 26 * HOUR, "Hey Tanvir! Did you finish the API review?"],
      [tanvir, 26 * HOUR - 4 * MINUTE, "Almost. Two endpoints left, I'll push tonight."],
      [nadia, 26 * HOUR - 6 * MINUTE, "Perfect, thanks 🙌"],
      [tanvir, 5 * HOUR, "", { deleted: true }],
      [tanvir, 5 * HOUR - MINUTE, "Caught this on the way back from Cox's Bazar", { img: sunset }],
      [nadia, 5 * HOUR - 3 * MINUTE, "Wow, that's unreal. Saving this as my wallpaper"],
      [nadia, 5 * HOUR - 4 * MINUTE, "Free for a quick call about the release?", { edited: true, editedAt: at(5 * HOUR - 4 * MINUTE + 20_000) }],
      [
        tanvir,
        4 * HOUR,
        "Video call · 12:34",
        { id: callId, call: { type: "video", status: "ended", callId, durationSec: 754 } },
      ],
      [tanvir, 4 * HOUR - 2 * MINUTE, "Good call. I'll update the ticket with what we agreed."],
      [nadia, 3 * HOUR, "Sounds good, see you at standup tomorrow!"],
    ],
    { [nadia]: 3 * HOUR, [tanvir]: 3 * HOUR }
  );

  // Sadia → Nadia: unread for Nadia
  await writeChat(
    directId(nadia, sadia),
    {
      type: "direct",
      participantIds: [nadia, sadia].sort(),
      createdBy: sadia,
    },
    [
      [sadia, 30 * HOUR, "Are we still on for lunch on Friday?"],
      [nadia, 29 * HOUR, "Yes! The new place in Gulshan?"],
      [sadia, 40 * MINUTE, "Booked a table for 1 pm 🍜"],
      [sadia, 38 * MINUTE, "Rafi might join too"],
    ],
    { [nadia]: 29 * HOUR, [sadia]: 38 * MINUTE }
  );

  // Rafi → Tanvir: unread for Tanvir
  await writeChat(
    directId(tanvir, rafi),
    {
      type: "direct",
      participantIds: [tanvir, rafi].sort(),
      createdBy: rafi,
    },
    [
      [rafi, 20 * HOUR, "Can you send me the deployment checklist?"],
      [tanvir, 19 * HOUR, "Sent it to your email. Ping me if anything's unclear"],
      [rafi, 45 * MINUTE, "Got it, thanks! One question about the rollback step"],
    ],
    { [tanvir]: 19 * HOUR, [rafi]: 45 * MINUTE }
  );

  // Group: all four members
  await writeChat(
    "demo-group-weekend-trip",
    {
      type: "group",
      name: "Weekend Trip",
      participantIds: [nadia, tanvir, rafi, sadia],
      createdBy: tanvir,
    },
    [
      [tanvir, 48 * HOUR, "Sreemangal this weekend? Train leaves 6:40 on Friday."],
      [nadia, 47 * HOUR, "I'm in! Tea gardens + seven-layer tea"],
      [rafi, 47 * HOUR - 10 * MINUTE, "Count me in, I'll book the tickets"],
      [sadia, 46 * HOUR, "Same here. Who's bringing the speaker?"],
      [tanvir, 46 * HOUR - 5 * MINUTE, "Got it covered 🔊"],
      [nadia, 2 * HOUR, "Found the view we talked about", { img: tea }],
      [rafi, 2 * HOUR - 6 * MINUTE, "Tickets booked: coach Ka, seats 21 to 24 ✅"],
      [sadia, 90 * MINUTE, "Legend. Meet at Kamalapur at 6:15?"],
    ],
    { [nadia]: 90 * MINUTE, [tanvir]: 90 * MINUTE, [rafi]: 90 * MINUTE, [sadia]: 90 * MINUTE }
  );

  // Tanvir has the group muted, to show private settings
  await db.doc(`userChats/${tanvir}`).set({
    prefs: { "demo-group-weekend-trip": { muted: true } },
  });

  console.log("Done. Demo accounts (password %s):", DEMO_PASSWORD);
  for (const person of PEOPLE.slice(0, 2)) {
    console.log(`  ${emailFor(person.key).padEnd(24)} ${person.username}`);
  }
};

seed().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
