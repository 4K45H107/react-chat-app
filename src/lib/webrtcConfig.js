/**
 * ICE servers for portfolio demos.
 * STUN finds public addresses; TURN relays when direct peer connection fails
 * (common across different networks / strict NAT).
 *
 * Open Relay (Metered) free TURN is for testing — fine for a portfolio showcase.
 */
export const RTC_CONFIGURATION = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

/** Auto-miss ringing calls after this many ms. */
export const CALL_RING_TIMEOUT_MS = 45_000;

/** How long to wait in "connecting" before showing a soft warning. */
export const CALL_CONNECT_WARN_MS = 12_000;
