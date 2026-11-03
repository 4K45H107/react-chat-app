# 0001. Firebase with no backend of our own

**Status:** accepted

## Context

A chat app needs sign-in, real-time data, file storage and authorization. A
custom backend (API server, WebSocket server, database) would mean hosting,
scaling and securing several moving parts for a single-developer project.

## Decision

The React app talks directly to Firebase: Auth for sign-in, Firestore for data
and live updates, Storage for media. Authorization lives in Firestore and
Storage security rules, which play the role of a backend's permission layer.

## Consequences

- No servers to run; real-time updates and offline caching come with the SDK.
- The rules are the security boundary, so they're treated as code: reviewed,
  and tested against the emulator ([testing.md](../testing.md)).
- Anything that must not be trusted to the client and can't be expressed in
  rules (hard rate limits, cleanup jobs) would need Cloud Functions. Upload
  rate limits currently run in the client.
