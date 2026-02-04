# Chat and conversation management

## Data architecture

The app uses a three-layer structure:

### 1. Users collection (`users`)
```javascript
{
  id: "user_123",
  username: "Alice",
  email: "alice@example.com",
  avatar: "https://...",
  blocked: [] // Array of blocked user IDs
}
```

### 2. Chats collection (`chats`) — shared conversation data
```javascript
{
  createdAt: Timestamp,
  messages: [
    {
      senderId: "user_123",
      text: "Hello!",
      createdAt: Date
    },
    {
      senderId: "user_456",
      text: "Hi there!",
      createdAt: Date
    }
  ]
}
```

### 3. UserChats collection (`userChats`) — per-user chat list/metadata
```javascript
// Document ID = user's ID
{
  chats: [
    {
      chatId: "chat_abc123",      // Reference to chats collection
      receiverId: "user_456",      // Other user in this chat
      lastMessage: "Hi there!",    // Last message preview
      updatedAt: 1234567890,       // Timestamp for sorting
      isSeen: false                // Read status
    }
  ]
}
```

---

## How conversations are managed

### Concept: one chat document, two userChats entries

Each conversation has:
- One document in `chats` (shared messages)
- Two entries in `userChats` (one per user)

Example: Alice (user_123) and Bob (user_456)

```
chats/chat_abc123:
  messages: [all messages between Alice and Bob]

userChats/user_123:
  chats: [
    { chatId: "chat_abc123", receiverId: "user_456", ... }
  ]

userChats/user_456:
  chats: [
    { chatId: "chat_abc123", receiverId: "user_123", ... }
  ]
```

---

## Flow 1: Creating a new chat

### Step-by-step (`AddUser.jsx` → `handleAdd`)

```javascript
// User Alice searches for "Bob" and clicks "+"
```

1. Create chat document
   ```javascript
   const newChatRef = doc(chatRef); // Generates unique ID: "chat_xyz789"
   await setDoc(newChatRef, {
     createdAt: serverTimestamp(),
     messages: [] // Empty initially
   });
   ```

2. Add chat to Bob's userChats
   ```javascript
   // Bob's perspective: Alice is the receiver
   await updateDoc(doc(userChatRef, user.id), { // user.id = Bob's ID
     chats: arrayUnion({
       chatId: "chat_xyz789",
       receiverId: currentUser.id,  // Alice's ID
       lastMessage: "",
       updatedAt: Date.now()
     })
   });
   ```

3. Add chat to Alice's userChats
   ```javascript
   // Alice's perspective: Bob is the receiver
   await updateDoc(doc(userChatRef, currentUser.id), { // Alice's ID
     chats: arrayUnion({
       chatId: "chat_xyz789",
       receiverId: user.id,  // Bob's ID
       lastMessage: "",
       updatedAt: Date.now()
     })
   });
   ```

Result:
- Both users see the chat in their lists
- Same `chatId`, different `receiverId` per user
- Chat appears immediately via real-time listener

---

## Flow 2: Displaying chat list

### Process (`ChatList.jsx`)

```javascript
useEffect(() => {
  // Real-time listener on current user's userChats document
  const unSub = onSnapshot(
    doc(db, "userChats", currentUser.id),
    async (res) => {
      const items = res.data().chats; // Array of chat metadata
      
      // For each chat, fetch the receiver's user info
      const promises = items.map(async (item) => {
        const userDocRef = doc(db, "users", item.receiverId);
        const userDocSnap = await getDoc(userDocRef);
        const user = userDocSnap.data();
        return { ...item, user }; // Combine chat metadata + user info
      });
      
      const chatList = await Promise.all(promises);
      // Sort by updatedAt (newest first)
      setChats(chatList.sort((a, b) => b.updatedAt - a.updatedAt));
    }
  );
}, [currentUser.id]);
```

What happens:
1. Listens to `userChats/{currentUser.id}`
2. On change, fetches receiver info for each chat
3. Combines metadata with user data
4. Sorts by `updatedAt` (newest first)
5. Updates UI automatically

---

## Flow 3: Opening a conversation

### Process (`ChatList.jsx` → `handleSearch`)

```javascript
const handleSearch = async (chat) => {
  changeChat(chat.chatId, chat.user);
};
```

`changeChat` in `chatStore.js`:
1. Checks blocking status
2. Sets active chat state:
   ```javascript
   set({
     chatId: "chat_xyz789",
     user: { id: "user_456", username: "Bob", ... },
     isCurrentUserBlocked: false,
     isReceiverBlocked: false
   });
   ```

`App.jsx` renders Chat when `chatId` exists:
```javascript
{chatId && <Chat />}
{chatId && <Details />}
```

---

## Flow 4: Sending messages

### Process (`Chat.jsx` → `handleSend`)

### Step 1: Add message to shared chat document
```javascript
await updateDoc(doc(db, "chats", chatId), {
  messages: arrayUnion({
    senderId: currentUser.id,
    text: "Hello Bob!",
    createdAt: new Date()
  })
});
```

