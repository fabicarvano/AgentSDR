/**
 * Names the starter column of a new sheet is stored with: `gridMain.defaults.newColumn`
 * in every language. An import reuses a sheet's untouched starter column, so it
 * must recognise the name whichever language the sheet was created in.
 * `seedColumn.test.ts` keeps this list equal to the catalogs.
 */
export const SEED_COLUMN_NAMES: readonly string[] = ["New Column", "Nova coluna"];
