# Architecture

A single-page React app talking directly to Firebase. There is no server of
its own: Firebase Auth handles sign-in, Firestore holds the data and carries
call signaling, Storage holds photos and voice notes, and security rules do
the job a backend's authorization layer would.

```
React UI ──► Zustand stores ──► chatService / callService ──► Firebase SDK
                                                                  │
                         firestore.rules + storage.rules  ◄───────┘
Browser ◄──── WebRTC media (peer to peer, or via the TURN relay) ────► Browser
```

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 18, Vite 5, plain CSS with theme variables (light / dark) |
| State | Zustand (`userStore`, `chatStore`, `callStore`) |
| Data | Firestore with a persistent multi-tab cache, Firebase Auth, Storage |
| Calls | WebRTC, Firestore signaling, Metered TURN relay |
| Testing | Vitest, `@firebase/rules-unit-testing`, Firebase Emulator Suite |
| Tooling | ESLint, size-limit, GitHub Actions |

## Folders

```
src/
  App.jsx              Auth gate: login screen, or the lazy signed-in app
  SignedInApp.jsx      Sidebar, chat, details, call overlay, presence heartbeat
  components/
    login/             Sign in and sign up
    list/              Sidebar: profile, chat list, new DM, new group
    chat/              Thread: header, messages, composer, camera, search
      hooks/           Thread paging, typing, voice recording, camera, search
    details/           Chat info: shared photos, mute / archive, block, groups
    call/              Ringing and in-call UI
  lib/
    firebase.js        Firebase app + Auth (all the login screen needs)
    db.js, storage.js  Firestore and Storage, loaded after sign-in
    chatService.js     Every chat read and write
    callService.js     Call signaling and call history
    webrtcConfig.js    ICE servers (STUN + TURN)
    *Store.js          Zustand stores
    presence.js, rateLimit.js, upload.js, notifications.js, theme.js, ...
  types.js             JSDoc types for users, chats and messages
tests/
  rules/               Firestore rules tests (emulator)
  integration/         App flows through the real services (emulators)
scripts/seed.mjs       Demo accounts and chat history
```

Components never import the Firestore SDK for chat data directly: reads and
writes go through `chatService.js` and `callService.js`, which keeps the data
model in one place.

## How the app loads

The bundle is split at the sign-in boundary, so the login screen downloads
only React and Firebase Auth:

| Chunk | When it loads | Size (gzip) |
| --- | --- | --- |
| Entry: app shell, React, Firebase Auth | First visit | ~84 KB |
| Signed-in app + Firestore | Prefetched while the login screen is idle | ~22 KB + ~107 KB |
| Emoji picker | First time the picker opens (preloaded on hover) | ~62 KB |
| Firebase Storage | First upload | ~12 KB |

Before the split the app was a single 282 KB (gzip) file. Budgets for these
chunks are enforced in CI with size-limit (`npm run size`).

## Real-time behaviour

- **Sidebar**: one live query over the user's chats, ordered by last activity.
- **Thread**: the newest 30 messages are live; older pages load on scroll-up.
- **Typing**: a short-lived `typing` field on the chat document (4 s TTL).
- **Presence**: each signed-in client updates `lastActive` every minute; a
  user counts as online for 90 s after that.
- **Notifications**: the browser Notification API fires for new unread
  messages in chats that aren't open or muted.

## Limits worth knowing

- Upload rate limits (8 a minute, 80 a day) run in the client; a modified
  client can skip them. Storage rules still cap size and type.
- Calls are one-to-one; groups have messaging only.
- Push notifications (FCM) aren't wired up, so notifications need an open tab.
