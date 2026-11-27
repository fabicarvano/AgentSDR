import { describe, expect, test } from "bun:test";
import en from "../../../messages/en/gridColumns.json";
import { AGENTSERVICE } from "@/lib/integrations/agentservice/definition";
import { FUNCTION_GROUP_ORDER, functionMenuGroups, isFunctionGroupKey } from "./functionMenu";

describe("Functions submenu", () => {
  const groups = functionMenuGroups();

  test("groups come in menu order and none is empty", () => {
    expect(groups.map((group) => group.category)).toEqual(["normalize", "extract"]);
    for (const group of groups) expect(group.items.length).toBeGreaterThan(0);
  });

  test("every AgentService action is offered exactly once", () => {
    const offered = groups.flatMap((group) => group.items.map((item) => `${item.integrationKey}.${item.action.key}`));
    expect(offered.sort()).toEqual(AGENTSERVICE.actions.map((action) => `agentservice.${action.key}`).sort());
  });

  test("the domain actions are under Extract", () => {
    const extract = groups.find((group) => group.category === "extract");
    expect(extract?.items.map((item) => item.action.key)).toEqual(["site-domain", "company-domain-from-email"]);
  });

  test("every group shown has a title in the catalog", () => {
    for (const group of groups) expect(isFunctionGroupKey(group.category)).toBe(true);
    expect(Object.keys(en.gridColumns.addColumnMenu.functionGroups).sort()).toEqual([...FUNCTION_GROUP_ORDER].sort());
  });
});
