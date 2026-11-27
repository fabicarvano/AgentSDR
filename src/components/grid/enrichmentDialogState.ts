import {
  defaultOutputKeys,
  getIntegrationAction,
  integrationDefinitions,
  isFunctionKey,
} from "@/lib/integrations/catalog";
import type { IntegrationActionDefinition } from "@/lib/integrations/types";

/** "function": no catalog and no account step, opened on one action from Add column, Functions. */
export type EnrichmentDialogMode = "integration" | "function";

export type InitialAction = { integrationKey: string; actionKey: string };

/**
 * The mode the dialog runs in. A saved column decides by its own action, so a column created before functions
 * existed opens as a function too; a new column follows the action it was opened on. An action that is no
 * longer in the registry has no screen of its own to open: that falls back to the provider flow.
 */
export function dialogMode(
  saved: InitialAction | null | undefined,
  initialAction: InitialAction | null | undefined,
): EnrichmentDialogMode {
  const target = saved ?? initialAction;
  if (!target || !isFunctionKey(target.integrationKey)) return "integration";
  return getIntegrationAction(target.integrationKey, target.actionKey) ? "function" : "integration";
}

/**
 * What the dialog shows when it opens on a new column: the catalog on the first provider, or the given action.
 * An action that is not in the registry falls back to the catalog.
 */
export function initialSelection(
  initialAction: InitialAction | null | undefined,
): { integrationKey: string; actionKey: string | null } {
  if (initialAction && getIntegrationAction(initialAction.integrationKey, initialAction.actionKey)) {
    return { integrationKey: initialAction.integrationKey, actionKey: initialAction.actionKey };
  }
  return { integrationKey: integrationDefinitions()[0]?.key ?? "", actionKey: null };
}

/** Outputs ticked on a new column. A provider starts with none, a function with its defaults. */
export function initialOutputs(
  action: Pick<IntegrationActionDefinition, "outputs" | "defaultOutputs"> | null | undefined,
  mode: EnrichmentDialogMode,
): string[] {
  return action && mode === "function" ? defaultOutputKeys(action) : [];
}

export type EnrichmentDraft = {
  integrationKey: string;
  actionKey: string;
  columnId?: string;
  /** "" for a function, which has no account: the server uses the organization's own connection. */
  connectionId: string;
  /** Input key to column key. An unmapped input ("") is left out of the request. */
  inputs: Record<string, string>;
  outputs: Iterable<string>;
  autoRun: boolean;
  runInBatches: boolean;
  conditionEnabled: boolean;
  runCondition: string;
  delayEnabled: boolean;
  delaySeconds: number;
  afterColumnId?: string;
  beforeColumnId?: string;
};

/** The body of POST/PATCH /api/grid/tables/:id/enrichments. */
export function enrichmentRequestBody(draft: EnrichmentDraft) {
  return {
    integrationKey: draft.integrationKey,
    actionKey: draft.actionKey,
    columnId: draft.columnId,
    connectionId: draft.connectionId || undefined,
    inputs: Object.fromEntries(Object.entries(draft.inputs).filter(([, columnKey]) => Boolean(columnKey))),
    selectedOutputs: [...draft.outputs],
    autoRun: draft.autoRun,
    runInBatches: draft.runInBatches,
    runCondition: draft.conditionEnabled ? draft.runCondition : undefined,
    delaySeconds: draft.delayEnabled ? draft.delaySeconds : 0,
    afterColumnId: draft.afterColumnId,
    beforeColumnId: draft.beforeColumnId,
  };
}
