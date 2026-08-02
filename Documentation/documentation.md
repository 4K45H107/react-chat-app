# Complete Codebase Explanation

## Architecture overview

React chat app using Firebase as the backend. Real-time messaging with authentication, chat management, and file uploads.

---

## Tech stack

- Frontend: React 18.3.1 + Vite
- State management: Zustand
- Backend: Firebase (Auth, Firestore, Storage)
- UI: React Toastify, Emoji Picker React
- Styling: Plain CSS with nesting

---

## Firebase data structure

### Collections:

1. `users` (Firestore)
   ```javascript
   {
     id: "user_uid",
     username: "John Doe",
     email: "john@example.com",
     avatar: "https://...",
     blocked: [] // Array of user IDs
   }
   ```

2. `userChats` (Firestore)
   ```javascript
   {
     chats: [
       {
         chatId: "chat_123",
         receiverId: "other_user_id",
         lastMessage: "Hello!",
         updatedAt: 1234567890,
         isSeen: false
       }
     ]
   }
   ```

3. `chats` (Firestore)
   ```javascript
   {
     createdAt: Timestamp,
     messages: [
       {
         senderId: "user_id",
         text: "Hello!",
         createdAt: Date
       }
     ]
   }
   ```

4. `images/` (Storage)
   - User avatars stored as: `images/{timestamp}{filename}`

---

## Component hierarchy

```
App.jsx (Root)
├── Login.jsx (if not authenticated)
└── Main Layout (if authenticated)
    ├── List.jsx (Sidebar)
    │   ├── UserInfo.jsx (Current user info)
    │   └── ChatList.jsx (List of chats)
    │       └── AddUser.jsx (Search & add users)
    ├── Chat.jsx (Chat interface - shown when chatId exists)
    └── Details.jsx (User details panel - shown when chatId exists)
└── Notification.jsx (Toast notifications - always rendered)
```

---

## State management (Zustand stores)

### 1. `userStore.js` — Current user state
```javascript
{
  currentUser: null,        // Full user object from Firestore
  isLoading: true,          // Loading state
  fetchUserInfo(uid)        // Fetches user from Firestore
}
```

### 2. `chatStore.js` — Active chat state
```javascript
{
  chatId: null,             // Current chat ID
  user: null,               // Other user in chat
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
  changeChat(chatId, user)  // Sets active chat + checks blocking
  changeBlock()             // Toggles block status
}
```

---

## Application flow

### Phase 1: Initialization (`main.jsx` → `App.jsx`)

1. App mounts
2. `App.jsx` sets up `onAuthStateChanged` listener
3. On auth change:
   - If user exists → calls `fetchUserInfo(uid)`
   - If no user → sets `currentUser = null`

### Phase 2: Authentication (`Login.jsx`)

#### Sign In:
```javascript
1. User enters email/password
2. signInWithEmailAndPassword() → Firebase Auth
3. onAuthStateChanged triggers → fetchUserInfo() → App shows main UI
```

#### Sign Up:
```javascript
1. User enters username, email, password, avatar
2. createUserWithEmailAndPassword() → Creates auth user
3. upload(avatar) → Uploads to Firebase Storage → Returns URL
4. setDoc("users", uid) → Creates user document in Firestore
5. setDoc("userChats", uid) → Creates empty chat list
6. User is automatically signed in → App shows main UI
```

### Phase 3: Main application

#### A. List component (`List.jsx`)
- Renders `UserInfo` (current user) and `ChatList` (chats)

#### B. UserInfo component (`UserInfo.jsx`)
- Displays current user avatar and username from `userStore`

#### C. ChatList component (`ChatList.jsx`)
```javascript
1. useEffect sets up onSnapshot listener on "userChats/{currentUser.id}"
2. When chats change:
   - Maps through chats array
   - Fetches receiver user info from "users" collection
   - Sorts by updatedAt (newest first)
   - Updates local state
3. User clicks a chat → calls changeChat(chatId, user)
4. Shows AddUser component when addMode is true
```

