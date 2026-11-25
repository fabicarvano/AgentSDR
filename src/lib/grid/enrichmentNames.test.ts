import { describe, expect, test } from "bun:test";
import { enrichmentNamesFrom, type NameLookup } from "./enrichmentNames";

const action = { key: "normalize-cnpj", outputs: [{ key: "cnpj" }, { key: "isValid" }] };

function lookup(messages: Record<string, string>): NameLookup {
  const t = (key: string) => messages[key] ?? key;
  return Object.assign(t, { has: (key: string) => key in messages });
}

describe("enrichmentNamesFrom", () => {
  test("reads the action and output names from the catalog", () => {
    const t = lookup({
      "agentservice.actions.normalize-cnpj.name": "Normalizar CNPJ",
      "agentservice.actions.normalize-cnpj.outputs.cnpj.name": "CNPJ normalizado",
      "agentservice.actions.normalize-cnpj.outputs.isValid.name": "CNPJ válido",
    });
    expect(enrichmentNamesFrom(t, "agentservice", action)).toEqual({
      action: "Normalizar CNPJ",
      outputs: { cnpj: "CNPJ normalizado", isValid: "CNPJ válido" },
    });
  });

  test("leaves out what the catalog does not have, so the English name stays", () => {
    const t = lookup({ "agentservice.actions.normalize-cnpj.outputs.cnpj.name": "CNPJ normalizado" });
    expect(enrichmentNamesFrom(t, "agentservice", action)).toEqual({
      outputs: { cnpj: "CNPJ normalizado" },
    });
  });

  test("returns nothing for an integration the catalog does not know", () => {
    expect(enrichmentNamesFrom(lookup({}), "apollo", action)).toEqual({ outputs: {} });
  });
});
