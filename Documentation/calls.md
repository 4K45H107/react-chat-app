# Voice & video calls (portfolio)

1:1 calls use **WebRTC** for audio/video and **Firestore** for signaling
(offer / answer / ICE). No WebSocket server.

## How to try

1. Deploy rules: `firebase deploy --only firestore:rules`
2. Open the app in **two browsers** (or normal + incognito) with two accounts
3. Open a **1:1** chat → phone (voice) or camera (video) icon
4. Accept on the other side

## UX extras

- **Ringtone / ringback:** Web Audio tones while ringing (incoming chime + classic ringback). Apple’s Opening ringtone is copyrighted and is **not** bundled — this is a portfolio-safe substitute.
- **Busy:** If the callee is already in a call, the new invite is marked `busy`; the caller hears a short busy tone and sees a toast.
- **Cleanup:** When a call ends (ended / declined / missed / busy), participants delete ICE candidates and the call document (best-effort). Redeploy Firestore rules so deletes are allowed.

## Limits (by design)

- Groups: calls disabled (1:1 only)
- STUN + free public TURN (Metered Open Relay) for better connectivity across networks
- Not a production dialer — enough for a portfolio demo
- No orphan janitor for abandoned docs if both clients crash mid-ring (no Cloud Functions on Spark)

## Call history in chat

When a call ends (completed, declined, missed, or busy), a centered system-style
message is written to the thread, e.g. `Voice call · 1:23`, `Missed video call`,
or `Voice call · busy`. The sidebar preview updates to that text as well.

Redeploy Firestore rules after pulling this change so `call` message fields and
call-doc deletes are allowed.

## Files

- `src/lib/callService.js` — Firestore signaling + cleanup
- `src/lib/callSounds.js` — ringtone / ringback / busy tones
- `src/lib/callStore.js` — UI call state
- `src/lib/webrtcConfig.js` — ICE servers
- `src/components/call/CallOverlay.jsx` — ringing + in-call UI
