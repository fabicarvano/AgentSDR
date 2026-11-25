import "server-only";

import type { CellResult } from "@/lib/grid/types";
import { organizationPhoneCountry } from "@/lib/calls/phone.server";
import type { IntegrationActionHandler, IntegrationActionHandlers } from "../server/types";
import { mapConfiguredOutputs } from "../server/helpers";
import {
  companyDomainFromEmail,
  normalizeEmailCell,
  normalizeLinkedinCell,
  normalizePhoneCell,
  siteDomain,
} from "./normalizers";

/**
 * Every handler is local and free: it reads the mapped cell, cleans it and
 * returns. A value that cannot be cleaned is a clean miss with its flag
 * columns set (Valid Phone = false), not an error, so one bad row never
 * stops the run.
 */
function finish(
  context: Parameters<IntegrationActionHandler>[0],
  value: unknown,
  logicalOutputs: Record<string, unknown>,
  started: number,
): CellResult {
  const empty = value === null || value === undefined || value === "";
  return {
    value: empty ? null : value,
    outputs: mapConfiguredOutputs(context.config, logicalOutputs, logicalOutputs),
    provider: "agentservice",
    outcome: empty ? "miss" : "hit",
    costCents: 0,
    latencyMs: Date.now() - started,
    request: { inputKeys: Object.keys(context.inputs) },
    response: logicalOutputs,
  };
}

export const AGENTSERVICE_HANDLERS = {
  "agentservice.normalizePhone": async (context) => {
    const started = Date.now();
    const result = normalizePhoneCell(context.inputs.phone as string | number, await organizationPhoneCountry());
    return finish(context, result.phone, result, started);
  },
  "agentservice.normalizeEmail": async (context) => {
    const started = Date.now();
    const result = normalizeEmailCell(String(context.inputs.email));
    return finish(context, result.email, result, started);
  },
  "agentservice.siteDomain": async (context) => {
    const started = Date.now();
    const domain = siteDomain(String(context.inputs.website));
    return finish(context, domain, { domain }, started);
  },
  "agentservice.companyDomainFromEmail": async (context) => {
    const started = Date.now();
    const domain = companyDomainFromEmail(String(context.inputs.email));
    return finish(context, domain, { domain }, started);
  },
  "agentservice.normalizeLinkedin": async (context) => {
    const started = Date.now();
    const result = normalizeLinkedinCell(String(context.inputs.profile));
    return finish(context, result.slug, result, started);
  },
} satisfies IntegrationActionHandlers;
