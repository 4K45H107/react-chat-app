# Firebase

Backend for this app. All client access goes through the Firebase Web SDK in `src/lib/firebase.js`.

**Project ID:** `reactchat-ed5f2`

---

## Services in use

| Service | SDK export | Used for |
|---------|------------|----------|
| **Authentication** | `auth` | Email/password sign-up and sign-in; session via `onAuthStateChanged` |
| **Cloud Firestore** | `db` | Users, chat threads, per-user chat lists |
| **Cloud Storage** | `storage` | Avatar images on registration |

Not used today: Cloud Functions, Realtime Database, Cloud Messaging (FCM), Analytics, Hosting (optional for deploy).

---

## Client setup

```javascript
// src/lib/firebase.js
apiKey: import.meta.env.VITE_API_KEY   // only secret-ish value from .env
authDomain: "reactchat-ed5f2.firebaseapp.com"
projectId: "reactchat-ed5f2"
storageBucket: "reactchat-ed5f2.appspot.com"
```

Exports: `db`, `auth`, `storage`.

Local env:

```bash
VITE_API_KEY=<firebase web api key>
```

Rules live in the repo:

- `firestore.rules`
- `storage.rules`

There is no `firebase.json` in the repo yet — deploy rules with the Firebase CLI once that config is added.

---

## Firestore collections

Firestore is document/collection based (not SQL tables). This app uses three collections.

### 1. `users/{userId}`

Document ID = Firebase Auth UID.

```javascript
{
  id: "user_uid",           // same as document ID
  username: "Alice",
  email: "alice@example.com",
  avatar: "https://...",    // Storage download URL, or ""
  blocked: ["other_uid"]    // user IDs this user blocked
}
```

| Field | Notes |
|-------|--------|
| `username` | Exact-match search in Add User (`where("username", "==", username)`) |
| `blocked` | Used by `chatStore.changeChat` to set block flags |
| `avatar` | Set at sign-up via Storage upload |

Written on register (`Login.jsx`). Read by auth bootstrap (`userStore`), chat list (receiver profiles), and username search.

`normalizeUser()` in `src/lib/normalizeUser.js` guarantees `blocked` is always an array when loaded into the app.

### 2. `userChats/{userId}`

Document ID = Firebase Auth UID. One document per user: their sidebar chat list.

```javascript
{
  chats: [
    {
      chatId: "chat_abc",       // points at chats/{chatId}
      receiverId: "other_uid",  // the other person from THIS user's view
      lastMessage: "Hello!",
      updatedAt: 1712345678901, // number (Date.now()) — used for sort
      isSeen: false             // set on send; not yet shown / cleared on open
    }
  ]
}
```

Created empty (`chats: []`) at sign-up. Updated when:

- A chat is created (`AddUser.jsx` — `arrayUnion` on both users)
- A message is sent (`Chat.jsx` — updates both participants’ entries)

Listened with `onSnapshot` in `ChatList.jsx`.

### 3. `chats/{chatId}`

Shared conversation document. ID is auto-generated (`doc(collection(db, "chats"))`).

```javascript
{
  creterdAt: Timestamp,   // typo in code — should be createdAt (see suggestions)
  messages: [
    {
      senderId: "user_uid",
      text: "Hello!",
      createdAt: Date        // client Date; stored as Timestamp in Firestore
    }
  ]
}
```

Messages live in a single array on the document (`arrayUnion` on send). Fine for small threads; will not scale well without pagination / subcollections.

Listened with `onSnapshot` in `Chat.jsx`.

---

## How the three collections relate

```
users/alice          users/bob
       \                /
        \              /
     userChats/alice   userChats/bob
        chats[]           chats[]
           \                /
            \              /
             chats/chat_xyz
               messages[]
```

- One `chats` doc holds the full message history.
- Each participant has their own `userChats` entry with the same `chatId` and a different `receiverId`.

Details and step-by-step flows: [chat-flow.md](./chat-flow.md).

---

## Cloud Storage

| Path | Purpose |
|------|---------|
| `images/{Date + filename}` | Avatars uploaded in `src/lib/upload.js` |

Flow on sign-up:

1. `createUserWithEmailAndPassword`
2. `upload(file)` → `uploadBytesResumable` → `getDownloadURL`
3. URL stored on `users/{uid}.avatar`

Chat image / camera / mic buttons in the UI are not wired to Storage yet.

---

## Authentication

| Action | API | Side effects |
|--------|-----|----------------|
| Sign in | `signInWithEmailAndPassword` | `onAuthStateChanged` → `fetchUserInfo` |
| Sign up | `createUserWithEmailAndPassword` | Create `users` + `userChats` docs; optional avatar upload |
| Session | `onAuthStateChanged` in `App.jsx` | Loads profile; on logout calls `resetChat()` |
| Sign out | `auth.signOut()` in `UserInfo.jsx` | Clears auth → login screen |

No social providers, password reset, or email verification yet.

---

## Security rules (current)

### Firestore (`firestore.rules`)

```
users/{userId}
  read:   any signed-in user
  create/update: only owner (auth.uid == userId)

userChats/{userId}
  read:   any signed-in user
  create: only owner
  update: any signed-in user   // needed so sender can update receiver's lastMessage

chats/{chatId}
  read/write: any signed-in user
```

### Storage (`storage.rules`)

```
images/**
  read/write: any signed-in user
```

These stop anonymous access but are still loose: any signed-in user can read all profiles and chat docs, and update any `userChats` / `chats` document. Tighten before a public launch (participant checks, field-level validation, Storage path ownership).

---

## Important SDK patterns used

| Pattern | Where |
|---------|--------|
| `onSnapshot(doc(...))` | Chat list + open conversation (real-time) |
| `arrayUnion` | New chat metadata; new messages |
| `getDoc` / `getDocs` + `query` / `where` | Receiver profiles; username search |
| `serverTimestamp()` | Chat create time (field currently misspelled `creterdAt`) |
| `uploadBytesResumable` | Avatar upload |

---

## Indexes

Current queries are simple:

- Document gets by ID
- Single-field equality: `username == value`

No composite indexes are required for the current code. Add indexes if you later filter/sort on multiple fields (e.g. username + createdAt).

---

## Quirks and limits to know

1. **Typo:** new chats write `creterdAt`, not `createdAt`. App does not read that field today.
2. **Messages as arrays:** whole message list is rewritten/unioned on one document — cost and size grow with history.
3. **`isSeen`:** written on send; UI does not show unread badges or mark read on open.
4. **Username uniqueness:** search is exact match only; sign-up does not enforce unique usernames.
5. **Duplicate chats:** adding the same user twice creates another `chats` doc (no “already chatting” check).
6. **Env:** only `VITE_API_KEY` is externalized; other Firebase config fields are hardcoded in `firebase.js`.

---

## File map

| File | Role |
|------|------|
| `src/lib/firebase.js` | Init + exports |
| `src/lib/upload.js` | Storage helper |
| `src/lib/userStore.js` | Load `users/{uid}` |
| `src/lib/chatStore.js` | Active chat + block flags (client-side) |
| `src/components/login/Login.jsx` | Auth + initial Firestore docs |
| `src/components/list/chatList/*` | `userChats` listen + create chat |
| `src/components/chat/Chat.jsx` | `chats` listen + send |
| `firestore.rules` / `storage.rules` | Access control |
