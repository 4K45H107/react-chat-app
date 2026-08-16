# Staying on Firebase Spark (free)

## Rate limiting

Only **Storage uploads** (photos, voice notes, avatars) are rate-limited in the
app (`src/lib/rateLimit.js`). Text, DMs, groups, typing, and presence are left
alone — they are tiny Firestore ops and won’t meaningfully stress Spark for a
small personal chat app.

## Important

1. **Spark does not auto-upgrade to Blaze.** Pay-as-you-go only starts if you
   enable the Blaze plan in the Firebase Console.
2. Client limits can be bypassed by a modified client.
3. Hard server enforcement (App Check / Cloud Functions) usually needs Blaze.

## What to do in Console

- Keep the project on **Spark (free)**.
- Do **not** enable Blaze unless you accept billing.
