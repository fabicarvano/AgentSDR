import { describe, expect, test } from "bun:test";
import { shouldOpenPopup, shouldPersistDismissal, shownFlagKey } from "./popup";

describe("shouldOpenPopup", () => {
  test("opens when not dismissed and not yet shown in this session", () => {
    expect(shouldOpenPopup({ dismissed: false, shownThisSession: false })).toBe(true);
  });
  test("does not reopen in the same session", () => {
    expect(shouldOpenPopup({ dismissed: false, shownThisSession: true })).toBe(false);
  });
  test("never opens once dismissed for good", () => {
    expect(shouldOpenPopup({ dismissed: true, shownThisSession: false })).toBe(false);
    expect(shouldOpenPopup({ dismissed: true, shownThisSession: true })).toBe(false);
  });
});

describe("shouldPersistDismissal", () => {
  test("closing without the checkbox saves nothing", () => {
    expect(shouldPersistDismissal({ checkboxChecked: false })).toBe(false);
  });
  test("closing with the checkbox saves the dismissal", () => {
    expect(shouldPersistDismissal({ checkboxChecked: true })).toBe(true);
  });
});

describe("shownFlagKey", () => {
  test("differs per session and per version, so a new sign-in shows it again", () => {
    expect(shownFlagKey("s1", "0.5.1")).not.toBe(shownFlagKey("s2", "0.5.1"));
    expect(shownFlagKey("s1", "0.5.1")).not.toBe(shownFlagKey("s1", "0.5.2"));
    expect(shownFlagKey("s1", "0.5.1")).toBe(shownFlagKey("s1", "0.5.1"));
  });
});
