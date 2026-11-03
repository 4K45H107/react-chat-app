# Architecture decision records

Short notes on the choices that shaped this app: the situation, the decision,
and what it cost or bought.

| # | Decision |
| --- | --- |
| [0001](0001-firebase-without-a-backend.md) | Firebase with no backend of our own |
| [0002](0002-inbox-as-a-query.md) | The sidebar is a query, not a per-user list others write to |
| [0003](0003-firestore-signaling-for-webrtc.md) | Firestore as the WebRTC signaling channel |
| [0004](0004-turn-relay.md) | A hosted TURN relay with credentials in the client |
| [0005](0005-split-at-sign-in.md) | Split the bundle at the sign-in boundary |
