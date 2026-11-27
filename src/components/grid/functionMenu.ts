import { functionDefinitions } from "@/lib/integrations/catalog";
import type { ActionCategory, IntegrationActionDefinition } from "@/lib/integrations/types";

/** The groups of the Functions submenu, in the order they are shown. A category outside this list goes last. */
export const FUNCTION_GROUP_ORDER = ["normalize", "extract"] as const satisfies readonly ActionCategory[];

export type FunctionGroupKey = (typeof FUNCTION_GROUP_ORDER)[number];

export type FunctionMenuItem = { integrationKey: string; action: IntegrationActionDefinition };

export type FunctionMenuGroup = { category: ActionCategory; items: FunctionMenuItem[] };

export function isFunctionGroupKey(category: ActionCategory): category is FunctionGroupKey {
  return (FUNCTION_GROUP_ORDER as readonly ActionCategory[]).includes(category);
}

/** Every action of every function definition, grouped by its category. Empty groups are left out. */
export function functionMenuGroups(): FunctionMenuGroup[] {
  const byCategory = new Map<ActionCategory, FunctionMenuItem[]>();
  for (const definition of functionDefinitions()) {
    for (const action of definition.actions) {
      const items = byCategory.get(action.category) ?? [];
      items.push({ integrationKey: definition.key, action });
      byCategory.set(action.category, items);
    }
  }
  const order: readonly ActionCategory[] = FUNCTION_GROUP_ORDER;
  const rank = (category: ActionCategory) => {
    const index = order.indexOf(category);
    return index === -1 ? order.length : index;
  };
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([category, items]) => ({ category, items }));
}
