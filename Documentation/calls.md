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

If the UI said “Connecting…” then vanished before: the peer connection failed and
the app used to auto-hang-up. It now keeps the overlay and shows **Connection failed**.
Check the browser console for `[Call] connectionState: …` logs.

## Files

- `src/lib/callService.js` — Firestore signaling
- `src/lib/callStore.js` — UI call state
- `src/lib/webrtcConfig.js` — ICE servers
- `src/components/call/CallOverlay.jsx` — ringing + in-call UI
