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
| [ ] | P1 | Chat-list search/filter | Filter loaded chats by username / lastMessage |
| [ ] | P1 | Mark as read on open | Set own `isSeen: true` in `changeChat` or Chat mount |
| [ ] | P1 | Unread styling in list | Dim/bold or badge when `!isSeen` |
| [ ] | P1 | Wire **Block User** | Update `users.blocked` in Firestore; refresh store flags |
| [ ] | P1 | Unblock when already blocked | Same button toggles |
| [ ] | P1 | Empty states | No chats / no messages copy in list and thread |
| [ ] | P1 | Login validation | Required fields, basic email/password checks, clearer errors |
| [ ] | P2 | Username uniqueness on sign-up | Query before create; reject duplicates |

**Exit criteria:** You can find chats, see unread, block/unblock, and onboarding doesn’t allow duplicate usernames.

---

## Phase 3 — Media + deploy hygiene (Weeks 4–5)

**Goal:** Image messages work; rules are deployable.  
**Effort:** ~12–16 hours  
**Target:** end of week 5

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [ ] | P1 | Send image messages | Reuse `upload.js`; store `img` URL on message object |
| [ ] | P1 | Render image bubbles in `Chat` | Click-to-open optional |
| [ ] | P2 | Add `firebase.json` + deploy docs | Deploy `firestore.rules` / `storage.rules` via CLI |
| [ ] | P2 | Tighten Storage rules | Write only under `images/{uid}/...` or similar |
| [ ] | P2 | Loading states for list/send | Disable send while uploading; list skeleton optional |
| [ ] | P2 | Error boundary | Wrap authenticated shell |

**Exit criteria:** Avatar + chat images upload under clearer paths; rules deployable from repo.

---

## Phase 4 — Security & scale basics (Weeks 6–8)

**Goal:** Safe enough to invite real users; messages won’t blow up one document forever.  
**Effort:** ~16–24 hours  
**Target:** end of week 8

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [ ] | P2 | Restrict `chats` to participants | Rules need `participantIds` on chat doc — add field when creating chat |
| [ ] | P2 | Narrow `userChats` update rules | Or move sidebar sync to Cloud Function |
| [ ] | P2 | Validate message fields in rules | `text` string, max length, `senderId == auth.uid` |
| [ ] | P2 | Move messages to subcollection | `chats/{id}/messages/{messageId}` + limit/query |
| [ ] | P2 | Pagination / infinite scroll | Load last N; load older on scroll up |
| [ ] | P2 | Service layer for Firestore | Thin helpers: createChat, sendMessage, markSeen |
| [ ] | P3 | Firestore offline persistence | One-liner enable; big UX win |

**Exit criteria:** Signed-in strangers can’t read arbitrary chats; long threads load in pages.

---

## Phase 5 — Polish (Weeks 9–10)

**Goal:** Feel finished for a portfolio / small beta.  
**Effort:** ~10–14 hours  
**Target:** end of week 10

| Done | Pri | Item | Notes |
|------|-----|------|--------|
| [ ] | P2 | Typing indicator | Short-lived field on chat or presence doc |
| [ ] | P2 | Online/offline status | `users/{id}.lastActive` or RTDB presence |
| [ ] | P2 | A11y + responsive pass | Focus, labels, mobile chat-open already started |
| [ ] | P2 | Message delete (soft or hard) | Own messages only |
| [ ] | P3 | Browser notifications | Notification API first; FCM later |
| [ ] | P3 | JSDoc or TypeScript for core types | User, ChatMeta, Message |
| [ ] | P3 | Unit tests for store helpers | `normalizeUser`, block logic |

**Exit criteria:** Beta-ready demo: presence, delete own message, decent mobile/a11y.

---

## Phase 6 — Later / backlog (Week 11+)

Do these only after Phases 1–4. No fixed dates.

| Done | Pri | Item |
|------|-----|------|
| [ ] | P3 | Message edit |
| [ ] | P3 | In-thread message search |
| [ ] | P3 | Chat archive / mute |
| [ ] | P3 | Group chats |
| [ ] | P3 | Voice messages |
| [ ] | P3 | Video / voice calls (replace phone/video placeholders) |
| [ ] | P3 | Themes |
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

## What to do **next** (Phase 2)

1. [ ] Chat-list search/filter
2. [ ] Mark seen on open + unread list style
3. [ ] Wire Block / Unblock user
4. [ ] Empty states + login validation
5. [ ] Username uniqueness on sign-up

---

Related: [suggestions.md](./suggestions.md) (full backlog) · [chat-flow.md](./chat-flow.md) · [firebase.md](./firebase.md)
