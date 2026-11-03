# Data model and security

All access control lives in [`firestore.rules`](../firestore.rules) and
[`storage.rules`](../storage.rules). The rules are covered by 36 tests in
[`tests/rules`](../tests/rules); see [testing.md](testing.md).

## Principles

1. **Nobody writes another user's documents.** Shared state lives on the chat
   document, which only its members can touch; personal state lives in a
   document only its owner can read.
2. **Every write is limited to the fields it may change**, and each field has
   a rule.
3. **Timestamps come from the server** (`request.time`), so messages and
   read markers can't be backdated.
4. **The rules enforce what the UI promises**: blocking, leaving a group,
   who may answer a call.

## Collections

### `users/{uid}`: public profile

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Same as the document id |
| `username` | string | Display name, 2 to 40 characters |
| `avatar` | string | Download URL, or empty |
| `blocked` | string[] | User ids this user has blocked |
| `lastActive` | timestamp | Presence heartbeat |

Readable by any signed-in user (needed to find people and show names).
Writable only by its owner. **No email**: Firebase Auth keeps it, and the
rules reject an `email` field.

### `userChats/{uid}`: private settings

```js
{ prefs: { [chatId]: { muted: boolean, archived: boolean } } }
```

Readable and writable by its owner only.

### `chats/{chatId}`: one per conversation

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `"direct"` \| `"group"` | |
| `participantIds` | string[] | Members |
| `createdBy`, `createdAt` | string, timestamp | |
| `name`, `avatar` | string | Groups only |
| `lastMessage` | `{ text, senderId }` | Sidebar preview, at most 200 characters |
| `updatedAt` | timestamp | Time of the newest message; the sidebar sorts by it |
| `readAt` | `{ [uid]: timestamp }` | Each member's read marker |
| `typing` | `{ userId, updatedAt }` | Typing indicator |

A direct chat's id is the two user ids, sorted and joined with `_`, so a pair
of users can only ever have one direct chat. The rules check the format.

**Unread** is derived, not stored: a chat is unread for a member when the last
message is from someone else and is newer than their `readAt` marker.

### `chats/{chatId}/messages/{messageId}`

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `senderId`, `text`, `createdAt` | | Required; `createdAt` must be the server time |
| `img`, `audio`, `audioDuration` | | Photo or voice note (URL, seconds ≤ 600) |
| `call` | `{ type, status, callId, durationSec }` | Call history entry |
| `edited`, `editedAt` | | Set by an edit |
| `deleted` | `true` | Soft delete: text and media are cleared |

### `calls/{callId}` and `calls/{callId}/iceCandidates/{id}`

Signaling for one-to-one calls; see [calls.md](calls.md).

## Indexes

[`firestore.indexes.json`](../firestore.indexes.json) defines one composite
index: `chats` by `participantIds` (array-contains) and `updatedAt`
(descending), which serves the sidebar query.

## What the rules allow

| Action | Who | Checks |
| --- | --- | --- |
| Read a profile | Any signed-in user | |
| Write a profile | Its owner | Allowed fields only, no email |
| Read / write private settings | Its owner | |
| Create a direct chat | One of the two users | Sorted-pair id, partner exists, neither has blocked the other |
| Create a group | A member | 3 to 50 members, name 1 to 60 characters |
| List chats | A member | Query must filter on your own id |
| Update a chat | A member | Preview as yourself at server time; only your own read marker; typing only about yourself; name and photo for groups; membership: only removing yourself |
| Delete a chat | Nobody | |
| Send a message | A member | As yourself, at server time, allowed fields; not in a direct chat where either side blocked the other |
| Edit / delete a message | Its sender | Text-only edit; delete clears text and media; no hard deletes |
| Start a call | Caller in a direct chat | Callee is the other member, not blocked |
| Answer / decline a call | The callee | `ringing → active`, `ringing → declined / busy` |
| End a call | Either party | `ringing → missed / ended`, `active → ended` |

## Storage

| Path | Write | Read |
| --- | --- | --- |
| `images/{uid}/...` | Owner only, image types, under 5 MB | Signed-in users |
| `audio/{uid}/...` | Owner only, audio types, under 10 MB | Signed-in users |
