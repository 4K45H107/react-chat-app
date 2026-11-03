# Deployment

The app is hosted on **Firebase Hosting** at
<https://reactchat-ed5f2.web.app>, on the Blaze plan with a budget alert.

## Pipeline

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) deploys on every push
to `main`, after both test jobs pass:

```
push to main → lint, unit tests, build, size budgets ─┐
             → rules + integration tests (emulators) ─┴→ build with secrets → Firebase Hosting
```

Pull requests run the same checks but never deploy.

## Hosting config

[`firebase.json`](../firebase.json) serves `dist/` and sends every path to
`index.html` (single-page app). Headers:

| Path | Cache-Control | Why |
| --- | --- | --- |
| `/`, `*.html`, paths without an extension | `no-cache` | A new deploy is picked up on the next visit |
| `/assets/**` | `max-age=31536000, immutable` | File names contain a content hash |

Every response also sends `X-Content-Type-Options: nosniff`, a
`Referrer-Policy`, and a `Permissions-Policy` that allows the camera and
microphone for this site only.

## GitHub secrets

| Secret | Used by | What it is |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_REACTCHAT_ED5F2` | Deploy | Service account that can deploy Hosting only (created by `firebase init hosting:github`) |
| `VITE_API_KEY` | Deploy (build) | Firebase web API key, restricted to the app's domains |
| `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` | Deploy (build) | Metered TURN credential ([calls.md](calls.md)) |
| `DEMO_SEED_SERVICE_ACCOUNT` | Demo reset | Service account limited to Auth, Firestore and Storage objects |

## Nightly demo reset

The demo logins are public, so visitors change things.
[`reset-demo.yml`](../.github/workflows/reset-demo.yml) runs
[`scripts/seed.mjs`](../scripts/seed.mjs) every night at 03:00 Dhaka time
(and on demand from the Actions tab). It deletes the demo accounts and
everything they created, then recreates them with the original chat history,
re-dated relative to the current time.

GitHub pauses scheduled workflows after 60 days without repository activity;
re-enable it from the Actions tab if that happens.

## Rules and indexes

Firestore rules and indexes are deployed by hand, since they change rarely and
need broader permissions than the Hosting deploy account:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```
