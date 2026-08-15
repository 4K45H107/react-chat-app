# Implementation checklist (priority + timeline)

Assumes **~8–12 focused hours/week** (evenings / weekends). Dates are relative to **start week = now (Aug 2026)**. Check items off as you finish them.

**Priority legend**

| Tag | Meaning |
|-----|---------|
| P0 | Fix first — broken or data-wrong |
| P1 | Core chat UX — do before new big features |
| P2 | Hardening / polish — before sharing widely |
| P3 | Nice-to-have / later product |

---

## Phase 1 — Stabilize (Week 1)

**Goal:** Correct data + basic chat hygiene.  
**Effort:** ~6–10 hours  
**Target:** end of week 1

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [x] | P0 | Fix `creterdAt` → `createdAt` in `AddUser.jsx` | Optional: one-time script/manual rename in Firebase console for old docs |
| [x] | P0 | Add stable `id` on each message; use as React `key` | e.g. `crypto.randomUUID()` at send time |
| [x] | P0 | Block self-chat + empty search edge cases | Don’t add yourself; toast if username empty |
| [x] | P1 | Prevent duplicate 1:1 chats | Before create, scan own `userChats` for same `receiverId` |
| [x] | P1 | Format real message timestamps | Replace `"1 min ago"` with relative/absolute time |
| [x] | P1 | Enter to send | `onKeyDown` on composer input |
| [x] | P1 | Lock create against rapid double-clicks | `isAddingRef` + disabled `+` while in flight |

**Status:** Phase 1 complete (including double-click race fix).  
**Exit criteria:** New chats have correct field names; no duplicate threads with same user; messages have ids and readable times.

---

## Phase 2 — Core chat UX (Weeks 2–3)

**Goal:** App feels like a real messenger for daily use.  
**Effort:** ~12–18 hours  
**Target:** end of week 3

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [x] | P1 | Chat-list search/filter | Filter loaded chats by username / lastMessage |
| [x] | P1 | Mark as read on open | Set own `isSeen: true` on Chat mount |
| [x] | P1 | Unread styling in list | Bold/weight + background when `!isSeen` |
| [x] | P1 | Wire **Block User** | Update `users.blocked` in Firestore; refresh store flags |
| [x] | P1 | Unblock when already blocked | Same button toggles |
| [x] | P1 | Empty states | No chats / no messages / no search matches |
| [x] | P1 | Login validation | Required fields, basic email/password checks, clearer errors |
| [x] | P2 | Username uniqueness on sign-up | After Auth create, query + roll back if taken |

**Status:** Phase 2 complete.  
**Exit criteria:** You can find chats, see unread, block/unblock, and onboarding doesn’t allow duplicate usernames.

---

## Phase 3 — Media + deploy hygiene (Weeks 4–5)

**Goal:** Image messages work; rules are deployable.  
**Effort:** ~12–16 hours  
**Target:** end of week 5

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [x] | P1 | Send image messages | Reuse `upload.js`; store `img` URL on message object |
| [x] | P1 | Render image bubbles in `Chat` | Click opens full image in a new tab |
| [x] | P2 | Add `firebase.json` + deploy docs | Deploy `firestore.rules` / `storage.rules` via CLI |
| [x] | P2 | Tighten Storage rules | Write only under `images/{uid}/...` |
| [x] | P2 | Loading states for list/send | List skeleton; composer disabled while sending/uploading |
| [x] | P2 | Error boundary | Wrap authenticated shell |

**Status:** Phase 3 complete.  
**Exit criteria:** Avatar + chat images upload under clearer paths; rules deployable from repo.  
**Note:** Deploy updated `storage.rules` with `firebase deploy --only storage` so production matches the repo.

---

## Phase 4 — Security & scale basics (Weeks 6–8)

**Goal:** Safe enough to invite real users; messages won’t blow up one document forever.  
**Effort:** ~16–24 hours  
**Target:** end of week 8

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [x] | P2 | Restrict `chats` to participants | `participantIds` on create; rules check membership |
| [x] | P2 | Narrow `userChats` update rules | Owner full update; others `chats`-only patch |
| [x] | P2 | Move messages to subcollection | `chats/{id}/messages/{messageId}` + legacy migrate |
| [x] | P2 | Validate message fields in rules | `senderId`, text ≤2000, allowed keys, optional `img` |
| [x] | P2 | Pagination / infinite scroll | Newest page live; older via scroll-up |
| [x] | P2 | Service layer for Firestore | `src/lib/chatService.js` |
| [x] | P3 | Firestore offline persistence | `persistentLocalCache` + multi-tab |

**Status:** Phase 4 complete.  
**Exit criteria:** Signed-in strangers can’t read arbitrary chats; long threads load in pages.  
**Note:** Deploy updated `firestore.rules` with `firebase deploy --only firestore:rules`.

---

## Phase 5 — Polish (Weeks 9–10)

**Goal:** Feel finished for a portfolio / small beta.  
**Effort:** ~10–14 hours  
**Target:** end of week 10

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [x] | P2 | Typing indicator | `chats/{id}.typing` via `setTypingStatus` / header “typing…” |
| [x] | P2 | Online/offline status | `users/{id}.lastActive` heartbeat (`presence.js`) |
| [x] | P2 | A11y + responsive pass | Focus-visible, ARIA labels, keyboard chat rows |
| [x] | P2 | Message delete (soft or hard) | Own soft-delete (`deleted: true`); rules allow sender update |
| [x] | P3 | Browser notifications | Notification API on unread sidebar updates |
| [x] | P3 | JSDoc or TypeScript for core types | `src/types.js` + helpers |
| [x] | P3 | Unit tests for store helpers | Vitest: `normalizeUser`, `getBlockFlags`, notify targets |

**Status:** Phase 5 complete.  
**Exit criteria:** Beta-ready demo: presence, delete own message, decent mobile/a11y.  
**Note:** Redeploy Firestore rules after soft-delete (`firebase deploy --only firestore:rules`).

---

## Phase 6 — Later / backlog (Week 11+)

Do these only after Phases 1–4. No fixed dates.

| Done | Pri | Item |
|------|-----|------|
| [x] | P3 | Message edit |
| [x] | P3 | In-thread message search |
| [x] | P3 | Chat archive / mute |
| [x] | P3 | Group chats |
| [x] | P3 | Voice messages |
| [ ] | P3 | Video / voice calls (replace phone/video placeholders) |
| [x] | P3 | Themes |
| [ ] | P3 | Rate limiting / App Check |
| [ ] | P3 | CI (lint + tests on PR) |

---

## Suggested calendar (compact)

```
Week 1     P0/P1 fixes: typo, ids, timestamps, Enter, no duplicates
Weeks 2–3  Search, unread, block, empty states, username unique
Weeks 4–5  Image messages, firebase deploy, storage paths
Weeks 6–8  Security rules + message subcollection/pagination
Weeks 9–10 Typing/presence, delete, polish, light tests
Week 11+   Groups, calls, themes, CI — as needed
```

---

## What to do **next** (Phase 6+)

Pick from the backlog as needed — groups, edit, FCM, CI, themes. No fixed order.

---

Related: [suggestions.md](./suggestions.md) (full backlog) · [chat-flow.md](./chat-flow.md) · [firebase.md](./firebase.md)
