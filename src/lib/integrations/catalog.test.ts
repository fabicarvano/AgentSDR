import { describe, expect, test } from "bun:test";
import {
  INTEGRATIONS,
  defaultOutputKeys,
  functionDefinitions,
  getIntegrationAction,
  integrationDefinitions,
  integrationKind,
  isFunctionKey,
  validateInputValue,
} from "./catalog";

describe("validateInputValue textOrNumber", () => {
  test("accepts text and finite numbers", () => {
    expect(validateInputValue("textOrNumber", "(21) 98654-5481")).toBeNull();
    expect(validateInputValue("textOrNumber", 21986545481)).toBeNull();
  });

  test("refuses NaN, Infinity and other shapes", () => {
    expect(validateInputValue("textOrNumber", Number.NaN)).not.toBeNull();
    expect(validateInputValue("textOrNumber", Number.POSITIVE_INFINITY)).not.toBeNull();
    expect(validateInputValue("textOrNumber", { phone: "1" })).not.toBeNull();
    expect(validateInputValue("textOrNumber", true)).not.toBeNull();
  });
});

describe("integration kind", () => {
  test("AgentService is the only function and every provider is an integration", () => {
    expect(functionDefinitions().map((definition) => definition.key)).toEqual(["agentservice"]);
    for (const definition of INTEGRATIONS) {
      expect(integrationKind(definition)).toBe(definition.key === "agentservice" ? "function" : "integration");
    }
  });

  test("the two lists split the registry without losing or repeating a definition", () => {
    const integrations = integrationDefinitions().map((definition) => definition.key);
    const functions = functionDefinitions().map((definition) => definition.key);
    expect(integrations.length).toBeGreaterThan(0);
    expect(integrations.filter((key) => functions.includes(key))).toEqual([]);
    expect([...integrations, ...functions].sort()).toEqual(INTEGRATIONS.map((definition) => definition.key).sort());
  });

  test("a function stays in the registry, so saved columns and the runner still resolve it", () => {
    expect(INTEGRATIONS.some((definition) => definition.key === "agentservice")).toBe(true);
    expect(getIntegrationAction("agentservice", "normalize-phone")).not.toBeNull();
  });

  test("isFunctionKey is false for a provider, an unknown key and no key", () => {
    expect(isFunctionKey("agentservice")).toBe(true);
    expect(isFunctionKey("apollo")).toBe(false);
    expect(isFunctionKey("not-a-key")).toBe(false);
    expect(isFunctionKey(undefined)).toBe(false);
  });
});

describe("defaultOutputKeys", () => {
  const output = (key: string) => ({ key, name: key, columnType: "text" as const });

  test("ticks the first two outputs, or the only one", () => {
    expect(defaultOutputKeys({ outputs: [output("a"), output("b"), output("c")] })).toEqual(["a", "b"]);
    expect(defaultOutputKeys({ outputs: [output("a")] })).toEqual(["a"]);
    expect(defaultOutputKeys({ outputs: [] })).toEqual([]);
  });

  test("an action's own list wins, minus keys it does not have", () => {
    const outputs = [output("a"), output("b"), output("c")];
    expect(defaultOutputKeys({ outputs, defaultOutputs: ["c", "gone"] })).toEqual(["c"]);
    expect(defaultOutputKeys({ outputs, defaultOutputs: ["gone"] })).toEqual(["a", "b"]);
  });
});
