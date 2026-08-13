import { describe, expect, it } from "vitest";
import { getBlockFlags } from "../blockFlags";

describe("getBlockFlags", () => {
  const alice = { id: "alice", blocked: [] };
  const bob = { id: "bob", blocked: [] };

  it("returns no blocks when neither user blocked the other", () => {
    expect(getBlockFlags(alice, bob)).toEqual({
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
    });
  });

  it("marks current user blocked when partner blocked them", () => {
    expect(
      getBlockFlags(alice, { id: "bob", blocked: ["alice"] })
    ).toEqual({
      isCurrentUserBlocked: true,
      isReceiverBlocked: false,
    });
  });

  it("marks receiver blocked when current user blocked them", () => {
    expect(
      getBlockFlags({ id: "alice", blocked: ["bob"] }, bob)
    ).toEqual({
      isCurrentUserBlocked: false,
      isReceiverBlocked: true,
    });
  });

  it("prefers partner-blocked-me over mutual block", () => {
    expect(
      getBlockFlags(
        { id: "alice", blocked: ["bob"] },
        { id: "bob", blocked: ["alice"] }
      )
    ).toEqual({
      isCurrentUserBlocked: true,
      isReceiverBlocked: false,
    });
  });

  it("handles missing blocked fields via normalizeUser", () => {
    expect(getBlockFlags({ id: "alice" }, { id: "bob" })).toEqual({
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
    });
  });
});
