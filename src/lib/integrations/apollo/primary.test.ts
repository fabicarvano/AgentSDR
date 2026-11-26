import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import { getIntegrationAction } from "../catalog";
import { getIntegrationActionHandler } from "../server/registry";

afterEach(() => { mock.restore(); });

async function run(actionKey: string, inputs: Record<string, unknown>, body: unknown) {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body));
  const action = getIntegrationAction("apollo", actionKey);
  const handler = action && getIntegrationActionHandler(action.handlerKey);
  if (!action || !handler) throw new Error(`Not registered: ${actionKey}`);
  const outputs = Object.fromEntries(action.outputs.map((o) => [o.key, `mapped_${o.key}`]));
  const result = await handler({
    action, inputs, credentials: { apiKey: "k" }, connectionId: "c", timeoutMs: 5000,
    config: { integrationKey: "apollo", actionKey, handlerKey: action.handlerKey, inputs: {}, outputs, connectionId: "c" },
  });
  if ("pending" in result) throw new Error("Apollo must not poll");
  return result;
}

describe("Apollo primary values in cells", () => {
  test("find-people-at-company-by-job-title writes the first name and the count, and keeps the people in the response", async () => {
    const body = { people: [{ name: "Ada Lovelace", title: "VP Sales" }, { name: "Alan" }] };
    const result = await run("find-people-at-company-by-job-title", { companyDomain: "example.com", jobTitle: "VP Sales" }, body);
    expect(result.outcome).toBe("hit");
    expect(result.outputs).toMatchObject({ mapped_people: "Ada Lovelace", mapped_resultCount: 2 });
    expect(typeof result.outputs?.mapped_people).toBe("string");
    expect((result.response as { people: unknown[] }).people).toEqual(body.people);
  });

  test("an empty people list is a miss with an empty cell", async () => {
    const result = await run("find-people-at-company-by-job-title", { companyDomain: "example.com", jobTitle: "VP Sales" }, { people: [] });
    expect(result.outcome).toBe("miss");
    expect(result.outputs?.mapped_people).toBeNull();
    expect(result.outputs?.mapped_resultCount).toBe(0);
  });

  test("enrich-company-by-domain still returns a numeric employee count", async () => {
    const result = await run("enrich-company-by-domain", { domain: "acme.com" }, { organization: { name: "Acme", estimated_num_employees: 250 } });
    expect(result.outcome).toBe("hit");
    expect(result.outputs?.mapped_employeeCount).toBe(250);
    expect(typeof result.outputs?.mapped_employeeCount).toBe("number");
  });
});
