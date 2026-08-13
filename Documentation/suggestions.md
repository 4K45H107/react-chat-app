# Suggestions and backlog

Status relative to the current codebase (Aug 2026). Fixed items are listed at the bottom.

**For what to do next (priority + weeks):** use [checklist.md](./checklist.md). This file is the fuller backlog behind that plan.

---

## Open bugs / data issues

1. **Legacy data:** Older `chats` docs may still have `creterdAt`, lack `participantIds`, or need one-time message-array migration on open. Older Storage objects may sit on flat `images/{filename}` (read-only).
2. **Username uniqueness race:** Check runs after Auth create; rare double-signup with the same name is still possible without rules/Functions.
3. **Deploy rules:** Repo Firestore/Storage rules are tighter than older live defaults — run `firebase deploy --only firestore:rules,storage` when ready.

---

## Missing features (high value for chat)

4. Message **edit** (soft-delete exists).
5. Camera / mic / phone / video composer actions (image attach works; others are placeholders).
6. Shared photos/files panel in Details (images in thread only).
7. Push via **FCM** (browser Notification API works while the tab is open).

---

## Security (remaining)

8. Rate-limit sends (Functions or App Check).
9. Further harden `userChats` so senders can only patch the matching chat entry (needs Functions or a different data shape).
10. Backfill `participantIds` on all legacy chats so the open legacy rule can be removed.

---

## UX polish

11. Unread count badges and delivery/read indicators beyond bold list rows.
12. Thread loading skeleton (list skeleton exists).
13. Multiline composer (Shift+Enter already reserved).

---

## Code quality and architecture

14. Centralize collection/field name constants.
15. Required avatar policy on sign-up (optional today).
16. Broader unit tests for `chatService` helpers (Vitest covers normalize/block/notify today).

---

## Larger product ideas

17. Group chats  
18. Voice messages / calls (phone & video icons are placeholders)  
19. Message search inside a thread  
20. Chat archive / mute  
21. Themes / customization  
22. Profile settings (change avatar / username after sign-up)  
23. CI (lint + tests on PR)  

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
| Open chat read/write for any signed-in user | `participantIds` + participant rules |
| Open `userChats` updates | Owner or `chats`-only patch |
| Messages array on chat doc | `chats/{id}/messages` subcollection + pagination |
| No message field validation in rules | senderId/text/img constraints on create |
| Firestore access scattered in components | `src/lib/chatService.js` |
| No offline cache | `persistentLocalCache` + multi-tab |
| No typing / presence | Chat `typing` field + `users.lastActive` heartbeat |
| No message delete | Soft-delete own messages (`deleted: true`) |
| No browser notifications | Notification API on unread list updates |
| No core typedefs / light tests | `src/types.js` + Vitest helpers |
| Weak a11y on chat chrome | Focus-visible, ARIA, keyboard list rows |
