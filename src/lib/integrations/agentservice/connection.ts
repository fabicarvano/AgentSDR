import { createHash } from "node:crypto";

export const AGENTSERVICE_KEY = "agentservice";

/**
 * The id of an organization's one AgentService connection. There is no row in
 * grid_providers, so the id is a UUID-shaped hash of the organization: stable
 * between requests, accepted by the same id checks as a stored connection, and
 * an id copied from another organization simply does not match.
 */
export function agentServiceConnectionIdFor(organizationId: string): string {
  const bytes = createHash("sha256").update(`${AGENTSERVICE_KEY}:${organizationId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
