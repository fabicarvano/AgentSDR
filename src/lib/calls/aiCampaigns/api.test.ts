import { describe, expect, test } from "bun:test";
import {
  aiCampaignState,
  aiLaunchBlocker,
  aiLaunchProblem,
  aiLaunchProblemText,
  aiLeadStepLabel,
  aiSequencesError,
  aiSequencesProblem,
  aiSettingsError,
  aiSettingsProblem,
  aiSettingsProblemText,
  aiStepLabel,
  aiStepPosition,
  aiStepPositionLabel,
  callsPerDayLimit,
  describeStepKey,
  httpsUrl,
  previewAiMessage,
} from "./api";
import { DEFAULT_BOOKING_MESSAGE, DEFAULT_CHASE_STEPS, DEFAULT_REACH_STEPS } from "./contract";

const settings = { goal: "book_meeting" as const, instructions: "Call founders", bookingUrl: "https://cal.com/acme/30min", bookingMessage: DEFAULT_BOOKING_MESSAGE, maxCallbacks: 2 };

describe("aiLaunchBlocker", () => {
  const ready: Parameters<typeof aiLaunchProblem>[0] = { numbers: 1, steps: DEFAULT_REACH_STEPS, instructions: "x", goal: "book_meeting", bookingUrl: "https://cal.com/a/b", leads: 3 };
  test("a complete campaign has no blocker", () => expect(aiLaunchBlocker(ready)).toBeNull());
  test("needs a number, a call step, instructions, leads", () => {
    expect(aiLaunchBlocker({ ...ready, numbers: 0 })).toContain("number");
    expect(aiLaunchBlocker({ ...ready, steps: [DEFAULT_REACH_STEPS[2]!] })).toContain("call");
    expect(aiLaunchBlocker({ ...ready, instructions: "  " })).toContain("instructions");
    expect(aiLaunchBlocker({ ...ready, leads: 0 })).toContain("lead");
  });
  test("a booking link is required unless the goal is a hand-over", () => {
    expect(aiLaunchBlocker({ ...ready, bookingUrl: null })).toContain("booking link");
    expect(aiLaunchBlocker({ ...ready, bookingUrl: null, goal: "either" })).toContain("booking link");
    expect(aiLaunchBlocker({ ...ready, bookingUrl: null, goal: "human_callback" })).toBeNull();
  });
});

describe("aiSettingsError", () => {
  test("accepts valid settings", () => expect(aiSettingsError(settings)).toBeNull());
  test("the booking link must be https", () => {
    expect(aiSettingsError({ ...settings, bookingUrl: "http://cal.com/x" })).toContain("https");
    expect(aiSettingsError({ ...settings, bookingUrl: "cal.com/x" })).toContain("https");
  });
  test("the booking message needs {{bookingLink}} when a link is set", () => {
    expect(aiSettingsError({ ...settings, bookingMessage: "Book here" })).toContain("{{bookingLink}}");
    expect(aiSettingsError({ ...settings, bookingUrl: null, bookingMessage: "Book here" })).toBeNull();
  });
  test("instructions and call-backs are bounded", () => {
    expect(aiSettingsError({ ...settings, instructions: "x".repeat(4001) })).toContain("4000");
    expect(aiSettingsError({ ...settings, maxCallbacks: 4 })).toContain("between 0 and 3");
    expect(aiSettingsError({ ...settings, maxCallbacks: 0 })).toBeNull();
  });
});

describe("aiSequencesError", () => {
  test("the defaults are valid", () => expect(aiSequencesError(DEFAULT_REACH_STEPS, DEFAULT_CHASE_STEPS)).toBeNull());
  test("the chase may be empty, the reach may not", () => {
    expect(aiSequencesError(DEFAULT_REACH_STEPS, [])).toBeNull();
    expect(aiSequencesError([], [])).toContain("Reach them");
  });
  test("names which sequence is wrong", () => {
    expect(aiSequencesError(DEFAULT_REACH_STEPS, [{ id: "a", kind: "message", delayHours: 1, body: "" }])).toContain("haven't booked");
  });
});

