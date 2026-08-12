# Suggestions and backlog

Status relative to the current codebase (Aug 2026). Fixed items from the old list are noted at the bottom so history is clear.

---

## Open bugs / data issues

1. **Typo on chat create:** `AddUser.jsx` writes `creterdAt` instead of `createdAt`. Rename field (and migrate existing docs if you care about that timestamp).
2. **Duplicate chats:** Adding the same username again creates another `chats` document. Detect an existing pair before `setDoc`.
3. **Username uniqueness:** Sign-up does not ensure unique `username`; search returns the first match only.
4. **Message list keys:** `Chat.jsx` uses `message.createdAt` as React `key` — colliding timestamps can confuse reconciliation; prefer a message id.
5. **Placeholder timestamps:** Message UI always shows `"1 min ago"` instead of formatting `createdAt`.

---

## Missing features (high value for chat)

6. Chat-list **search/filter** (input exists in `ChatList`).
7. **Block user:** wire Details button → update both users’ `blocked` arrays in Firestore + `changeBlock` / refetch so flags stay correct.
8. **Mark as read:** when opening a chat, set own `userChats` entry `isSeen: true`; show unread styling in the list.
9. **Image / file messages** (composer icons exist; Storage path pattern already used for avatars).
10. Message **delete** / **edit**.
11. **Typing** indicators and **online/offline** presence.
12. **Pagination** / subcollection for messages (array-on-document will hit size/cost limits).
13. Prevent **self-chat** and clearer empty states (no chats / no messages).

---

## Security (rules exist but are broad)

Rules files are in the repo (`firestore.rules`, `storage.rules`) and require auth. Still recommended:

14. Restrict `chats` read/write to conversation participants only.
15. Restrict `userChats` updates so senders can only patch the relevant chat entry (or move sidebar updates to Cloud Functions).
16. Storage: only allow writes under paths owned by `request.auth.uid`.
17. Validate message shape / max length in rules or Functions.
18. Rate-limit sends (Functions or App Check).

---

## UX polish

19. Real relative/absolute time on messages.
20. Unread badges and delivery/read indicators.
21. Keyboard: Enter to send (and keep Shift+Enter for newline if you add multiline).
22. Loading skeletons for list and thread (beyond global “Loading…”).
23. Stronger empty states and disabled-state copy.
24. Browser notifications for new messages (needs FCM or Notification API + permission).
25. Responsive / a11y pass (ARIA on icon buttons is partly started).

---

## Code quality and architecture

26. Extract Firestore access into a small service layer (auth, users, chats).
27. Centralize collection/field name constants.
28. Stronger form validation on Login (email format, password rules, required avatar policy).
29. Error boundary around the authenticated shell.
30. TypeScript or JSDoc typedefs for User / ChatMeta / Message.
31. Unit tests for `normalizeUser`, `changeChat` block logic, and send/sidebar sync helpers.
32. Add `firebase.json` + documented deploy for rules; keep secrets out of git (API key is expected in Vite client bundles but still rotate if leaked).

---

## Larger product ideas

33. Group chats  
34. Voice messages / calls (phone & video icons are placeholders)  
35. Message search inside a thread  
36. Chat archive / mute  
37. Offline cache (Firestore persistence is a quick win)  
38. Themes / customization  

---

## Already fixed (do not re-open unless regressions)

| Was | Now |
|-----|-----|
| `handleSend` always updated `currentUser`’s `userChats` | Loops both participant ids correctly |
| Hardcoded partner in Chat / Details | Uses `chatStore.user` |
| No Firestore/Storage rules in project | `firestore.rules` + `storage.rules` (auth-gated) |
| Logout only imagined on Details | `UserInfo` calls `auth.signOut()`; chat store resets on logout |
| Details always open with chat | `showDetails` + `toggleDetails` |
| Fragile `blocked` arrays | `normalizeUser` defaults to `[]` |
