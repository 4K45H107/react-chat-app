# Suggestions and backlog

Status relative to the current codebase (Aug 2026). Fixed items are listed at the bottom.

**For what to do next (priority + weeks):** use [checklist.md](./checklist.md). This file is the fuller backlog behind that plan.

---

## Open bugs / data issues

1. **Username uniqueness:** Sign-up does not ensure unique `username`; search returns the first match only.
2. **Legacy data:** Older `chats` docs may still have `creterdAt` or messages without `id` (new writes are correct; UI falls back for keys).

---

## Missing features (high value for chat)

3. Chat-list **search/filter** (input exists in `ChatList`).
4. **Block user:** wire Details button → update both users’ `blocked` arrays in Firestore + `changeBlock` / refetch so flags stay correct.
5. **Mark as read:** when opening a chat, set own `userChats` entry `isSeen: true`; show unread styling in the list.
6. **Image / file messages** (composer icons exist; Storage path pattern already used for avatars).
7. Message **delete** / **edit**.
8. **Typing** indicators and **online/offline** presence.
9. **Pagination** / subcollection for messages (array-on-document will hit size/cost limits).
10. Clearer **empty states** (no chats / no messages).

---

## Security (rules exist but are broad)

Rules files are in the repo (`firestore.rules`, `storage.rules`) and require auth. Still recommended:

11. Restrict `chats` read/write to conversation participants only.
12. Restrict `userChats` updates so senders can only patch the relevant chat entry (or move sidebar updates to Cloud Functions).
13. Storage: only allow writes under paths owned by `request.auth.uid`.
14. Validate message shape / max length in rules or Functions.
15. Rate-limit sends (Functions or App Check).

---

## UX polish

16. Unread badges and delivery/read indicators.
17. Loading skeletons for list and thread (beyond global “Loading…”).
18. Stronger empty states and disabled-state copy.
19. Browser notifications for new messages (needs FCM or Notification API + permission).
20. Responsive / a11y pass (ARIA on icon buttons is partly started).
21. Multiline composer (Shift+Enter already reserved).

---

## Code quality and architecture

22. Extract Firestore access into a small service layer (auth, users, chats).
23. Centralize collection/field name constants.
24. Stronger form validation on Login (email format, password rules, required avatar policy).
25. Error boundary around the authenticated shell.
26. TypeScript or JSDoc typedefs for User / ChatMeta / Message.
27. Unit tests for `normalizeUser`, `changeChat` block logic, and send/sidebar sync helpers.
28. Add `firebase.json` + documented deploy for rules; keep secrets out of git (API key is expected in Vite client bundles but still rotate if leaked).

---

## Larger product ideas

29. Group chats  
30. Voice messages / calls (phone & video icons are placeholders)  
31. Message search inside a thread  
32. Chat archive / mute  
33. Offline cache (Firestore persistence is a quick win)  
34. Themes / customization  

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
| `creterdAt` typo on chat create | Writes `createdAt` |
| Message list keyed on `createdAt` | `id: crypto.randomUUID()` + fallback key |
| Placeholder `"1 min ago"` | `formatMessageTime` in `src/lib/formatTime.js` |
| Empty search / self-chat allowed | Toasts + guards in `AddUser` |
| Duplicate 1:1 chat with same user | Pre-check `receiverId` + sync create lock / disabled `+` |
| No Enter-to-send | Enter sends; Shift+Enter reserved |
