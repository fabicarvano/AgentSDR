import type { ColumnType } from "@/lib/grid/types";
import { toPrimaryText } from "./helpers";

/**
 * Which field of a structured provider output a grid cell shows. The cell holds
 * one value; the whole object stays in the run's response (the cell details).
 * Keys only matter for lists of objects: a list of plain values is just joined.
 */
export const SNOV_PRIMARY_KEYS: Record<string, readonly string[]> = {
  currentJobs: ["position"],
  previousJobs: ["position"],
  positions: ["title", "position"],
  social: ["link"],
  skills: ["name"],
  relatedDomains: ["domain"],
};

export const APOLLO_PRIMARY_KEYS: Record<string, readonly string[]> = {
  people: ["name", "first_name", "email"],
  contacts: ["name", "first_name", "email"],
  jobs: ["title"],
  emailAccounts: ["email"],
};

const PRIMARY_KEYS_BY_INTEGRATION: Record<string, Record<string, readonly string[]>> = {
  snov: SNOV_PRIMARY_KEYS,
  apollo: APOLLO_PRIMARY_KEYS,
};

/**
 * The value to put in a cell of this output column when it is filled from a
 * saved response rather than a run (adding an output to an existing enrichment).
 * A json column keeps the object; any other column gets the primary value.
 */
export function cellValueForOutput(
  integrationKey: string,
  outputKey: string,
  columnType: ColumnType,
  value: unknown,
): unknown {
  if (columnType === "json" || value === null || typeof value !== "object") return value;
  return toPrimaryText(value, PRIMARY_KEYS_BY_INTEGRATION[integrationKey]?.[outputKey]);
}
