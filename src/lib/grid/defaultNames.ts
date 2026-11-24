import { getTranslations } from "next-intl/server";

/**
 * The names the grid gives what it creates before the person types one: the
 * starter column, a new sheet, the first sheet of a workbook, an unnamed
 * workbook. They are stored as the person's own data, so they are written once,
 * in the interface language of whoever creates them, and never translated again.
 * The English values below are the fallback when a caller does not pass names
 * (tests, scripts).
 */
export type GridDefaultNames = {
  newColumn: string;
  /** The Nth sheet of a workbook. */
  tableName: (number: number) => string;
  firstTableName: string;
  untitledWorkbook: string;
  untitledFolder: string;
};

export const ENGLISH_DEFAULT_NAMES: GridDefaultNames = {
  newColumn: "New Column",
  tableName: (number) => `Table ${number}`,
  firstTableName: "Custom Table",
  untitledWorkbook: "Untitled workbook",
  untitledFolder: "Untitled folder",
};

/** The names in the language of the current request (the NEXT_LOCALE cookie, then Accept-Language). */
export async function getGridDefaultNames(): Promise<GridDefaultNames> {
  try {
    const t = await getTranslations("gridMain.defaults");
    return {
      newColumn: t("newColumn"),
      tableName: (number) => t("tableName", { number }),
      firstTableName: t("firstTableName"),
      untitledWorkbook: t("untitledWorkbook"),
      untitledFolder: t("untitledFolder"),
    };
  } catch (error) {
    // A name is never worth failing the creation: fall back to English and say why.
    console.error("grid default names: could not load the catalog", error);
    return ENGLISH_DEFAULT_NAMES;
  }
}
