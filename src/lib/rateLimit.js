/**
 * Client-side rate limits aimed at Firebase Spark (free) quotas.
 *
 * Only Storage uploads (photos / voice / avatars) are throttled. Text messages,
 * DMs, groups, typing, and presence are tiny Firestore ops and are left alone
 * for a small personal app.
 *
 * This cannot force the Firebase plan to stay on Spark (that is a Console
 * setting), and a modified client can bypass it.
 */

const STORAGE_PREFIX = "rca:rate:";

/** @typedef {{ id: string, windowMs: number, max: number }} RateBucket */

/** @type {Record<string, RateBucket[]>} */
export const RATE_LIMITS = {
  /** Image, voice, and avatar uploads to Storage (the costly free-tier item) */
  upload: [
    { id: "upload:min", windowMs: 60_000, max: 8 },
    { id: "upload:day", windowMs: 86_400_000, max: 80 },
  ],
};

export class RateLimitError extends Error {
  /**
   * @param {string} action
   * @param {number} retryAfterMs
   */
  constructor(action, retryAfterMs) {
    super(`Too many “${action}” actions. Please wait and try again.`);
    this.name = "RateLimitError";
    this.action = action;
    this.retryAfterMs = retryAfterMs;
  }
}

const memoryStore = new Map();

const storageKey = (uid, bucketId) =>
  `${STORAGE_PREFIX}${uid || "anon"}:${bucketId}`;

/**
 * @param {string} key
 * @returns {number[]}
 */
const readTimestamps = (key) => {
  if (memoryStore.has(key)) return [...memoryStore.get(key)];

  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((n) => typeof n === "number")
      : [];
  } catch {
    return [];
  }
};

/**
 * @param {string} key
 * @param {number[]} stamps
 */
const writeTimestamps = (key, stamps) => {
  memoryStore.set(key, stamps);
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(stamps));
  } catch {
    /* private mode / quota — memory still works for this session */
  }
};

/**
 * @param {string} [uid]
 * @param {string} action
 * @param {number} [now]
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export const checkRateLimit = (uid, action, now = Date.now()) => {
  const buckets = RATE_LIMITS[action];
  if (!buckets?.length) return { allowed: true, retryAfterMs: 0 };

  let worstRetry = 0;

  for (const bucket of buckets) {
    const key = storageKey(uid, bucket.id);
    const fresh = readTimestamps(key).filter((t) => now - t < bucket.windowMs);
    if (fresh.length >= bucket.max) {
      const oldest = Math.min(...fresh);
      const retryAfterMs = Math.max(0, bucket.windowMs - (now - oldest));
      worstRetry = Math.max(worstRetry, retryAfterMs);
    }
  }

  if (worstRetry > 0) {
    return { allowed: false, retryAfterMs: worstRetry };
  }

  for (const bucket of buckets) {
    const key = storageKey(uid, bucket.id);
    const fresh = readTimestamps(key).filter((t) => now - t < bucket.windowMs);
    fresh.push(now);
    writeTimestamps(key, fresh);
  }

  return { allowed: true, retryAfterMs: 0 };
};

/**
 * @param {string} [uid]
 * @param {string} action
 * @returns {boolean}
 */
export const tryRateLimit = (uid, action) => checkRateLimit(uid, action).allowed;

/**
 * @param {string} [uid]
 * @param {string} action
 */
export const assertRateLimit = (uid, action) => {
  const result = checkRateLimit(uid, action);
  if (!result.allowed) {
    throw new RateLimitError(action, result.retryAfterMs);
  }
};

/**
 * @param {number} ms
 * @returns {string}
 */
export const formatRetryAfter = (ms = 0) => {
  const sec = Math.max(1, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.ceil(min / 60);
  return `${hours}h`;
};

/**
 * Friendly toast copy for RateLimitError (and unknown errors → null).
 * @param {unknown} error
 * @returns {string|null}
 */
export const rateLimitToastMessage = (error) => {
  if (!(error instanceof RateLimitError)) return null;
  return `Slow down — try again in ${formatRetryAfter(error.retryAfterMs)}.`;
};

/** Test helper */
export const __resetRateLimitStateForTests = () => {
  memoryStore.clear();
  try {
    if (typeof localStorage === "undefined") return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
};
