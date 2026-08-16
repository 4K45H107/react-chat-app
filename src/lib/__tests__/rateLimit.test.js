import { describe, expect, it, beforeEach } from "vitest";
import {
  RATE_LIMITS,
  RateLimitError,
  __resetRateLimitStateForTests,
  assertRateLimit,
  checkRateLimit,
  formatRetryAfter,
  rateLimitToastMessage,
  tryRateLimit,
} from "../rateLimit";

const memory = new Map();

globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
  key: (index) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

describe("rateLimit", () => {
  beforeEach(() => {
    memory.clear();
    __resetRateLimitStateForTests();
  });

  it("only defines upload limits", () => {
    expect(Object.keys(RATE_LIMITS)).toEqual(["upload"]);
  });

  it("allows uploads under the limit", () => {
    expect(tryRateLimit("u1", "upload")).toBe(true);
  });

  it("blocks when the upload bucket is full", () => {
    const max = RATE_LIMITS.upload[0].max;
    for (let i = 0; i < max; i += 1) {
      expect(tryRateLimit("u1", "upload")).toBe(true);
    }
    expect(tryRateLimit("u1", "upload")).toBe(false);
  });

  it("assertRateLimit throws RateLimitError", () => {
    const max = RATE_LIMITS.upload[0].max;
    for (let i = 0; i < max; i += 1) assertRateLimit("u1", "upload");
    expect(() => assertRateLimit("u1", "upload")).toThrow(RateLimitError);
  });

  it("isolates users", () => {
    const max = RATE_LIMITS.upload[0].max;
    for (let i = 0; i < max; i += 1) assertRateLimit("a", "upload");
    expect(tryRateLimit("b", "upload")).toBe(true);
  });

  it("formats retry windows", () => {
    expect(formatRetryAfter(1500)).toBe("2s");
    expect(formatRetryAfter(90_000)).toBe("2 min");
  });

  it("builds toast text for RateLimitError only", () => {
    const err = new RateLimitError("upload", 5000);
    expect(rateLimitToastMessage(err)).toMatch(/Slow down/);
    expect(rateLimitToastMessage(new Error("x"))).toBeNull();
  });

  it("reports retryAfterMs when blocked", () => {
    const now = 1_000_000;
    const max = RATE_LIMITS.upload[0].max;
    for (let i = 0; i < max; i += 1) {
      checkRateLimit("u1", "upload", now);
    }
    const blocked = checkRateLimit("u1", "upload", now + 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
});
