import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { getIntegrationAction } from "../catalog";
import { getIntegrationActionHandler } from "../server/registry";
import type { IntegrationActionContext } from "../server/types";

const spies: ReturnType<typeof spyOn>[] = [];
afterEach(() => { for (const spy of spies.splice(0)) spy.mockRestore(); });

type Route = (url: string) => unknown;

/** Routes every fetch by URL: the OAuth token endpoint always answers, `route` answers the rest. */
function mockSnov(route: Route) {
  const spy = spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith("/v1/oauth/access_token")
      ? { access_token: "fictional-token", expires_in: 3600 }
      : route(url);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch);
  spies.push(spy);
  return spy;
}

function context(actionKey: string, inputs: Record<string, unknown>, providerState?: Record<string, unknown> | null): IntegrationActionContext {
  const action = getIntegrationAction("snov", actionKey);
  if (!action) throw new Error(`Action not registered: ${actionKey}`);
  return {
    action, inputs, providerState, credentials: { clientId: "fictional-client", clientSecret: "fictional-secret" },
    connectionId: `fictional-connection-${actionKey}`, timeoutMs: 5000,
    config: {
      integrationKey: "snov", actionKey, handlerKey: action.handlerKey, inputs: {},
      outputs: Object.fromEntries(action.outputs.map((output) => [output.key, `mapped_${output.key}`])),
      connectionId: `fictional-connection-${actionKey}`,
    },
  };
}

/** Repeats the handler while it answers `pending`, handing back the provider state, like the grid runner does. */
async function run(actionKey: string, inputs: Record<string, unknown>) {
  let providerState: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const ctx = context(actionKey, inputs, providerState);
    const handler = getIntegrationActionHandler(ctx.action.handlerKey);
    if (!handler) throw new Error("Handler not registered");
    const result = await handler(ctx);
    if ("pending" in result) { providerState = result.state ?? null; continue; }
    return result;
  }
  throw new Error("Snov never finished");
}

const profile = {
  success: true,
  id: "fictional-profile-1",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  social: [{ link: "https://www.linkedin.com/in/ada", type: "linkedin" }],
  currentJobs: [
    { companyName: "Acme", position: "CTO", site: "https://acme.example.com" },
    { companyName: "Beta", position: "CEO", site: "https://beta.example.com" },
  ],
  previousJobs: [{ companyName: "Old Co", position: "Engineer" }],
};

describe("Snov primary values in cells", () => {
  test("profile-by-email writes one primary text per list output and keeps the full body in the response", async () => {
    mockSnov(() => profile);
    const result = await run("profile-by-email", { email: "ada@example.com" });
    expect(result.outcome).toBe("hit");
    expect(result.outputs).toMatchObject({
      mapped_name: "Ada Lovelace",
      mapped_currentJobs: "CTO",
      mapped_previousJobs: "Engineer",
      mapped_social: "https://www.linkedin.com/in/ada",
    });
    expect(typeof result.outputs?.mapped_previousJobs).toBe("string");
    for (const value of Object.values(result.outputs ?? {})) {
      expect(value !== null && typeof value === "object").toBe(false);
    }
    expect((result.response as { currentJobs: unknown[] }).currentJobs).toEqual(profile.currentJobs);
  }, 15_000);

  test("an empty currentJobs list leaves the cell empty", async () => {
    mockSnov(() => ({ ...profile, currentJobs: [] }));
    const result = await run("profile-by-email", { email: "ada@example.com" });
    expect(result.outcome).toBe("hit");
    expect(result.outputs?.mapped_currentJobs).toBeNull();
  }, 15_000);

  test("database-search stores the number of results, not the list", async () => {
    const prospects = [{ first_name: "Ada" }, { first_name: "Alan" }, { first_name: "Grace" }];
    mockSnov((url) => url.includes("/start")
      ? { data: { task_hash: "fictional-task-hash" } }
      : { status: "completed", data: { total: 3, page: 1, total_pages: 1, prospects } });
    const result = await run("database-search", { searchType: "prospects", filters: { industry: "software" } });
    expect(result.outcome).toBe("hit");
    expect(result.outputs).toMatchObject({ mapped_results: 3, mapped_total: 3 });
    expect(typeof result.outputs?.mapped_results).toBe("number");
    expect((result.response as { data: { prospects: unknown[] } }).data.prospects).toEqual(prospects);
  }, 25_000);
});
