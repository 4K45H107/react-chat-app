import { describe, expect, it } from "vitest";
import { getUnreadNotificationTargets } from "../notifications";

describe("getUnreadNotificationTargets", () => {
  const chat = {
    chatId: "c1",
    lastMessage: "hi",
    isSeen: false,
    updatedAt: 200,
    user: { username: "bob" },
  };

  it("returns nothing on first hydrate", () => {
    expect(getUnreadNotificationTargets([chat], null, null)).toEqual([]);
  });

  it("notifies when an unread preview updates", () => {
    const previous = new Map([
      ["c1", { updatedAt: 100, lastMessage: "old" }],
    ]);
    expect(getUnreadNotificationTargets([chat], previous, null)).toEqual([
      chat,
    ]);
  });

  it("skips the currently open chat", () => {
    const previous = new Map([
      ["c1", { updatedAt: 100, lastMessage: "old" }],
    ]);
    expect(getUnreadNotificationTargets([chat], previous, "c1")).toEqual([]);
  });

  it("skips muted chats", () => {
    const previous = new Map([
      ["c1", { updatedAt: 100, lastMessage: "old" }],
    ]);
    expect(
      getUnreadNotificationTargets(
        [{ ...chat, muted: true }],
        previous,
        null
      )
    ).toEqual([]);
  });
});
