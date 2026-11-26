import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { getIntegrationAction } from "../catalog";
import { getIntegrationActionHandler } from "../server/registry";
import type { IntegrationActionContext } from "../server/types";

const spies: ReturnType<typeof spyOn>[] = [];
afterEach(() => { for (const spy of spies.splice(0)) spy.mockRestore(); });

function fetchJson(body: unknown) {
  const spy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  spies.push(spy);
  return spy;
}

function context(actionKey: string, inputs: Record<string, unknown>): IntegrationActionContext {
  const action = getIntegrationAction("apollo", actionKey);
  if (!action) throw new Error(`Action not registered: ${actionKey}`);
  return {
    action, inputs, credentials: { apiKey: "fictional-key" }, connectionId: "fictional-org-connection", timeoutMs: 5000,
    config: {
      integrationKey: "apollo", actionKey, handlerKey: action.handlerKey, inputs: {},
      outputs: Object.fromEntries(action.outputs.map((output) => [output.key, `mapped_${output.key}`])),
      connectionId: "fictional-org-connection",
    },
  };
}

async function run(actionKey: string, inputs: Record<string, unknown>) {
  const ctx = context(actionKey, inputs);
  const handler = getIntegrationActionHandler(ctx.action.handlerKey);
  if (!handler) throw new Error("Handler not registered");
  const result = await handler(ctx);
  if ("pending" in result) throw new Error("Apollo must not poll");
  return result;
}

describe("Apollo primary values in cells", () => {
  test("find-people-at-company-by-job-title writes the first name and the count, and keeps the people in the response", async () => {
    const body = { people: [{ name: "Ada Lovelace", title: "VP Sales" }, { name: "Alan" }] };
    fetchJson(body);
    const result = await run("find-people-at-company-by-job-title", { companyDomain: "example.com", jobTitle: "VP Sales" });
    expect(result.outcome).toBe("hit");
    expect(result.outputs).toMatchObject({ mapped_people: "Ada Lovelace", mapped_resultCount: 2 });
    expect(typeof result.outputs?.mapped_people).toBe("string");
    expect((result.response as { people: unknown[] }).people).toEqual(body.people);
  });

  test("an empty people list is a miss with an empty cell", async () => {
    fetchJson({ people: [] });
    const result = await run("find-people-at-company-by-job-title", { companyDomain: "example.com", jobTitle: "VP Sales" });
    expect(result.outcome).toBe("miss");
    expect(result.outputs?.mapped_people).toBeNull();
    expect(result.outputs?.mapped_resultCount).toBe(0);
  });

  test("enrich-company-by-domain still returns a numeric employee count", async () => {
    fetchJson({ organization: { name: "Acme", industry: "Software", estimated_num_employees: 250, linkedin_url: "https://linkedin.com/company/acme" } });
    const result = await run("enrich-company-by-domain", { domain: "acme.com" });
    expect(result.outcome).toBe("hit");
    expect(result.outputs?.mapped_employeeCount).toBe(250);
    expect(typeof result.outputs?.mapped_employeeCount).toBe("number");
  });
});
