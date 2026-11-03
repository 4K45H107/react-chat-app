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
| Calls | WebRTC (STUN + Metered TURN relay) |
| Tooling | ESLint, Vitest, Firebase Emulator Suite, size-limit, GitHub Actions |

---

## Architecture

```
React UI  →  Zustand stores  →  chatService / callService  →  Firebase
                                      ↓
                         firestore.rules + storage.rules
```

- The sidebar is a live query over the chats you're a member of; each chat holds its last-message preview and a read marker per member. No user writes another user's documents.
- Access control lives in security rules, covered by 36 emulator tests: members only, fields validated, server timestamps, blocking enforced.
- Calls use Firestore for offer / answer / ICE; media goes peer to peer, or through a TURN relay on strict networks.
- The login screen loads only React and Firebase Auth (84 KB gzip); the rest of the app loads after sign-in.

See [docs/](./docs/README.md) for the data model, security rules, calls, testing and decision records.

---

## Limitations

- Voice/video calls are **1:1 only** (not group).
- Call cleanup runs in the clients; connectivity across strict networks relies on the TURN relay.
- Upload rate limits run in the client; Storage rules still cap file size and type.

---

## Getting started

Requirements: Node 24+, and Java 21+ for the Firebase emulators.

```bash
npm install
cp .env.example .env   # add your Firebase web API key (and TURN credentials for calls)
npm run dev
```

Or run everything locally against the emulators, with demo data:

```bash
npm run emulators         # terminal 1
npm run seed:emulators    # terminal 2
npm run dev:emulators     # terminal 2, then sign in as nadia@reactchat.dev / Password123!
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rules` | Firestore rules tests (emulator) |
| `npm run test:integration` | End-to-end flows against seeded emulators |
| `npm run size` | Bundle size budgets (after a build) |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](./docs/architecture.md) | Stack, folders, state, code splitting |
| [docs/data-model.md](./docs/data-model.md) | Collections, fields, indexes, security model |
| [docs/calls.md](./docs/calls.md) | WebRTC calls: signaling, call states, relay |
| [docs/testing.md](./docs/testing.md) | Emulators, rules and integration tests, demo data, CI |
| [docs/adr/](./docs/adr/README.md) | Architecture decision records |

---

## License

[MIT](./LICENSE)
