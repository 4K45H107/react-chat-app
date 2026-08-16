# Voice & video calls (portfolio)

1:1 calls use **WebRTC** for audio/video and **Firestore** for signaling
(offer / answer / ICE). No WebSocket server.

## How to try

1. Deploy rules: `firebase deploy --only firestore:rules`
2. Open the app in **two browsers** (or normal + incognito) with two accounts
3. Open a **1:1** chat → phone (voice) or camera (video) icon
4. Accept on the other side

## Limits (by design)

- Groups: calls disabled (1:1 only)
- STUN + free public TURN (Metered Open Relay) for better connectivity across networks
- Not a production dialer — enough for a portfolio demo

## Call history in chat

When a call ends (completed, declined, or missed), a centered system-style
message is written to the thread, e.g. `Voice call · 1:23` or `Missed video call`.
The sidebar preview updates to that text as well.

Redeploy Firestore rules after pulling this change so `call` message fields are allowed.

## Files

- `src/lib/callService.js` — Firestore signaling
- `src/lib/callStore.js` — UI call state
- `src/lib/webrtcConfig.js` — ICE servers
- `src/components/call/CallOverlay.jsx` — ringing + in-call UI
