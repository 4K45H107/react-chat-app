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

There is a `firebase.json` in the repo that points at `firestore.rules` and `storage.rules`.

### Deploy rules (CLI)

```bash
# One-time: npm i -g firebase-tools && firebase login
firebase use reactchat-ed5f2   # or select the project when prompted
firebase deploy --only firestore:rules,storage
```

Or deploy one service:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Rules in git are not live until you deploy them to the Firebase project.

---

## Firestore collections

Firestore is document/collection based (not SQL tables). This app uses three top-level collections plus a messages subcollection. Client helpers live in `src/lib/chatService.js`. Offline cache is enabled via `persistentLocalCache` in `firebase.js`.

### 1. `users/{userId}`

Document ID = Firebase Auth UID.

```javascript
{
  id: "user_uid",           // same as document ID
  username: "Alice",
  email: "alice@example.com",
  avatar: "https://...",    // Storage download URL, or ""
  blocked: ["other_uid"],   // user IDs this user blocked
  lastActive: Timestamp     // heartbeat while signed in (presence)
}
```

| Field | Notes |
|-------|--------|
| `username` | Exact-match search in Add User (`where("username", "==", username)`) |
| `blocked` | Used by `chatStore.changeChat` to set block flags |
| `avatar` | Set at sign-up via Storage upload |
| `lastActive` | Bumped from `App.jsx` via `presence.js`; header shows Online |

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
      isSeen: false             // false for receiver on send; set true when they open the chat
    }
  ]
}
```

Created empty (`chats: []`) at sign-up. Updated when:

- A chat is created (`createChat` in `chatService.js`)
- A message is sent (`syncSidebarPreview`)
- A chat is opened (`markChatAsSeen`)

Listened with `onSnapshot` in `ChatList.jsx` (also drives browser notifications for newly unread previews).

### 3. `chats/{chatId}`

Shared conversation metadata. ID is auto-generated.

```javascript
{
  createdAt: Timestamp,
  participantIds: ["uid_a", "uid_b"],  // used by security rules
  typing: {                             // optional short-lived typing signal
    userId: "uid_a",
    updatedAt: 1712345678901
  }
}
```

### 4. `chats/{chatId}/messages/{messageId}`

One document per message (paginated in the client).

```javascript
{
  id: "uuid",             // same as document ID
  senderId: "user_uid",   // must equal auth.uid on create
  text: "Hello!",         // string, max 2000 chars (may be "")
  img: "https://...",     // optional (cleared on soft-delete)
  deleted: true,          // optional; soft-delete by sender
  createdAt: Timestamp    // serverTimestamp() on send
}
```

`Chat.jsx` listens to the newest page (`orderBy createdAt desc`, limit 30) and loads older pages on scroll-up. Opening a chat migrates any legacy `messages[]` array on the parent doc into this subcollection. Own messages can be soft-deleted (`deleteMessage`).

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
               messages/{id}
```

- One `chats` doc holds metadata (`participantIds`); messages are a subcollection.
- Each participant has their own `userChats` entry with the same `chatId` and a different `receiverId`.

Details and step-by-step flows: [chat-flow.md](./chat-flow.md).

---

## Cloud Storage

| Path | Purpose |
|------|---------|
| `images/{uid}/{timestamp}_{filename}` | Avatars + chat images (`upload.js` with `{ uid }`) |
| `images/{filename}` (legacy) | Older uploads — **read-only** under current rules |

Flow on sign-up / image send:

1. `upload(file, { uid })` → `uploadBytesResumable` under `images/{uid}/...` → `getDownloadURL`
2. Avatar URL → `users/{uid}.avatar`
3. Chat image URL → message `img` field

Composer camera / mic buttons are not wired yet.

---

## Authentication

| Action | API | Side effects |
|--------|-----|----------------|
| Sign in | `signInWithEmailAndPassword` | `onAuthStateChanged` → `fetchUserInfo` |
| Sign up | `createUserWithEmailAndPassword` | Unique username check (then `users` + `userChats`); optional avatar upload |
| Session | `onAuthStateChanged` in `App.jsx` | Loads profile; on logout calls `resetChat()` |
| Sign out | `auth.signOut()` in `UserInfo.jsx` | Clears auth → login screen |

No social providers, password reset, or email verification yet.

---

## Security rules (current)

### Firestore (`firestore.rules`)

```
users/{userId}
  read: signed-in; create/update: owner

userChats/{userId}
  read: signed-in; create: owner
  update: owner OR signed-in patch that only changes `chats`

chats/{chatId}
  create: signed-in creator in participantIds (size 2)
  read/update: participant (legacy docs without participantIds still open)
  messages/{messageId}
    read: chat participant
    create: participant + senderId == auth.uid + field validation
    update: sender soft-delete only (deleted == true, text cleared)
    delete: denied
```

### Storage (`storage.rules`)

```
images/{userId}/**   read: signed-in; write: owner uid + image/* + <5MB
images/{fileName}    read: signed-in; write: denied (legacy)
```

Deploy after changing rules files (`firebase deploy --only firestore:rules,storage`).

---

## Important SDK patterns used

| Pattern | Where |
|---------|--------|
| `onSnapshot(doc(...))` | Chat list + open conversation (real-time) |
| `arrayUnion` | New chat metadata; new messages |
| `getDoc` / `getDocs` + `query` / `where` | Receiver profiles; username search |
| `serverTimestamp()` | Chat create time (`createdAt`) |
| `uploadBytesResumable` | Avatar upload |

---

## Indexes

Current queries are simple:

- Document gets by ID
- Single-field equality: `username == value`

No composite indexes are required for the current code. Add indexes if you later filter/sort on multiple fields (e.g. username + createdAt).

---

## Quirks and limits to know

1. **Username uniqueness:** enforced in the client after Auth create (rules require auth to read `users`); roll back deletes the Auth user if the name is taken. Not enforced in security rules.
2. **Legacy chat docs:** may lack `participantIds` (rules stay open for those) or still have a `messages[]` array (migrated on open).
3. **Env:** only `VITE_API_KEY` is externalized; other Firebase config fields are hardcoded in `firebase.js`.
4. **Rules must be deployed** for production to match the repo.

Duplicate 1:1 chats are blocked in the client (existing `receiverId` check + sync create lock). Not enforced in security rules.

---

## File map

| File | Role |
|------|------|
| `src/lib/firebase.js` | Init + persistent cache + exports |
| `src/lib/chatService.js` | createChat, sendMessage, delete, typing, listen/load |
| `src/lib/presence.js` | `lastActive` heartbeat + online check |
| `src/lib/notifications.js` | Browser Notification API helpers |
| `src/lib/upload.js` | Storage helper |
| `src/lib/formatTime.js` | Relative/absolute message timestamps |
| `src/lib/userStore.js` | Load `users/{uid}` |
| `src/lib/chatStore.js` | Active chat + block flags (client-side) |
| `src/types.js` | JSDoc typedefs for User / ChatMeta / Message |
| `src/components/login/Login.jsx` | Auth + initial Firestore docs |
| `src/components/list/chatList/*` | `userChats` listen + create chat + notify |
| `src/components/chat/Chat.jsx` | Messages subcollection + pagination |
| `firestore.rules` / `storage.rules` | Access control |
