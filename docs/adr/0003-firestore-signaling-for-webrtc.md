# 0003. Firestore as the WebRTC signaling channel

**Status:** accepted

## Context

WebRTC needs a way for two browsers to exchange an offer, an answer and ICE
candidates before media can flow. The usual choice is a WebSocket server,
which this project doesn't have ([0001](0001-firebase-without-a-backend.md)).

## Decision

Signaling goes through Firestore: a `calls/{callId}` document holds the offer,
answer and status, and an `iceCandidates` subcollection carries each side's
candidates. Both clients listen with snapshot listeners. The rules restrict
call documents to the two parties and enforce the call state machine
(ringing, active, ended, ...) by role.

## Consequences

- No extra service; signaling reuses the real-time channel the app already has.
- Signaling latency is that of a Firestore round trip, which is fine for call
  setup.
- Cleanup is done by the clients; if both crash mid-call, a stale call
  document can remain until a sweep removes it.
- One-to-one only. Group calls would need a media server (SFU) rather than
  a mesh of peer connections.
