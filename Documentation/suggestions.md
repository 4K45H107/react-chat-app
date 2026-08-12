# Suggestions and backlog

Status relative to the current codebase (Aug 2026). Fixed items are listed at the bottom.

**For what to do next (priority + weeks):** use [checklist.md](./checklist.md). This file is the fuller backlog behind that plan.

---

## Open bugs / data issues

1. **Legacy data:** Older `chats` docs may still have `creterdAt` or messages without `id` (new writes are correct; UI falls back for keys). Older Storage objects may sit on flat `images/{filename}` (read-only under current rules).
2. **Username uniqueness race:** Check runs after Auth create (rules require auth to read `users`); rare double-signup with the same name is still possible without rules/Functions.
3. **Storage rules in production:** Repo rules are tighter (`images/{uid}/...`); deploy with `firebase deploy --only storage` if the live project still uses the old open rules.

---

## Missing features (high value for chat)

4. Message **delete** / **edit**.
5. **Typing** indicators and **online/offline** presence.
6. **Pagination** / subcollection for messages (array-on-document will hit size/cost limits).
7. Camera / mic / phone / video composer actions (image attach works; others are placeholders).
8. Shared photos/files panel in Details (images in thread only).

---

## Security (rules exist but are broad on Firestore)

9. Restrict `chats` read/write to conversation participants only.
10. Restrict `userChats` updates so senders can only patch the relevant chat entry (or move sidebar updates to Cloud Functions).
11. Validate message shape / max length in rules or Functions.
12. Rate-limit sends (Functions or App Check).

---

## UX polish

13. Unread count badges and delivery/read indicators beyond bold list rows.
14. Thread loading skeleton (list skeleton exists).
15. Browser notifications for new messages (needs FCM or Notification API + permission).
16. Responsive / a11y pass (ARIA on icon buttons is partly started).
17. Multiline composer (Shift+Enter already reserved).

---

## Code quality and architecture

18. Extract Firestore access into a small service layer (auth, users, chats).
19. Centralize collection/field name constants.
20. Required avatar policy on sign-up (optional today).
21. TypeScript or JSDoc typedefs for User / ChatMeta / Message.
22. Unit tests for `normalizeUser`, `changeChat` block logic, and send/sidebar sync helpers.

---

## Larger product ideas

23. Group chats  
24. Voice messages / calls (phone & video icons are placeholders)  
25. Message search inside a thread  
26. Chat archive / mute  
27. Offline cache (Firestore persistence is a quick win)  
28. Themes / customization  
29. Profile settings (change avatar / username after sign-up)  

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
| Image attach not wired | Upload + `img` on message; bubble + click to open |
| Flat open Storage writes | `images/{uid}/...` owner-only write; size/type checks |
| No `firebase.json` | Present + deploy docs in `firebase.md` |
| No list/send loading UX | List skeleton; composer disabled while sending |
| No error boundary | Authenticated shell wrapped |
