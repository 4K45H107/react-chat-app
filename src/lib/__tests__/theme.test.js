import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme, cycleTheme, getStoredTheme, THEMES } from "../theme";

const memory = new Map();
const docEl = {
  attrs: /** @type {Record<string, string>} */ ({}),
  setAttribute(key, value) {
    this.attrs[key] = String(value);
  },
  getAttribute(key) {
    return this.attrs[key] ?? null;
  },
  removeAttribute(key) {
    delete this.attrs[key];
  },
};

globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};

globalThis.document = {
  documentElement: docEl,
};

describe("theme helpers", () => {
  beforeEach(() => {
    memory.clear();
    docEl.attrs = {};
  });

  it("defaults to dark", () => {
    expect(getStoredTheme()).toBe("dark");
  });

  it("applies and stores a theme", () => {
    expect(applyTheme("light")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(getStoredTheme()).toBe("light");
  });

  it("cycles between available themes", () => {
    applyTheme("dark");
    expect(cycleTheme()).toBe("light");
    expect(cycleTheme()).toBe("dark");
    expect(THEMES).toEqual(["dark", "light"]);
  });
});
