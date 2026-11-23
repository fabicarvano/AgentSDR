import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INTEGRATIONS } from "./catalog";

/**
 * The text of every action, input and output of the integrations registry is translated in
 * messages/<locale>/integrationsRegistry.json (the registry itself stays English: server code and the stored column
 * names read it). This keeps the English file equal to the registry and complete, so a new action, input or output
 * without text fails here instead of silently showing English in pt-BR.
 */
type Node = { name: string; description?: string };
type Fragment = { actions: Record<string, Node & { inputs: Record<string, Node>; outputs: Record<string, Node> }> };

const file = join(import.meta.dir, "../../../messages/en/integrationsRegistry.json");
const catalog = JSON.parse(readFileSync(file, "utf8")).integrationsRegistry as Record<string, Fragment>;

describe("integrations registry text (en)", () => {
  test("has an entry for every integration", () => {
    expect(Object.keys(catalog).sort()).toEqual(INTEGRATIONS.map((integration) => integration.key).sort());
  });

  for (const integration of INTEGRATIONS) {
    test(`${integration.key}: every action, input and output has its text, equal to the registry`, () => {
      const fragment = catalog[integration.key]!;
      expect(Object.keys(fragment.actions).sort()).toEqual(integration.actions.map((action) => action.key).sort());
      for (const action of integration.actions) {
        const entry = fragment.actions[action.key]!;
        expect(entry.name).toBe(action.name);
        expect(entry.description).toBe(action.description);
        expect(Object.keys(entry.inputs).sort()).toEqual(action.inputs.map((input) => input.key).sort());
        for (const input of action.inputs) {
          expect(entry.inputs[input.key]).toEqual({ name: input.name, description: input.description });
        }
        expect(Object.keys(entry.outputs).sort()).toEqual(action.outputs.map((output) => output.key).sort());
        for (const output of action.outputs) {
          expect(entry.outputs[output.key]!.name).toBe(output.name);
        }
      }
    });
  }
});
