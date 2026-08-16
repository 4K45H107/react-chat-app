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
| Types / tests | JSDoc (`src/types.js`) + Vitest |
| Styles | Plain CSS (per-component files) |

---

## Repository layout

```
src/
  App.jsx                 # Auth gate + layout shell + error boundary
  main.jsx                # React entry
  types.js                # JSDoc typedefs (AppUser, ChatMeta, ChatMessage)
  lib/
    firebase.js           # Firebase app, db (offline cache), auth, storage
    chatService.js        # createChat, sendMessage, delete, typing, listen/load
    presence.js           # lastActive heartbeat + isUserOnline
    notifications.js      # Browser Notification API helpers
    blockFlags.js         # Pure block-flag helper for changeChat / tests
    upload.js             # Image upload to Storage (images/{uid}/...)
    formatTime.js         # Message timestamp formatting
    normalizeUser.js      # Ensures user.blocked is always an array
    userStore.js          # currentUser + fetchUserInfo
    chatStore.js          # active chat, block flags, details panel
    __tests__/            # Vitest unit tests
  components/
    ErrorBoundary.jsx     # Authenticated shell crash recovery
    login/Login.jsx       # Sign in / sign up
    list/
      List.jsx            # Sidebar shell
      userInfo/UserInfo.jsx   # Avatar, name, logout
      chatList/
        ChatList.jsx      # Real-time chat list + search + notifications
        addUser/AddUser.jsx   # Username search + create chat
    chat/                  # Thread UI (orchestrator + hooks + panels)
      Chat.jsx             # Wires stores, hooks, send/edit/delete
      ChatHeader.jsx       # Partner/group header + call/search actions
      MessageList.jsx      # Scrollable thread + pagination hints
      MessageBubble.jsx    # Single message (text/image/audio/call/edit)
      ChatComposer.jsx     # Input, emoji, attach, mic, camera
      CameraCaptureOverlay.jsx
      hooks/               # Thread, typing, presence, voice, camera, search
      chat.css
    details/Details.jsx   # Partner info panel (toggle)
    notification/Notification.jsx  # Toast host
firebase.json             # Firestore/Storage rules deploy config
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
| `changeBlock()` | Flip local `isReceiverBlocked` (Details also writes Firestore) |
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
5. While signed in, bump `users/{uid}.lastActive` on an interval (presence heartbeat).

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
- **ChatList:** `onSnapshot` on `userChats/{currentUser.id}`, joins each `receiverId` to `users`, sorts by `updatedAt`, filters by search, styles unread rows.
- **AddUser:** portal dialog; search by exact username; creates `chats` + both `userChats` entries.

### 4. Conversation

- Selecting a list item → `changeChat` → `Chat` mounts.
- `Chat` listens to `chats/{chatId}/messages` (paginated) + typing; presence from partner `lastActive`.
- Sends via `sendMessage` + `syncSidebarPreview` for both users.
- Own messages can be soft-deleted; composer disabled when either block flag is true.
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
- Messages: `chats/{chatId}/messages`
- Typing: `chats/{chatId}.typing`
- Presence: `users/{partner}.lastActive`

---

## Features that work today

- Email/password auth + session persistence
- Sign-up validation (required fields, email/password rules) + unique usernames
- Avatar upload on sign-up (`images/{uid}/...`)
- Username search and 1:1 chat creation (no self-chat; no duplicate pair; create locked against double-clicks)
- Chat-list filter by username / last message + loading skeleton
- Real-time chat list and messages
- Text + **image** messages (upload, bubble, click to open)
- Soft-delete own messages
- Typing indicator + online status
- Browser notifications for unread chats (Notification API)
- Messages in `chats/{id}/messages` with scroll-up pagination
- Last-message preview + sort by `updatedAt`
- Mark as seen on open + unread list styling
- Message ids, relative timestamps, Enter to send
- Empty states (no chats, no search matches, no messages)
- Emoji picker in composer
- Block / unblock from Details (Firestore `blocked` + composer disabled)
- Details panel toggle; logout from sidebar
- Toast errors/success on main failure paths
- Error boundary around authenticated shell
- Participant-scoped Firestore rules + message field validation
- `chatService` helpers + Firestore offline persistent cache
- JSDoc core types + Vitest unit tests (`npm test`)
- Firestore + Storage rules in repo (`firebase.json` + deploy docs)

---

## Not implemented (UI often present)

- Camera / mic / phone / video actions
- Shared photos/files in Details
- Unread count badges / delivery ticks beyond bold rows
- FCM push when the tab is closed
- Profile settings (change avatar / username after sign-up)

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
