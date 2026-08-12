# Codebase overview

React real-time chat app. Firebase handles auth, data, and avatar storage. Zustand holds the signed-in user and the active conversation.

For Firebase schemas and rules, see [firebase.md](./firebase.md).  
For conversation create/send/sync, see [chat-flow.md](./chat-flow.md).  
For backlog and remaining bugs, see [suggestions.md](./suggestions.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 18.3 + Vite 5 |
| State | Zustand 5 |
| Backend | Firebase 11 (Auth, Firestore, Storage) |
| UX helpers | react-toastify, emoji-picker-react |
| Styles | Plain CSS (per-component files) |

---

## Repository layout

```
src/
  App.jsx                 # Auth gate + layout shell
  main.jsx                # React entry
  lib/
    firebase.js           # Firebase app, db, auth, storage
    upload.js             # Avatar upload to Storage
    normalizeUser.js      # Ensures user.blocked is always an array
    userStore.js          # currentUser + fetchUserInfo
    chatStore.js          # active chat, block flags, details panel
  components/
    login/Login.jsx       # Sign in / sign up
    list/
      List.jsx            # Sidebar shell
      userInfo/UserInfo.jsx   # Avatar, name, logout
      chatList/
        ChatList.jsx      # Real-time chat list + search UI stub
        addUser/AddUser.jsx   # Username search + create chat
    chat/Chat.jsx         # Message thread + composer
    details/Details.jsx   # Partner info panel (toggle)
    notification/Notification.jsx  # Toast host
firestore.rules
storage.rules
Documentation/            # Product docs (this folder)
```

---

## Component hierarchy

```
App.jsx
├── Loading…                    (userStore.isLoading)
├── Login                       (!currentUser)
└── Authenticated shell         (currentUser)
    ├── List
    │   ├── UserInfo            (logout lives here)
    │   └── ChatList
    │       └── AddUser         (portal modal when addMode)
    ├── Chat                    (when chatId)
    └── Details                 (when chatId && showDetails)
└── Notification                (always)
```

`App` adds class `chat-open` on the container when a chat is selected (used for mobile layout).

---

## State management (Zustand)

### `userStore` (`src/lib/userStore.js`)

| Field / action | Role |
|----------------|------|
| `currentUser` | Normalized Firestore user profile |
| `isLoading` | True until first auth resolution |
| `fetchUserInfo(uid)` | Loads `users/{uid}`; clears user if missing/error |

### `chatStore` (`src/lib/chatStore.js`)

| Field / action | Role |
|----------------|------|
| `chatId` | Active conversation id |
| `user` | Chat partner profile |
| `isCurrentUserBlocked` | Partner has blocked me |
| `isReceiverBlocked` | I blocked partner |
| `showDetails` | Details panel visibility |
| `changeChat(chatId, user)` | Open chat; compute block flags; details closed |
| `changeBlock()` | Flip local `isReceiverBlocked` only (no Firestore write yet) |
| `toggleDetails()` | Show/hide Details |
| `closeChat()` / `resetChat()` | Clear chat state (back button / logout) |

Blocking checks use `normalizeUser` so missing `blocked` fields cannot crash `.includes()`.

---

## Application lifecycle

### 1. Boot (`App.jsx`)

1. Subscribe to `onAuthStateChanged`.
2. If no auth user → `resetChat()` + `fetchUserInfo(undefined)` → Login.
3. If auth user → `fetchUserInfo(uid)` → main UI when profile exists.
4. Auth user without a Firestore `users` doc → treated as logged out (`currentUser = null`).

### 2. Auth (`Login.jsx`)

**Sign in:** email/password → Auth session → boot path above.

**Sign up:**

1. `createUserWithEmailAndPassword`
2. Optional avatar → Storage (`upload.js`)
3. `users/{uid}` document
4. `userChats/{uid}` with `{ chats: [] }`
5. Toast success (user is already signed in by Auth)

UI toggles between sign-in and sign-up in one component (`mode` state).

### 3. Sidebar

- **UserInfo:** shows `currentUser`; **Log Out** calls `auth.signOut()`.
- **ChatList:** `onSnapshot` on `userChats/{currentUser.id}`, joins each `receiverId` to `users`, sorts by `updatedAt`.
- **AddUser:** portal dialog; search by exact username; creates `chats` + both `userChats` entries.

### 4. Conversation

- Selecting a list item → `changeChat` → `Chat` mounts.
- `Chat` listens to `chats/{chatId}`, sends via `arrayUnion` + sidebar sync for both users.
- Composer disabled when either block flag is true.
- Info icon → `toggleDetails` → `Details` shows partner from `chatStore.user`.
- Back button → `closeChat` (clears `chatId` for mobile list-first UI).

---

## Data flow (high level)

```
User action
    → React component
        → Zustand (optional) and/or Firestore/Auth/Storage
            → onSnapshot / store update
                → UI re-render
```

Real-time paths:

- Chat list: `userChats/{me}`
- Messages: `chats/{chatId}`

---

## Features that work today

- Email/password auth + session persistence
- Avatar upload on sign-up
- Username search and 1:1 chat creation
- Real-time chat list and messages
- Last-message preview + sort by `updatedAt`
- Emoji picker in composer
- Block-aware UI (flags from `blocked` arrays; send disabled)
- Details panel toggle; logout from sidebar
- Toast errors/success on main failure paths
- Firestore + Storage security rules in repo (signed-in only)

---

## Not implemented (UI often present)

- Chat-list text search
- Block user button writing to Firestore
- Image / camera / mic / phone / video actions
- Unread badges / mark-as-read when opening a chat
- Real message timestamps (UI shows placeholder “1 min ago”)
- Shared photos/files in Details

See [suggestions.md](./suggestions.md) for the prioritized backlog.

---

## Patterns worth copying

**Listener cleanup**

```javascript
useEffect(() => {
  const unSub = onSnapshot(...);
  return () => unSub();
}, [deps]);
```

**Zustand outside React** (auth logout / `changeChat`):

```javascript
useChatStore.getState().resetChat();
useUserStore.getState().currentUser;
```

**Safe user shape**

```javascript
normalizeUser(doc.data()); // blocked: [] if missing
```

---

## Summary

Small, feature-focused codebase: Auth gates the shell; `userChats` drives the sidebar; `chats` drives the thread; Zustand only tracks who you are and which conversation is open. Extend Firebase and chat-flow docs when you change those layers.
