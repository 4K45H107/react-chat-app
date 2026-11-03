# Testing and local development

Everything below runs against the **Firebase Emulator Suite**, so it never
touches the live project. The emulators need Java 21+.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for helpers (Vitest) |
| `npm run test:rules` | 36 Firestore rules tests on the Firestore emulator |
| `npm run test:integration` | Seeds the emulators, then runs 11 end-to-end flows through the app's own services |
| `npm run lint` | ESLint |
| `npm run build && npm run size` | Production build, then bundle size budgets |
| `npm run emulators` | Start Auth, Firestore and Storage emulators (UI on :4000) |
| `npm run seed:emulators` | Load demo accounts and chats into running emulators |
| `npm run dev:emulators` | Run the app against the emulators |

## Rules tests

[`tests/rules/firestore.rules.test.js`](../tests/rules/firestore.rules.test.js)
checks both sides of each rule: what members may do, and what strangers,
impersonators and blocked users may not. For example:

- a stranger can't read a chat or its messages
- you can't list everyone's chats, only your own
- a member can't add someone to a group, only leave it
- a message can't be sent in someone else's name or backdated
- only the callee can answer a call

Run against the rules this project used before its security rework, 18 of
the 36 tests fail, one for each hole that was closed.

## Integration tests

[`tests/integration/app.test.js`](../tests/integration/app.test.js) signs in as
the demo users and drives `chatService` and `callService`: sidebar order and
unread state, read markers, atomic message + preview writes, private
settings, one chat per pair, a group's whole life, a full call with its
history message, blocking in both directions, and sign-up without an email.

## Demo data

[`scripts/seed.mjs`](../scripts/seed.mjs) creates four users with generated
avatars and four chats: a main thread with a photo, an edit, a deletion and a
call log; an unread chat for each demo login; and a group. It deletes the
previous demo data first, so it's safe to re-run.

```bash
# Emulators
npm run emulators            # terminal 1
npm run seed:emulators       # terminal 2

# Live project (needs a service account key; keep it out of the repo)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run seed
```

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull
request and push to `main`, in two parallel jobs:

1. Lint, unit tests, build, bundle size budgets
2. Rules tests and integration tests on the emulators
