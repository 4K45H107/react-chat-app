# Chat flow

Main product feature: 1:1 conversations on Firestore with real-time listeners.

Data shapes and security rules: [firebase.md](./firebase.md).

---

## Architecture in one picture

Each conversation = **one shared `chats` document** + **one `userChats` entry per participant**.

```
Alice adds Bob
        │
        ▼
  chats/chat_xyz  { messages: [] }
        │
        ├─ userChats/alice  → { chatId, receiverId: bob, ... }
        └─ userChats/bob    → { chatId, receiverId: alice, ... }
```

---

## Flow 1 — Create a chat (`AddUser.jsx`)

Triggered after an exact username search and clicking **+**.

1. Create `chats/{newId}` with empty `messages` (and `creterdAt` — typo; see suggestions).
2. `arrayUnion` onto **receiver’s** `userChats`: `receiverId = currentUser.id`.
3. `arrayUnion` onto **current user’s** `userChats`: `receiverId = other user’s id`.
4. Toast success; both clients’ `ChatList` snapshots refresh.

Guards:

- `handleAdd` no-ops if search has not produced a user (`!user?.id`).
- Escape / backdrop / × close the modal (`onClose` from `ChatList`).

No check yet for “chat with this user already exists” — duplicate adds create extra threads.

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

- Search input in the list header is UI-only (does not filter).
- Click item → `handleSelectChat` → `changeChat(chat.chatId, chat.user)`.

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

## Flow 4 — Send a message (`Chat.jsx` → `handleSend`)

Skipped if text empty, no partner, or either block flag is set.

**Step A — shared thread**

```javascript
await updateDoc(doc(db, "chats", chatId), {
  messages: arrayUnion({
    senderId: currentUser.id,
    text,
    createdAt: new Date(),
  }),
});
```

**Step B — both sidebars**

For each of `[currentUser.id, user.id]`:

1. `getDoc(userChats/{participantId})`
2. Find entry where `chatId` matches
3. Set `lastMessage`, `updatedAt = Date.now()`, `isSeen = (participantId === currentUser.id)`
4. `updateDoc` that participant’s `chats` array

Sender’s sidebar entry is marked seen; receiver’s is not. Opening a chat does **not** clear `isSeen` yet, and the list UI does not style unread rows.

Failures on a single sidebar update are logged; the message may still exist in `chats`.

---

## Flow 5 — Live message updates (`Chat.jsx`)

```javascript
useEffect(() => {
  const unsub = onSnapshot(doc(db, "chats", chatId), (res) => {
    setChat(res.data());
  });
  return () => unsub();
}, [chatId]);
```

Changing conversations remounts the listener for the new `chatId`. The message list auto-scrolls when `chat.messages` changes.

---

## Blocking behavior (client)

| Situation | UI |
|-----------|-----|
| Either block flag true | Banner in thread; composer + send + emoji disabled |
| Details “Block User” | Button only — does **not** write `users.blocked` or call `changeBlock` |

`changeBlock` in the store flips local `isReceiverBlocked` only; nothing calls it from the UI yet.

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
