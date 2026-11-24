import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inboxCrmStep, inboxCrmStepLabel, type InboxCrmStep, type InboxCrmSummary } from "./inboxContext";

const NOW = new Date("2026-09-19T12:00:00Z");

const summary = (overrides: Partial<InboxCrmSummary> = {}): InboxCrmSummary => ({
  recordId: "rec",
  workflowState: "waiting",
  categoryKey: "interested",
  subcategoryId: null,
  subcategoryName: null,
  nextActionAt: null,
  sequenceName: "Interested",
  step: null,
  hasDraft: false,
  ...overrides,
});

const step = (overrides: Partial<InboxCrmStep> = {}): InboxCrmStep => ({
  position: 2,
  total: 4,
  name: "Follow-up 1",
  type: "follow_up",
  status: "scheduled",
  dueAt: null,
  ...overrides,
});

describe("inboxCrmStepLabel", () => {
  test("workflow state wins over the step", () => {
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "closed", step: step() }), NOW), "Closed");
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "paused" }), NOW), "Paused");
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "error" }), NOW), "Needs attention");
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "classifying" }), NOW), "Classifying");
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "unclassified" }), NOW), "Classifying");
  });

  test("no run: falls back to the draft flag", () => {
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "action_required", hasDraft: true }), NOW), "Reply drafted");
    assert.equal(inboxCrmStepLabel(summary({ workflowState: "idle" }), NOW), "No next step");
  });

  test("reply step drafted or drafting", () => {
    const reply = step({ position: 1, type: "reply", name: "Reply" });
    assert.equal(inboxCrmStepLabel(summary({ step: { ...reply, status: "awaiting_review" } }), NOW), "Reply drafted");
    assert.equal(inboxCrmStepLabel(summary({ step: { ...reply, status: "drafting" } }), NOW), "Reply drafting");
    assert.equal(inboxCrmStepLabel(summary({ step: { ...reply, status: "failed" } }), NOW), "Reply failed");
  });

  test("follow-up numbering is position minus the reply step", () => {
    assert.equal(inboxCrmStepLabel(summary({ step: step({ position: 3, status: "awaiting_review" }) }), NOW), "Follow-up 2 drafted");
  });

  test("scheduled follow-up reports relative due time", () => {
    assert.equal(inboxCrmStepLabel(summary({ step: step({ dueAt: "2026-09-22T12:00:00Z" }) }), NOW), "Follow-up 1 due in 3d");
    assert.equal(inboxCrmStepLabel(summary({ step: step({ dueAt: "2026-09-19T15:30:00Z" }) }), NOW), "Follow-up 1 due in 4h");
    assert.equal(inboxCrmStepLabel(summary({ step: step({ dueAt: "2026-09-19T11:00:00Z" }) }), NOW), "Follow-up 1 due now");
    assert.equal(inboxCrmStepLabel(summary({ step: step({ dueAt: null }) }), NOW), "Follow-up 1 scheduled");
  });
});

describe("inboxCrmStep", () => {
  test("workflow state wins over the step", () => {
    assert.deepEqual(inboxCrmStep(summary({ workflowState: "closed", step: step() }), NOW), { kind: "closed" });
    assert.deepEqual(inboxCrmStep(summary({ workflowState: "paused" }), NOW), { kind: "paused" });
    assert.deepEqual(inboxCrmStep(summary({ workflowState: "error" }), NOW), { kind: "attention" });
    assert.deepEqual(inboxCrmStep(summary({ workflowState: "classifying" }), NOW), { kind: "classifying" });
    assert.deepEqual(inboxCrmStep(summary({ workflowState: "unclassified" }), NOW), { kind: "classifying" });
  });

  test("no step: draft flag decides", () => {
    assert.deepEqual(inboxCrmStep(summary({ hasDraft: true }), NOW), { kind: "replyDrafted" });
    assert.deepEqual(inboxCrmStep(summary(), NOW), { kind: "none" });
  });

  test("reply step phases", () => {
    const reply = step({ position: 1, type: "reply", name: "Reply" });
    assert.deepEqual(inboxCrmStep(summary({ step: { ...reply, status: "awaiting_review" } }), NOW), { kind: "reply", phase: "drafted" });
    assert.deepEqual(inboxCrmStep(summary({ step: { ...reply, status: "drafting" } }), NOW), { kind: "reply", phase: "drafting" });
    assert.deepEqual(inboxCrmStep(summary({ step: { ...reply, status: "failed" } }), NOW), { kind: "reply", phase: "failed" });
  });

  test("follow-up number is position minus one; due times carry a value", () => {
    assert.deepEqual(inboxCrmStep(summary({ step: step({ position: 3, status: "awaiting_review" }) }), NOW), { kind: "followUp", n: 2, phase: "drafted" });
    assert.deepEqual(inboxCrmStep(summary({ step: step({ dueAt: null }) }), NOW), { kind: "followUp", n: 1, phase: "scheduled" });
    assert.deepEqual(inboxCrmStep(summary({ step: step({ dueAt: "2026-09-19T11:00:00Z" }) }), NOW), { kind: "followUp", n: 1, phase: "dueNow" });
    assert.deepEqual(inboxCrmStep(summary({ step: step({ dueAt: "2026-09-19T15:30:00Z" }) }), NOW), { kind: "followUp", n: 1, phase: "dueHours", value: 4 });
    assert.deepEqual(inboxCrmStep(summary({ step: step({ dueAt: "2026-09-19T12:10:00Z" }) }), NOW), { kind: "followUp", n: 1, phase: "dueHours", value: 1 });
    assert.deepEqual(inboxCrmStep(summary({ step: step({ dueAt: "2026-09-22T12:00:00Z" }) }), NOW), { kind: "followUp", n: 1, phase: "dueDays", value: 3 });
  });

  test("reply with a due time", () => {
    const reply = step({ position: 1, type: "reply", dueAt: "2026-09-20T12:00:00Z" });
    assert.deepEqual(inboxCrmStep(summary({ step: reply }), NOW), { kind: "reply", phase: "dueDays", value: 1 });
    assert.equal(inboxCrmStepLabel(summary({ step: reply }), NOW), "Reply due in 1d");
  });
});
