# Voice and video calls

One-to-one calls use **WebRTC** for audio and video, and **Firestore** to
exchange the connection details (signaling). There's no signaling server.

## How a call connects

1. The caller gets camera / microphone access, creates an offer, and writes
   `calls/{callId}` with `status: "ringing"`.
2. The callee's app listens for ringing calls addressed to them and shows the
   incoming-call screen.
3. On accept, the callee writes its answer and sets `status: "active"`.
4. Both sides add ICE candidates (possible network routes) to
   `calls/{callId}/iceCandidates` and read the other side's.
5. Media flows directly between the browsers, or through the TURN relay when
   a direct route isn't possible.
6. On hang-up, one side writes the end status, a history message
   (`Video call · 12:34`, `Missed voice call`, ...) goes into the chat, and the
   call documents are deleted.

## Call states

| From | To | Who |
| --- | --- | --- |
| `ringing` | `active` (with answer) | Callee |
| `ringing` | `declined`, `busy` | Callee |
| `ringing` | `missed`, `ended` | Either side |
| `active` | `ended` | Either side |

The rules enforce this table, so a caller can't answer their own call and an
ended call can't be reopened. A ringing call is marked missed after 45 s.

## Connectivity

[`webrtcConfig.js`](../src/lib/webrtcConfig.js) lists the ICE servers:

- **STUN** (Metered, Google) finds each browser's public address. Enough for
  most home and office networks.
- **TURN** ([Metered](https://www.metered.ca/)) relays the media when the
  networks won't connect directly, such as strict NAT or mobile carriers.
  It's offered over UDP, TCP and TLS on ports 80 and 443, which pass most
  firewalls.

TURN credentials come from `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL`
(see [`.env.example`](../.env.example)). Without them, calls use STUN only.
TURN credentials always reach the browser; the free plan's monthly relay
quota (500 MB) caps any misuse, and relaying stops rather than billing.

## Extras

- **Ringtones**: generated with the Web Audio API (no bundled audio files).
- **Busy**: if the callee is already on a call, the new call is marked busy.
- **Call history**: one history message per call; both sides try to write it
  under the call id and the second write is refused.

## Limits

- One-to-one only; group chats have no calls.
- Cleanup is done by the clients. If both crash mid-call, the call document
  stays until deleted; a scheduled Cloud Function could sweep these.

## Trying it

Open the app in two browsers (or a normal and a private window), sign in as
the two demo users, open their chat, and press the phone or camera button.
