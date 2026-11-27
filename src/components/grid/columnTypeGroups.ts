/**
 * The column types of the Add column menu: plain data, no React hooks, so it can be read by tests and by
 * anything outside a component. The translated label helpers live in columnTypes.ts.
 */
import {
  RiAtLine,
  RiBracesLine,
  RiCalendar2Line,
  RiChat1Line,
  RiCheckboxCircleLine,
  RiCheckboxLine,
  RiCornerRightDownLine,
  RiCpuLine,
  RiFlashlightLine,
  RiFunctions,
  RiGitMergeLine,
  RiGlobalLine,
  RiHashtag,
  RiImageLine,
  RiLinkM,
  RiListCheck,
  RiMagicLine,
  RiMoneyDollarCircleLine,
  RiText,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import type { Messages } from "@/i18n/catalog";
import type { ColumnType } from "@/lib/grid/types";

export type ColumnTypeLabelKey = keyof Messages["gridColumns"]["columnTypes"];

export type ColumnTypeMeta = {
  type: ColumnType;
  /** Typed key under gridColumns.columnTypes; render it with useColumnTypeLabel(). */
  labelKey: ColumnTypeLabelKey | null;
  icon: RemixiconComponentType;
  /** false while the runner behind it is unimplemented — see the plan doc. */
  available: boolean;
};

/**
 * The "Add column" menu, in Clay's order and grouping. Groups are rendered
 * with a divider between them.
 *
 * Runner types that do not have an end-to-end configuration flow yet stay
 * visible but disabled. This keeps the shape of the roadmap visible without
 * allowing users to create columns that cannot be configured or executed.
 */
export const COLUMN_TYPE_GROUPS: ColumnTypeMeta[][] = [
  [{ type: "enrichment", labelKey: "addEnrichment", icon: RiFlashlightLine, available: true }],
  [
    { type: "http", labelKey: "http", icon: RiGlobalLine, available: true },
    { type: "ai", labelKey: "ai", icon: RiMagicLine, available: true },
    // Not a column type of its own: the menu opens the list of functions, and each one is an enrichment column.
    { type: "functions", labelKey: "functions", icon: RiCpuLine, available: true },
    { type: "message", labelKey: "message", icon: RiChat1Line, available: false },
    { type: "waterfall", labelKey: "waterfall", icon: RiCornerRightDownLine, available: false },
    { type: "formula", labelKey: "formula", icon: RiFunctions, available: true },
    { type: "merge", labelKey: "merge", icon: RiGitMergeLine, available: false },
  ],
  [
    { type: "text", labelKey: "text", icon: RiText, available: true },
    { type: "number", labelKey: "number", icon: RiHashtag, available: true },
    { type: "currency", labelKey: "currency", icon: RiMoneyDollarCircleLine, available: true },
    { type: "date", labelKey: "date", icon: RiCalendar2Line, available: true },
    { type: "url", labelKey: "url", icon: RiLinkM, available: true },
    { type: "email", labelKey: "email", icon: RiAtLine, available: true },
    { type: "image", labelKey: "image", icon: RiImageLine, available: true },
  ],
  [
    { type: "boolean", labelKey: "boolean", icon: RiCheckboxLine, available: true },
    { type: "select", labelKey: "select", icon: RiCheckboxCircleLine, available: true },
    { type: "multiselect", labelKey: "multiselect", icon: RiListCheck, available: true },
    { type: "json", labelKey: "json", icon: RiBracesLine, available: true },
  ],
];

const BY_TYPE = new Map<ColumnType, ColumnTypeMeta>(
  (<ColumnTypeMeta[]>[
    ...COLUMN_TYPE_GROUPS.flat(),
    { type: "integration_output" as const, labelKey: "integrationOutput", icon: RiFlashlightLine, available: false },
    { type: "ai_output" as const, labelKey: "aiOutput", icon: RiMagicLine, available: false },
  ]).map((m) => [m.type, m]),
);

/** Falls back to the text metadata so an unknown type still renders (its label is the raw type, see useColumnTypeLabel). */
export function columnTypeMeta(type: ColumnType): ColumnTypeMeta {
  return BY_TYPE.get(type) ?? { type, labelKey: null, icon: RiText, available: true };
}

/** The icon of a function: the Functions menu entry and every column a function created. */
export const FUNCTION_ICON = RiCpuLine;