#### D. AddUser component (`AddUser.jsx`)
```javascript
1. User searches by username → Query Firestore "users" collection
2. Shows found user
3. User clicks "+" → handleAdd():
   - Creates new chat document in "chats" collection
   - Updates both users' "userChats" with new chat entry
   - Chat appears in both users' chat lists
```

#### E. Chat component (`Chat.jsx`)
```javascript
1. Only renders when chatId exists (from chatStore)
2. useEffect sets up onSnapshot on "chats/{chatId}"
3. Real-time updates when messages change
4. handleSend():
   - Adds message to "chats/{chatId}.messages" array
   - Updates both users' "userChats" with:
     - lastMessage
     - updatedAt
     - isSeen (true for sender, false for receiver)
5. Emoji picker integration
6. Auto-scrolls to bottom on new messages
```

#### F. Details component (`Details.jsx`)
- Shows user details panel
- Logout button → `auth.signOut()` → Returns to Login

---

## Data flow diagram

```
┌─────────────┐
│   User      │
│  Action     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  React Component│────▶│ Zustand Store│────▶│  Firebase   │
│                 │◀────│              │◀────│             │
└─────────────────┘     └──────────────┘     └─────────────┘
       │                        │                     │
       │                        │                     │
       ▼                        ▼                     ▼
┌─────────────┐         ┌──────────────┐     ┌─────────────┐
│     UI      │         │  State      │     │  Database   │
│   Updates   │         │  Updates    │     │  Updates    │
└─────────────┘         └──────────────┘     └─────────────┘
```

---

## Key features

### 1. Real-time updates
- `onSnapshot` listeners on Firestore documents
- Chat list and messages update automatically

### 2. User blocking
- `changeChat()` checks if either user is blocked
- Blocks chat if blocked

### 3. Last message tracking
- Updates `lastMessage` and `updatedAt` in `userChats`
- Chat list sorted by `updatedAt`

### 4. Image uploads
- `upload.js` handles Firebase Storage uploads
- Progress tracking via `uploadBytesResumable`
- Returns download URL

### 5. Authentication persistence
- `onAuthStateChanged` maintains session
- User stays logged in on refresh

---

## User journey

1. First visit → Login screen
2. Sign up → Creates account → Auto-login → Main app
3. Main app → See chat list (empty initially)
4. Add user → Search username → Add → Chat created
5. Select chat → Chat interface opens
6. Send message → Real-time update → Both users see it
7. Logout → Returns to Login

---

## Important code patterns

### 1. Real-time listeners cleanup
```javascript
useEffect(() => {
  const unSub = onSnapshot(...);
  return () => unSub(); // Cleanup on unmount
}, [dependencies]);
```

### 2. Zustand store access
```javascript
// In component
const { currentUser } = useUserStore();

// Outside component (in chatStore)
const currentUser = useUserStore.getState().currentUser;
```

### 3. Firestore array updates
```javascript
// Add to array
updateDoc(docRef, {
  chats: arrayUnion(newChat)
});

// Update array element
const updatedChats = [...chats];
updatedChats[index].lastMessage = text;
updateDoc(docRef, { chats: updatedChats });
```

---

## Potential issues/improvements

1. Chat.jsx line 62: Uses `currentUser.id` instead of `id` in loop
2. Details.jsx: Hardcoded user info (should use `chatStore.user`)
3. Chat.jsx: Hardcoded user info in top bar (should use `chatStore.user`)
4. Search: Not implemented (UI only)
5. Image messages: UI exists but not implemented
6. Block user: Button exists but not implemented

---

## Summary

- Firebase handles backend (Auth, Firestore, Storage)
- Zustand manages global state
- Real-time updates via Firestore listeners
- Component-based React UI
- Modular structure for easy extension

The app follows a standard real-time chat pattern with Firebase as the backend and React for the frontend.