# 0005. Split the bundle at the sign-in boundary

**Status:** accepted

## Context

The app shipped as one 1.1 MB file (282 KB gzip). Measured with a bundle
analyzer, Firestore was 40% of it and the emoji picker 18%, yet the first
screen most visitors see is the login form, which needs neither.

## Decision

- Firebase is initialised in three modules: app + Auth (`firebase.js`),
  Firestore (`db.js`) and Storage (`storage.js`). Auth uses `initializeAuth`
  with explicit persistence, which leaves out the unused popup sign-in code.
- Everything behind sign-in is one lazy chunk (`SignedInApp`), prefetched as
  soon as the login screen is idle, so it's usually ready before the user
  submits the form.
- The emoji picker loads on first open (preloaded on hover or focus), and
  Storage on the first upload.
- React and Firebase core get their own long-cached vendor files.
- size-limit budgets in CI keep each chunk from growing back.

## Consequences

- The login screen needs 84 KB (gzip) instead of 282 KB, about 70% less.
- Returning signed-in users download the signed-in chunk right after Auth
  restores their session; the "Loading..." screen covers that gap.
- Code that reads Firestore before sign-in (the profile lookup, sign-up) has
  to import it dynamically, which is easy to get wrong in new code; the size
  budget catches it.
