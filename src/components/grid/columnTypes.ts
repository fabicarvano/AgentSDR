import { useTranslations } from "next-intl";
import en from "../../../messages/en/gridColumns.json";
import type { ColumnType } from "@/lib/grid/types";
import { columnTypeMeta } from "./columnTypeGroups";

export * from "./columnTypeGroups";

/** Translated label of a column type; an unknown type shows its raw value (stays as stored, never throws). */
export function useColumnTypeLabel(): (type: ColumnType) => string {
  const t = useTranslations("gridColumns.columnTypes");
  return (type) => {
    const key = columnTypeMeta(type).labelKey;
    return key ? t(key) : type;
  };
}

/**
 * Default name a new column is stored with. It is data (user-editable, saved in the database), so it stays English
 * whatever the interface language: translated text is never written to the database. Same value the label had before i18n.
 */
export function columnTypeDefaultName(type: ColumnType): string {
  const key = columnTypeMeta(type).labelKey;
  return key ? en.gridColumns.columnTypes[key] : type;
}
