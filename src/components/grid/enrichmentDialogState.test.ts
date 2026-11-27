import { describe, expect, test } from "bun:test";
import { getIntegrationAction, integrationDefinitions } from "@/lib/integrations/catalog";
import {
  dialogMode,
  enrichmentRequestBody,
  initialOutputs,
  initialSelection,
  type EnrichmentDraft,
} from "./enrichmentDialogState";

const cnpj = { integrationKey: "agentservice", actionKey: "normalize-cnpj" };

describe("what the dialog opens on", () => {
  test("a function picked in the menu opens on that action", () => {
    expect(initialSelection(cnpj)).toEqual(cnpj);
    expect(dialogMode(null, cnpj)).toBe("function");
  });

  test("Add enrichment opens the catalog on the first provider, never on a function", () => {
    const first = initialSelection(undefined);
    expect(first.actionKey).toBeNull();
    expect(first.integrationKey).toBe(integrationDefinitions()[0].key);
    expect(first.integrationKey).not.toBe("agentservice");
    expect(dialogMode(null, undefined)).toBe("integration");
  });

  test("an action that does not exist falls back to the catalog", () => {
    expect(initialSelection({ integrationKey: "agentservice", actionKey: "gone" }).actionKey).toBeNull();
    expect(initialSelection({ integrationKey: "gone", actionKey: "normalize-cnpj" }).actionKey).toBeNull();
  });

  test("a saved column decides by its own integration, also one created before functions existed", () => {
    expect(dialogMode(cnpj, undefined)).toBe("function");
    expect(dialogMode({ integrationKey: "apollo", actionKey: "anything" }, undefined)).toBe("integration");
    expect(dialogMode({ integrationKey: "apollo", actionKey: "anything" }, cnpj)).toBe("integration");
  });

  test("a function whose action left the registry opens the provider flow, which still has a screen to show", () => {
    const gone = { integrationKey: "agentservice", actionKey: "gone" };
    expect(dialogMode(gone, undefined)).toBe("integration");
    expect(dialogMode(null, gone)).toBe("integration");
  });
});

describe("outputs ticked on a new column", () => {
  test("a function starts with its first two outputs", () => {
    const action = getIntegrationAction("agentservice", "normalize-cnpj");
    expect(initialOutputs(action, "function")).toEqual(["cnpj", "isValid"]);
  });

  test("a function with one output ticks it", () => {
    expect(initialOutputs(getIntegrationAction("agentservice", "site-domain"), "function")).toEqual(["domain"]);
  });

  test("Normalize name ticks first and last name", () => {
    expect(initialOutputs(getIntegrationAction("agentservice", "normalize-name"), "function")).toEqual([
      "firstName",
      "lastName",
    ]);
  });

  test("a provider starts with none, and so does a missing action", () => {
    const action = getIntegrationAction("agentservice", "normalize-cnpj");
    expect(initialOutputs(action, "integration")).toEqual([]);
    expect(initialOutputs(null, "function")).toEqual([]);
  });
});

describe("the save request", () => {
  const draft: EnrichmentDraft = {
    ...cnpj,
    connectionId: "",
    inputs: { cnpj: "col_cnpj", unused: "" },
    outputs: new Set(["cnpj", "isValid"]),
    autoRun: true,
    runInBatches: false,
    conditionEnabled: false,
    runCondition: "{{cnpj}} != ''",
    delayEnabled: false,
    delaySeconds: 30,
    afterColumnId: "col-before",
  };

  test("a function saves its action, mapped inputs, outputs and position, with no connection", () => {
    expect(enrichmentRequestBody(draft)).toEqual({
      integrationKey: "agentservice",
      actionKey: "normalize-cnpj",
      columnId: undefined,
      connectionId: undefined,
      inputs: { cnpj: "col_cnpj" },
      selectedOutputs: ["cnpj", "isValid"],
      autoRun: true,
      runInBatches: false,
      runCondition: undefined,
      delaySeconds: 0,
      afterColumnId: "col-before",
      beforeColumnId: undefined,
    });
  });

  test("a provider sends its account, and the condition and delay only when switched on", () => {
    const body = enrichmentRequestBody({
      ...draft,
      integrationKey: "apollo",
      connectionId: "3f0c8a52-6f0e-4d5b-9a51-0c2f3f6f7a10",
      columnId: "col-1",
      conditionEnabled: true,
      delayEnabled: true,
    });
    expect(body.connectionId).toBe("3f0c8a52-6f0e-4d5b-9a51-0c2f3f6f7a10");
    expect(body.columnId).toBe("col-1");
    expect(body.runCondition).toBe("{{cnpj}} != ''");
    expect(body.delaySeconds).toBe(30);
  });
});
