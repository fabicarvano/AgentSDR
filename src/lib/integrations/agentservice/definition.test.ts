import { describe, expect, test } from "bun:test";
import { AGENTSERVICE } from "./definition";

describe("AgentService definition", () => {
  test("every input accepts a blank cell, so an empty row gets an answer instead of an error", () => {
    for (const action of AGENTSERVICE.actions) {
      for (const input of action.inputs) expect(input.allowEmpty).toBe(true);
    }
  });

  test("it is offered as a function, in two groups", () => {
    expect(AGENTSERVICE.kind).toBe("function");
    const extract = AGENTSERVICE.actions.filter((action) => action.category === "extract").map((action) => action.key);
    expect(extract).toEqual(["site-domain", "company-domain-from-email"]);
    for (const action of AGENTSERVICE.actions) expect(["normalize", "extract"]).toContain(action.category);
  });

  test("every default output is an output of its action", () => {
    for (const action of AGENTSERVICE.actions) {
      const keys = action.outputs.map((output) => output.key);
      for (const key of action.defaultOutputs ?? []) expect(keys).toContain(key);
    }
  });
});
