import { describe, expect, it } from "vitest";
import { normalizeUser } from "../normalizeUser";

describe("normalizeUser", () => {
  it("returns null for missing user", () => {
    expect(normalizeUser(null)).toBeNull();
    expect(normalizeUser(undefined)).toBeNull();
  });

  it("defaults blocked to an empty array", () => {
    expect(normalizeUser({ id: "a", username: "alice" }).blocked).toEqual([]);
  });

  it("keeps a valid blocked array", () => {
    const user = normalizeUser({ id: "a", blocked: ["b"] });
    expect(user.blocked).toEqual(["b"]);
  });

  it("replaces non-array blocked values", () => {
    expect(normalizeUser({ id: "a", blocked: null }).blocked).toEqual([]);
    expect(normalizeUser({ id: "a", blocked: "x" }).blocked).toEqual([]);
  });
});