describe("helpers", () => {
  test("httpsUrl", () => {
    expect(httpsUrl(" https://cal.com/acme ")).toBe("https://cal.com/acme");
    expect(httpsUrl("javascript:alert(1)")).toBeNull();
    expect(httpsUrl("https://localhost")).toBeNull();
  });
  test("previewAiMessage fills known fields and leaves the rest", () => {
    expect(previewAiMessage("Hi {{firstName}} {{ agentName }} {{nope}}", { firstName: "Priya", agentName: "Riya" })).toBe("Hi Priya Riya {{nope}}");
  });
  test("aiStepLabel counts per kind", () => {
    expect(aiStepLabel(DEFAULT_REACH_STEPS, 0, false)).toBe("Call 1 of 3");
    expect(aiStepLabel(DEFAULT_REACH_STEPS, 2, false)).toBe("Message 1 of 1");
    expect(aiStepLabel(DEFAULT_REACH_STEPS, 3, true)).toBe("Call 3 of 3 (chasing the booking)");
    expect(aiStepLabel(DEFAULT_REACH_STEPS, 9, false)).toBeNull();
  });
  test("describeStepKey reads the engine's keys, retries included", () => {
    expect(describeStepKey("reach:call-1")).toMatchObject({ phase: "reach", stepId: "call-1" });
    expect(describeStepKey("retry:chase:chase-call-1:2")).toMatchObject({ phase: "chase", stepId: "chase-call-1" });
    expect(describeStepKey("callback:1")).toMatchObject({ phase: "system", stepId: null, label: "Call back 1" });
    expect(describeStepKey("booking-link").label).toBe("Booking link");
  });
  test("aiCampaignState", () => {
    expect(aiCampaignState({ launchedAt: null, status: "paused" })).toBe("draft");
    expect(aiCampaignState({ launchedAt: "2026-10-01", status: "paused" })).toBe("paused");
    expect(aiCampaignState({ launchedAt: new Date(), status: "active" })).toBe("active");
  });
  test("callsPerDayLimit uses each number's own limit, else the rule", () => {
    expect(callsPerDayLimit([{ callsPerDay: 10 }, { callsPerDay: null }], 30)).toBe(40);
  });
});

describe("aiLaunchProblem / aiLaunchProblemText", () => {
  const ready: Parameters<typeof aiLaunchProblem>[0] = { numbers: 1, steps: DEFAULT_REACH_STEPS, instructions: "x", goal: "book_meeting", bookingUrl: "https://cal.com/a/b", leads: 3 };
  test("a complete campaign has no problem", () => expect(aiLaunchProblem(ready)).toBeNull());
  test("each case has its code and its English text", () => {
    const cases: Array<[Partial<typeof ready>, string, string]> = [
      [{ numbers: 0 }, "noNumber", "Choose at least one calling number"],
      [{ steps: [DEFAULT_REACH_STEPS[2]!] }, "noCall", "Add at least one call to the sequence"],
      [{ instructions: "  " }, "noInstructions", "Write the campaign instructions (what every call is about)"],
      [{ bookingUrl: null }, "noBooking", "Add the booking link, or set the goal to hand over to the team"],
      [{ leads: 0 }, "noLeads", "Add at least one lead"],
    ];
    for (const [override, code, text] of cases) {
      const problem = aiLaunchProblem({ ...ready, ...override });
      expect(problem).toEqual({ code } as never);
      expect(aiLaunchProblemText(problem!)).toBe(text);
      expect(aiLaunchBlocker({ ...ready, ...override })).toBe(text);
    }
  });
  test("a hand-over goal needs no booking link", () => {
    expect(aiLaunchProblem({ ...ready, bookingUrl: null, goal: "human_callback" })).toBeNull();
  });
});

