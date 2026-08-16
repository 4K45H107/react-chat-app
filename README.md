# React Chat App

Real-time messenger built with **React**, **Vite**, **Zustand**, and **Firebase** (Auth, Firestore, Storage), plus **1:1 WebRTC** voice/video calls.

Built as a portfolio project: full chat product surface with security-minded Firestore/Storage rules, paginated message history, and client-side rate limits suitable for Firebase Spark.

---

## Features

| Area | What you get |
|------|----------------|
| Messaging | 1:1 and group chats, Enter-to-send, emoji, soft-delete, edit, in-thread search |
| Real-time | Live thread + sidebar, typing indicators, online/offline presence |
| Media | Image messages, camera capture, voice notes, shared photos grid |
| Calls | 1:1 voice & video (WebRTC + Firestore signaling), call history in the thread |
| UX | Unread badges, archive/mute, block/unblock, light/dark themes, browser notifications |
| Hardening | Participant-scoped rules, message field validation, Storage path locks, upload rate limits |

---

## Stack

| Layer | Choice |
|-------|--------|
| UI | React 18 + Vite 5 + plain CSS |
| State | Zustand |
| Backend | Firebase Auth, Firestore (offline cache), Storage |
| Calls | WebRTC (STUN + public TURN) |
| Quality | ESLint, Vitest (store/helpers), JSDoc types |

---

## Architecture (short)

```
React UI  →  Zustand stores  →  chatService / callService  →  Firebase
                                      ↓
                         firestore.rules + storage.rules
```

- **Messages** live in `chats/{id}/messages` (not one giant chat doc) with live newest page + scroll-up pagination.
- **Access control** is in security rules: only participants read/write a chat; Storage writes are scoped under the signed-in user.
- **Calls** use Firestore for offer/answer/ICE; media stays peer-to-peer via WebRTC.
- Domain logic sits in `src/lib/` (`chatService.js`, `callService.js`, presence, upload, rate limit) so the UI stays thinner than a pure “everything in components” app.
- The chat UI is split under `src/components/chat/`: `Chat.jsx` orchestrates hooks (`useChatThread`, voice/camera/typing) and presentational pieces (header, message list, composer, camera overlay).

Deeper walkthroughs: [Documentation/](./Documentation/README.md).

---

## Demo notes

- Best shown with **two accounts** (two browsers or normal + incognito).
- Calls are **1:1 only** — enough for a portfolio demo, not a production dialer (ringtone/busy/cleanup are client-side; free TURN can still be flaky on some networks).
- After pulling rules changes, deploy them or local and production will disagree:

```bash
firebase deploy --only firestore:rules,storage
```

---

## Setup

```bash
npm install
```

Create a `.env` with your Firebase web API key:

```bash
VITE_API_KEY=<your-key>
```

```bash
npm run dev
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Vite server |
| `npm run build` | Production bundle |
| `npm run preview` | Preview the build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

---

## Docs

| Doc | Contents |
|-----|----------|
| [Documentation/README.md](./Documentation/README.md) | Doc index |
| [documentation.md](./Documentation/documentation.md) | Codebase overview |
| [firebase.md](./Documentation/firebase.md) | Schemas, rules, deploy |
| [chat-flow.md](./Documentation/chat-flow.md) | Create / list / send flows |
| [calls.md](./Documentation/calls.md) | WebRTC call design & limits |
| [checklist.md](./Documentation/checklist.md) | Build timeline / status |
