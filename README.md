# React Chat App

Real-time messaging app built with React, Vite, Zustand, and Firebase (Auth, Firestore, Storage), including 1:1 WebRTC voice and video calls.

Supports 1:1 and group chats, media and voice messages, presence/typing indicators, and participant-scoped security rules with paginated message history.

---

## Features

| Area | Details |
|------|---------|
| Messaging | 1:1 and group chats, Enter-to-send, emoji, soft-delete, edit, in-thread search |
| Real-time | Live thread and sidebar, typing indicators, online/offline presence |
| Media | Image messages, camera capture, voice notes, shared photos grid |
| Calls | 1:1 voice and video (WebRTC + Firestore signaling), call history in-thread |
| UX | Unread state, archive/mute, block/unblock, light/dark themes, browser notifications |
| Security | Participant-scoped Firestore rules, message field validation, Storage path locks, upload rate limits |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 18, Vite 5, CSS |
| State | Zustand |
| Backend | Firebase Auth, Firestore (persistent local cache), Storage |
| Calls | WebRTC (STUN + public TURN) |
| Tooling | ESLint, Vitest, JSDoc |

---

## Architecture

```
React UI  →  Zustand stores  →  chatService / callService  →  Firebase
                                      ↓
                         firestore.rules + storage.rules
```

- Messages are stored in `chats/{id}/messages` with a live newest page and older-page pagination on scroll-up.
- Access control lives in security rules: only participants can read/write a chat; Storage writes are scoped to the signed-in user.
- Calls use Firestore for offer/answer/ICE; media stays peer-to-peer via WebRTC.
- Domain logic is centralized in `src/lib/` (`chatService.js`, `callService.js`, presence, upload, rate limiting).
- Chat UI under `src/components/chat/` is split into an orchestrator (`Chat.jsx`), feature hooks, and presentational panels (header, message list, composer, camera).

See [Documentation/](./Documentation/README.md) for schemas, flows, and deeper notes.

---

## Limitations

- Voice/video calls are **1:1 only** (not group).
- Signaling and call cleanup are client-side; connectivity depends on STUN/TURN availability on the network.
- After changing rules in the repo, deploy them or the live project will not match git:

```bash
firebase deploy --only firestore:rules,storage
```

---

## Getting started

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
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [Documentation/README.md](./Documentation/README.md) | Index |
| [documentation.md](./Documentation/documentation.md) | Codebase overview |
| [firebase.md](./Documentation/firebase.md) | Schemas, rules, deploy |
| [chat-flow.md](./Documentation/chat-flow.md) | Create / list / send flows |
| [calls.md](./Documentation/calls.md) | WebRTC call design and limits |
| [checklist.md](./Documentation/checklist.md) | Implementation status |