describe("aiSettingsProblem / aiSettingsProblemText", () => {
  test("valid settings have no problem", () => expect(aiSettingsProblem(settings)).toBeNull());
  test("each case has its code and its English text", () => {
    const cases: Array<[Partial<typeof settings>, unknown, string]> = [
      [{ goal: "nope" as never }, { code: "goal" }, "Choose what the calls are for"],
      [{ instructions: "x".repeat(4001) }, { code: "instructionsLong", max: 4000 }, "Instructions must be at most 4000 characters"],
      [{ bookingUrl: "http://cal.com/x" }, { code: "bookingUrl" }, "The booking link must be an https:// address"],
      [{ bookingMessage: "x".repeat(1001) }, { code: "bookingMessageLong", max: 1000 }, "The booking message must be at most 1000 characters"],
      [{ bookingMessage: "Book here" }, { code: "bookingMessageToken" }, "The booking message must include {{bookingLink}}"],
      [{ maxCallbacks: 4 }, { code: "callbacks", max: 3 }, "Call-backs must be between 0 and 3"],
      [{ maxCallbacks: -1 }, { code: "callbacks", max: 3 }, "Call-backs must be between 0 and 3"],
      [{ maxCallbacks: 1.5 }, { code: "callbacks", max: 3 }, "Call-backs must be between 0 and 3"],
    ];
    for (const [override, expected, text] of cases) {
      const problem = aiSettingsProblem({ ...settings, ...override });
      expect(problem).toEqual(expected as never);
      expect(aiSettingsProblemText(problem!)).toBe(text);
      expect(aiSettingsError({ ...settings, ...override })).toBe(text);
    }
  });
});

describe("aiSequencesProblem", () => {
  test("the defaults and an empty chase are fine", () => {
    expect(aiSequencesProblem(DEFAULT_REACH_STEPS, DEFAULT_CHASE_STEPS)).toBeNull();
    expect(aiSequencesProblem(DEFAULT_REACH_STEPS, [])).toBeNull();
  });
  test("names the sequence that is wrong", () => {
    expect(aiSequencesProblem([], [])?.sequence).toBe("reach");
    expect(aiSequencesProblem(DEFAULT_REACH_STEPS, [{ id: "a", kind: "message", delayHours: 1, body: "" }])?.sequence).toBe("chase");
  });
  test("the reach is checked before the chase", () => {
    expect(aiSequencesProblem([], [{ id: "a", kind: "message", delayHours: 1, body: "" }])?.sequence).toBe("reach");
  });
});

describe("aiStepPosition / aiStepPositionLabel / aiLeadStepLabel", () => {
  test("aiStepPosition counts per kind", () => {
    expect(aiStepPosition(DEFAULT_REACH_STEPS, 0, false)).toEqual({ kind: "call", index: 1, total: 3, chase: false });
    expect(aiStepPosition(DEFAULT_REACH_STEPS, 2, false)).toEqual({ kind: "message", index: 1, total: 1, chase: false });
    expect(aiStepPosition(DEFAULT_REACH_STEPS, 3, true)).toEqual({ kind: "call", index: 3, total: 3, chase: true });
    expect(aiStepPosition(DEFAULT_REACH_STEPS, 9, false)).toBeNull();
    expect(aiStepPosition(DEFAULT_REACH_STEPS, -1, false)).toBeNull();
  });
  test("aiStepPositionLabel is the English line aiStepLabel always gave", () => {
    expect(aiStepPositionLabel({ kind: "call", index: 2, total: 4, chase: false })).toBe("Call 2 of 4");
    expect(aiStepPositionLabel({ kind: "message", index: 1, total: 1, chase: true })).toBe("Message 1 of 1 (chasing the booking)");
    for (const [index, chase] of [[0, false], [2, false], [3, true]] as const) {
      expect(aiStepPositionLabel(aiStepPosition(DEFAULT_REACH_STEPS, index, chase)!)).toBe(aiStepLabel(DEFAULT_REACH_STEPS, index, chase)!);
    }
  });
  test("aiLeadStepLabel", () => {
    expect(aiLeadStepLabel(null)).toBeNull();
    expect(aiLeadStepLabel({ type: "callback", n: 2 })).toBe("Call back 2");
    const position = aiStepPosition(DEFAULT_REACH_STEPS, 3, true)!;
    expect(aiLeadStepLabel({ type: "step", position })).toBe(aiStepLabel(DEFAULT_REACH_STEPS, 3, true)!);
    expect(aiLeadStepLabel({ type: "step", position })).toBe("Call 3 of 3 (chasing the booking)");
  });
});
