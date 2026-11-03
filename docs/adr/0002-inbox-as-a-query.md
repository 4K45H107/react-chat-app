# 0002. The sidebar is a query, not a per-user list others write to

**Status:** accepted (replaced the original `userChats` design)

## Context

The first version kept each user's sidebar as an array in
`userChats/{uid}`. Sending a message meant the sender read and rewrote the
*recipient's* array to update the preview and unread flag. To allow that, the
rules had to let any signed-in user read and overwrite any user's chat list,
which exposed everyone's latest messages and let anyone wipe someone's
sidebar. Concurrent senders could also overwrite each other's updates.

## Decision

Shared state moves onto the chat document, which only its members can touch:
the last-message preview, the time of the newest message, and a read marker
per member. The sidebar becomes a live query:

```
chats where participantIds array-contains me, order by updatedAt desc
```

Unread is derived (last message from someone else, newer than my marker).
Muted and archived stay per user, in `userChats/{uid}`, now owner-only.
Direct chats use the sorted pair of user ids as their id, so there can only be
one per pair, and a message and its preview are written in one batch.

## Consequences

- No user writes another user's documents, so the rules can be strict.
- One composite index is needed for the sidebar query.
- Typing updates touch the chat document, so the sidebar listener fires on
  them; profiles are cached briefly to keep that cheap.
- Existing data didn't fit the new shape; the project was reseeded rather
  than migrated.
