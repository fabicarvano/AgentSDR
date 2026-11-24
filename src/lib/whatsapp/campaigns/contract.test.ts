import { describe, expect, test } from "bun:test";
import {
  whatsappCampaignStepsError,
  whatsappCampaignStepsProblem,
  type WhatsappCampaignStep,
} from "./contract";

const step = (id: string, overrides: Partial<WhatsappCampaignStep> = {}): WhatsappCampaignStep => ({ id, body: "Hi", delayHours: 24, ...overrides });

describe("whatsappCampaignStepsProblem / whatsappCampaignStepsError", () => {
  test("a valid sequence (and an empty one) has no problem", () => {
    expect(whatsappCampaignStepsProblem([step("a"), step("b")])).toBeNull();
    expect(whatsappCampaignStepsProblem([])).toBeNull();
    expect(whatsappCampaignStepsError([step("a"), step("b")])).toBeNull();
  });

  const cases: Array<[string, WhatsappCampaignStep[], unknown, string]> = [
    ["too many steps", ["a", "b", "c", "d", "e", "f", "g"].map((id) => step(id)), { code: "tooManySteps", max: 6 }, "A sequence has at most 6 messages"],
    ["missing id on the first step", [step("")], { code: "needsUniqueId", position: 0 }, "The first message needs a unique id"],
    ["duplicate id", [step("a"), step("a")], { code: "needsUniqueId", position: 1 }, "Follow-up 1 needs a unique id"],
    ["empty first body", [step("a", { body: "  " })], { code: "empty", position: 0 }, "The first message is empty"],
    ["empty follow-up body", [step("a"), step("b", { body: "" })], { code: "empty", position: 1 }, "Follow-up 1 is empty"],
    ["body too long", [step("a"), step("b", { body: "x".repeat(4097) })], { code: "tooLong", position: 1, max: 4096 }, "Follow-up 1 is longer than 4096 characters"],
    ["fractional delay", [step("a"), step("b", { delayHours: 1.5 })], { code: "delayNotWhole", position: 1 }, "Follow-up 1's wait must be whole hours"],
    ["delay too short", [step("a"), step("b"), step("c", { delayHours: 0 })], { code: "delayRange", position: 2, minHours: 1, maxDays: 30 }, "Follow-up 2 must wait between 1 hour and 30 days"],
    ["delay too long", [step("a"), step("b", { delayHours: 721 })], { code: "delayRange", position: 1, minHours: 1, maxDays: 30 }, "Follow-up 1 must wait between 1 hour and 30 days"],
  ];
  for (const [name, steps, problem, text] of cases) {
    test(name, () => {
      expect(whatsappCampaignStepsProblem(steps)).toEqual(problem as never);
      expect(whatsappCampaignStepsError(steps)).toBe(text);
    });
  }

  test("the first step's delay is ignored; limits are inclusive", () => {
    expect(whatsappCampaignStepsProblem([step("a", { delayHours: 0.5 })])).toBeNull();
    expect(whatsappCampaignStepsProblem([step("a"), step("b", { delayHours: 1 }), step("c", { delayHours: 720 })])).toBeNull();
  });

  test("the first problem found wins", () => {
    expect(whatsappCampaignStepsProblem([step("a", { body: "" }), step("a")])).toEqual({ code: "empty", position: 0 });
  });
});
