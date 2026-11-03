/**
 * ICE servers for calls.
 * STUN finds each peer's public address, which is enough for most calls.
 * TURN relays the media when a direct connection fails (strict NAT, mobile
 * and office networks). Metered's relay is used when credentials are set in
 * the environment (see .env.example); without them calls fall back to STUN.
 * TURN credentials always reach the browser; the plan's quota caps misuse.
 */
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

const TURN_URLS = [
  "turn:global.relay.metered.ca:80",
  "turn:global.relay.metered.ca:80?transport=tcp",
  "turn:global.relay.metered.ca:443",
  "turns:global.relay.metered.ca:443?transport=tcp",
];

const HAS_TURN = Boolean(TURN_USERNAME && TURN_CREDENTIAL);

export const RTC_CONFIGURATION = {
  iceServers: [
    { urls: ["stun:stun.relay.metered.ca:80", "stun:stun.l.google.com:19302"] },
    ...(HAS_TURN
      ? [
          {
            urls: TURN_URLS,
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
};

/** Auto-miss ringing calls after this many ms. */
export const CALL_RING_TIMEOUT_MS = 45_000;

/** How long to wait in "connecting" before showing a soft warning. */
export const CALL_CONNECT_WARN_MS = 12_000;
