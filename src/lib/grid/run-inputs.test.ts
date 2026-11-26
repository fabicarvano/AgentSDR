import { expect, test } from "bun:test";
import { hasRequiredInputs, type RunInputsColumn } from "./run-inputs";

const enrichment = (integrationKey: string, actionKey: string, inputs: Record<string, string>): RunInputsColumn => ({
  key: "out",
  type: "enrichment",
  config: {
    integrationKey,
    actionKey,
    handlerKey: "x",
    inputs: Object.fromEntries(Object.entries(inputs).map(([input, columnKey]) => [input, { source: "column", columnKey }])),
    outputs: {},
    connectionId: "c",
  } as unknown as RunInputsColumn["config"],
  dependsOn: Object.values(inputs),
});

test("a manual run queues a free AgentService action whose input is blank", () => {
  const column = enrichment("agentservice", "normalize-job-title", { title: "title" });
  expect(hasRequiredInputs(column, { title: "" })).toBe(true);
  expect(hasRequiredInputs(column, {})).toBe(true);
});

test("a manual run still skips an action that needs its input", () => {
  const column = enrichment("apollo", "find-person-by-email", { email: "email" });
  expect(hasRequiredInputs(column, { email: "" })).toBe(false);
  expect(hasRequiredInputs(column, { email: "a@b.co" })).toBe(true);
});
