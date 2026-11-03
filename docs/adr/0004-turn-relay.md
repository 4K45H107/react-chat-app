# 0004. A hosted TURN relay with credentials in the client

**Status:** accepted

## Context

STUN alone connects most calls, but fails when both sides sit behind strict
NAT (common on mobile carriers and office networks). The app used shared
public credentials for a free test relay, which were unreliable and outside
our control.

## Decision

Use [Metered](https://www.metered.ca/)'s TURN relay with the project's own
credential, offered over UDP, TCP and TLS on ports 80 and 443. The username
and password come from build-time environment variables.

## Alternatives considered

- **Short-lived credentials from a Cloud Function** (Metered's API or
  Cloudflare TURN): credentials expire, so a leaked one is useless later.
  More robust, but adds a function to deploy and maintain.
- **Self-hosting coturn**: full control, but a server to run and patch.

## Consequences

- TURN credentials are visible to anyone who opens the app; that's inherent
  to TURN in the browser. The free plan's 500 MB monthly quota caps misuse,
  and relaying stops when it runs out rather than billing.
- If the credential is abused, it can be deleted and replaced in Metered's
  dashboard and the site rebuilt. Moving to short-lived credentials is the
  upgrade path.
