import { getIntegrationAction } from "@/lib/integrations/catalog";
import { allReferencedInputsEmpty, hasCellValue } from "./runners/guards";
import { ownCell } from "./runners/types";
import type { EnrichmentConfig } from "./types";
import type { GridColumn } from "./schema";

export type RunInputsColumn = Pick<GridColumn, "key" | "type" | "config" | "dependsOn">;

/** Whether a manual run has what it needs to queue this row for this column. */
export function hasRequiredInputs(
  column: RunInputsColumn,
  cells: Record<string, unknown>,
): boolean {
  // AI, HTTP and formula columns have no declared required inputs, so they are
  // skipped only when every {{token}} they reference is empty.
  if (column.type !== "enrichment") return !allReferencedInputsEmpty(column, cells);
  const config = column.config as EnrichmentConfig;
  const action = getIntegrationAction(config.integrationKey, config.actionKey);
  if (!action) return true;

  const requiredPresent = action.inputs.every((input) => {
    // A free local action answers a blank input with a normal (empty) result, so a
    // blank is fine there: this is the same rule the auto-run cascade uses.
    if (!input.required || input.allowEmpty) return true;
    const binding = config.inputs[input.key];
    if (!binding) return false;
    const value = ownCell(cells, binding.columnKey);
    return value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
  });
  if (!requiredPresent) return false;
  if (!action.filterBuilder) return true;

  const populatedFilters = action.inputs.filter((input) => {
    if (input.group !== "filter") return false;
    const binding = config.inputs[input.key];
    if (!binding) return false;
    return hasCellValue(ownCell(cells, binding.columnKey));
  });
  return populatedFilters.length >= action.filterBuilder.minFilters;
}
