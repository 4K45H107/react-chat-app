# Chat flow

Main product feature: 1:1 conversations on Firestore with real-time listeners.

Data shapes and security rules: [firebase.md](./firebase.md).

---

## Architecture in one picture

Each conversation = **one shared `chats` doc** + **messages subcollection** + **one `userChats` entry per participant**.

```
Alice adds Bob
        │
        ▼
  chats/chat_xyz  { participantIds: [alice, bob] }
        │
        ├─ messages/{id} …
        ├─ userChats/alice  → { chatId, receiverId: bob, ... }
        └─ userChats/bob    → { chatId, receiverId: alice, ... }
```

Firestore access helpers: `src/lib/chatService.js`.

---

## Flow 1 — Create a chat (`AddUser.jsx` → `createChat`)

Triggered after an exact username search and clicking **+**.

1. Reject empty username; reject searching/adding yourself.
2. `hasExistingChatWith` — if own `userChats` already has this `receiverId`, toast and stop.
3. `createChat` → `chats/{newId}` with `participantIds` + both `userChats` entries.
4. Toast success; close modal; both clients’ `ChatList` snapshots refresh.

Guards:

- `handleAdd` no-ops if search has not produced a user (`!user?.id`).
- Sync `isAddingRef` + disabled **+** button while create is in flight (stops rapid double-click races).
- Escape / backdrop / × close the modal (`onClose` from `ChatList`), blocked while adding.

---

## Flow 2 — Chat list (`ChatList.jsx`)

```javascript
onSnapshot(doc(db, "userChats", currentUser.id), async (res) => {
  const items = res.data()?.chats ?? [];
  // for each item: getDoc(users/{receiverId}) → normalizeUser
  // drop missing/failed profiles
  // sort by updatedAt descending
  setChats(...);
});
```

- Search input filters loaded chats by username / lastMessage (client-side).
- Click item → `handleSelectChat` → `changeChat(chat.chatId, chat.user)`.
- Rows with `isSeen === false` get an `unread` class (bold preview).
- Empty list / empty search copy when there is nothing to show.

---

## Flow 3 — Open a conversation (`chatStore.changeChat`)

1. Normalize current user + partner.
2. Set `chatId`, `user`, `showDetails: false`.
3. Block flags:
   - Partner’s `blocked` includes me → `isCurrentUserBlocked`
   - My `blocked` includes partner → `isReceiverBlocked`
4. `App.jsx` renders `<Chat />` when `chatId` is set; `<Details />` only if `showDetails` is also true.

`Chat` header and `Details` both read the partner from `chatStore.user` (not hardcoded).

Mobile back: `closeChat()` clears the store so the list is primary again. Logout: `resetChat()` from `onAuthStateChanged` when session ends.

---

## Flow 4 — Send a message (`Chat.jsx` → `sendMessage`)

Skipped if text empty, no partner, or either block flag is set.

**Step A — message doc**

```javascript
await sendMessage({ chatId, senderId, text, img? });
// → setDoc(chats/{chatId}/messages/{id}, { id, senderId, text, img?, createdAt })
```

Composer: **Enter** sends text; **Shift+Enter** reserved for future multiline. Image icon → Storage upload → message with optional `img` + caption; sidebar preview uses caption or `"Photo"`.

**Step B — both sidebars** via `syncSidebarPreview` (same lastMessage / isSeen / updatedAt behavior as before).

Opening a chat calls `markChatAsSeen`. Unread rows are styled in `ChatList`.

Empty thread (no messages, not blocked) shows “No messages yet…” copy.

---

## Flow 5 — Live messages + pagination (`Chat.jsx`)

```javascript
listenLatestMessages(chatId, { onData }); // newest 30, orderBy createdAt desc
// scroll near top → loadOlderMessages(chatId, oldestDoc)
```

On open, `migrateLegacyMessages` moves any old `messages[]` array into the subcollection. Auto-scroll sticks to the bottom unless the user has scrolled up.

---

## Blocking behavior (client)

| Situation | UI / data |
|-----------|-----------|
| Either block flag true | Banner in thread; composer + send + emoji disabled |
| Details **Block User** | `arrayUnion` partner id onto `users/{me}.blocked`; set `isReceiverBlocked` |
| Details **Unblock User** | `arrayRemove` partner id; clear `isReceiverBlocked` |

Block state is owned by the current user’s `blocked` array (rules only allow updating your own `users` doc). Partner “blocked me” still comes from their profile when opening the chat.

---

## Visual summary

```
CREATE                          SEND
─────                           ────
+ on user                       Send
  → chats/{id}                    → arrayUnion message on chats/{id}
  → userChats both sides          → patch lastMessage / isSeen / updatedAt
  → list snapshot                 → both chats + both lists update via snapshot
```

---

## Switching conversations

1. Click another list row → `changeChat` (details closes).
2. `Chat` effect depends on `chatId` → new `onSnapshot`.
3. Previous listener unsubscribes on cleanup.

Conversations stay isolated by `chatId`; metadata stays per-user in `userChats`.

---

## Summary

- Shared messages in `chats`; personal list metadata in `userChats`.
- Create from Add User; open from ChatList; send updates thread + both sidebars.
- Real-time via document snapshots; Zustand only holds the active chat selection and block/details flags.
