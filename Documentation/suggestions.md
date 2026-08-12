# Suggestions and backlog

Status relative to the current codebase (Aug 2026). Fixed items are listed at the bottom.

**For what to do next (priority + weeks):** use [checklist.md](./checklist.md). This file is the fuller backlog behind that plan.

---

## Open bugs / data issues

1. **Legacy data:** Older `chats` docs may still have `creterdAt` or messages without `id` (new writes are correct; UI falls back for keys).
2. **Username uniqueness race:** Check runs after Auth create (rules require auth to read `users`); rare double-signup with the same name is still possible without rules/Functions.

---

## Missing features (high value for chat)

3. **Image / file messages** (composer icons exist; Storage path pattern already used for avatars).
4. Message **delete** / **edit**.
5. **Typing** indicators and **online/offline** presence.
6. **Pagination** / subcollection for messages (array-on-document will hit size/cost limits).

---

## Security (rules exist but are broad)

Rules files are in the repo (`firestore.rules`, `storage.rules`) and require auth. Still recommended:

7. Restrict `chats` read/write to conversation participants only.
8. Restrict `userChats` updates so senders can only patch the relevant chat entry (or move sidebar updates to Cloud Functions).
9. Storage: only allow writes under paths owned by `request.auth.uid`.
10. Validate message shape / max length in rules or Functions.
11. Rate-limit sends (Functions or App Check).

---

## UX polish

12. Unread count badges and delivery/read indicators beyond bold list rows.
13. Loading skeletons for list and thread (beyond global “Loading…”).
14. Browser notifications for new messages (needs FCM or Notification API + permission).
15. Responsive / a11y pass (ARIA on icon buttons is partly started).
16. Multiline composer (Shift+Enter already reserved).

---

## Code quality and architecture

17. Extract Firestore access into a small service layer (auth, users, chats).
18. Centralize collection/field name constants.
19. Required avatar policy on sign-up (optional today).
20. Error boundary around the authenticated shell.
21. TypeScript or JSDoc typedefs for User / ChatMeta / Message.
22. Unit tests for `normalizeUser`, `changeChat` block logic, and send/sidebar sync helpers.
23. Add `firebase.json` + documented deploy for rules; keep secrets out of git (API key is expected in Vite client bundles but still rotate if leaked).

---

## Larger product ideas

24. Group chats  
25. Voice messages / calls (phone & video icons are placeholders)  
26. Message search inside a thread  
27. Chat archive / mute  
28. Offline cache (Firestore persistence is a quick win)  
29. Themes / customization  

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
| Chat-list search UI only | Filters by username / lastMessage |
| `isSeen` never cleared / no unread UI | Mark seen on Chat mount; unread row styling |
| Block button inert | Details toggles `users.blocked` + `isReceiverBlocked` |
| No empty states | List / search / thread empty copy |
| Weak login validation | Required fields, email/password checks, clearer Auth toasts |
| Duplicate usernames on sign-up | Query after Auth create; delete Auth user if taken |
