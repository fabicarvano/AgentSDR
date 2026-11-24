import { describe, expect, test } from "bun:test";
import en from "../../../messages/en/gridMain.json";
import ptBR from "../../../messages/pt-BR/gridMain.json";
import { SEED_COLUMN_NAMES } from "./seedColumn";
import { isInitialSeedColumn } from "./import";

describe("starter column name", () => {
  test("SEED_COLUMN_NAMES lists the name in every catalog", () => {
    expect([...SEED_COLUMN_NAMES].sort()).toEqual([en.gridMain.defaults.newColumn, ptBR.gridMain.defaults.newColumn].sort());
  });

  test("an import reuses the untouched starter column in either language", () => {
    for (const name of SEED_COLUMN_NAMES) expect(isInitialSeedColumn([{ key: "name", name }])).toBe(true);
    expect(isInitialSeedColumn([{ key: "name", name: "Empresa" }])).toBe(false);
  });
});

describe("default names catalog", () => {
  test("every default name exists in both languages", () => {
    expect(Object.keys(ptBR.gridMain.defaults).sort()).toEqual(Object.keys(en.gridMain.defaults).sort());
  });
});