### Step 2: Update both users' userChats
```javascript
const userIDs = [currentUser.id, user.id]; // [Alice, Bob]

userIDs.forEach(async (id) => {
  const userChatsRef = doc(db, "userChats", currentUser.id);
  const userChatSnapShot = await getDoc(userChatsRef);
  const userChatsData = userChatSnapShot.data();
  
  // Find the chat in the array
  const chatIndex = userChatsData.chats.findIndex(
    (c) => c.chatId === chatId
  );
  
  // Update metadata
  userChatsData.chats[chatIndex].lastMessage = text;
  userChatsData.chats[chatIndex].isSeen = 
    id === currentUser.id ? true : false; // Sender sees it, receiver doesn't
  userChatsData.chats[chatIndex].updatedAt = Date.now();
  
  await updateDoc(userChatsRef, {
    chats: userChatsData.chats
  });
});
```

Note: There's a bug here — it always updates `currentUser.id` instead of `id` in the loop. It should update both users' documents.

---

## Flow 5: Real-time message updates

### Process (`Chat.jsx`)

```javascript
useEffect(() => {
  // Listen to the shared chat document
  const unsub = onSnapshot(doc(db, "chats", chatId), (res) => {
    setChat(res.data()); // Updates when new messages arrive
  });
  
  return () => unsub();
}, [chatId]);
```

What happens:
1. Listens to `chats/{chatId}`
2. On new message, updates local state
3. UI re-renders with new messages
4. Both users see updates in real time

---

## Visual flow diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CREATING A NEW CHAT                       │
└─────────────────────────────────────────────────────────────┘

Alice clicks "+" on Bob
         │
         ▼
┌────────────────────┐
│ 1. Create chat doc │  chats/chat_xyz789 { messages: [] }
└────────┬───────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌────────────────────┐              ┌────────────────────┐
│ 2. Add to Alice's  │              │ 3. Add to Bob's     │
│    userChats       │              │    userChats        │
└────────────────────┘              └────────────────────┘
  chatId: "chat_xyz789"                chatId: "chat_xyz789"
  receiverId: "bob_id"                 receiverId: "alice_id"

         │
         ▼
┌────────────────────┐
│ Real-time listener │  Both users see new chat in list
│ updates UI        │
└────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│                    SENDING A MESSAGE                         │
└─────────────────────────────────────────────────────────────┘

Alice types "Hello!" and clicks Send
         │
         ▼
┌────────────────────┐
│ 1. Add to messages │  chats/chat_xyz789.messages.push({
│    array           │    senderId: "alice_id",
└────────┬───────────┘    text: "Hello!",
         │                createdAt: Date
         │              })
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌────────────────────┐              ┌────────────────────┐
│ 2. Update Alice's  │              │ 3. Update Bob's     │
│    userChats       │              │    userChats        │
└────────────────────┘              └────────────────────┘
  lastMessage: "Hello!"                lastMessage: "Hello!"
  isSeen: true                        isSeen: false
  updatedAt: now                      updatedAt: now

         │
         ▼
┌────────────────────┐
│ Real-time listener │  Both users see new message
│ updates UI        │  Chat list shows "Hello!" preview
└────────────────────┘
```

---

## Key concepts

### 1. Chat ID as shared reference
- Same `chatId` links both users' entries
- One `chats` document contains all messages
- Each user has their own metadata entry

### 2. Receiver ID perspective
- Alice's entry: `receiverId: "bob_id"`
- Bob's entry: `receiverId: "alice_id"`
- Enables showing the other user's info

### 3. Last message tracking
- Stored in `userChats` (not `chats`)
- Updated on each send
- Used for preview and sorting

### 4. Sorting mechanism
- Sorted by `updatedAt` (newest first)
- Updated when a message is sent
- Keeps active chats at the top

### 5. Read status (`isSeen`)
- `true` for sender, `false` for receiver
- Updated when a message is sent
- Could be extended to mark as read when viewed

---

## Switching between conversations

1. User clicks a chat in the list
2. `changeChat(chatId, user)` updates `chatStore`
3. `Chat` component re-renders with new `chatId`
4. New `onSnapshot` listener attaches to the new chat
5. Messages load and display in real time

Each conversation is isolated:
- Each chat has its own `chatId`
- Each chat has its own listener
- Switching chats changes the active `chatId` and loads that chat's messages

---

## Data relationships summary

```
User (Alice)
  │
  ├── userChats/alice_id
  │     └── chats: [
  │           {
  │             chatId: "chat_1" ──────┐
  │             receiverId: "bob_id"   │
  │             lastMessage: "..."     │
  │           },                        │
  │           {                         │
  │             chatId: "chat_2" ───┐  │
  │             receiverId: "carol_id" │
  │           }                      │  │
  │         ]                        │  │
  │                                  │  │
  └── chats/chat_1 ◄────────────────┘  │
        messages: [...]                 │
                                        │
  chats/chat_2 ◄────────────────────────┘
        messages: [...]
```

---

## Summary

- One shared `chats` document per conversation
- Two `userChats` entries (one per user) with metadata
- Real-time updates via Firestore listeners
- Messages stored in arrays, metadata tracked separately
- Chat list sorted by `updatedAt` (newest first)

This design supports multiple concurrent conversations, real-time updates, and efficient chat list management.