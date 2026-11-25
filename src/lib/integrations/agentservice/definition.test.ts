import { describe, expect, test } from "bun:test";
import { AGENTSERVICE } from "./definition";

describe("AgentService definition", () => {
  test("every input accepts a blank cell, so an empty row gets an answer instead of an error", () => {
    for (const action of AGENTSERVICE.actions) {
      for (const input of action.inputs) expect(input.allowEmpty).toBe(true);
    }
  });
});
