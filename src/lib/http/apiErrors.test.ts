import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API_ERROR_CODES, apiError, apiErrorBody, readApiErrorBody } from "./apiErrors";

describe("apiErrors", () => {
  test("the body keeps the English error and adds the code", () => {
    expect(apiErrorBody("notFound", "Not found")).toEqual({ error: "Not found", code: "notFound" });
    expect(apiErrorBody("unsupportedColumnType", "Unsupported column type: x", { type: "x" })).toEqual({
      error: "Unsupported column type: x",
      code: "unsupportedColumnType",
      params: { type: "x" },
    });
  });

  test("the response carries the status and the body", async () => {
    const response = apiError(404, "campaignNotFound", "Campaign not found");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Campaign not found", code: "campaignNotFound" });
  });

  test("reads the code and params of a parsed body, and nothing from anything else", () => {
    expect(readApiErrorBody({ error: "x", code: "notFound", params: { a: 1 } })).toEqual({ code: "notFound", params: { a: 1 } });
    expect(readApiErrorBody({ error: "x" })).toEqual({ code: undefined, params: undefined });
    expect(readApiErrorBody(null)).toEqual({});
  });

  test("every code has its message in both languages", () => {
    for (const locale of ["en", "pt-BR"]) {
      const file = join(import.meta.dir, `../../../messages/${locale}/apiErrors.json`);
      const keys = Object.keys(JSON.parse(readFileSync(file, "utf8")).apiErrors).sort();
      expect(keys).toEqual([...API_ERROR_CODES].sort());
    }
  });
});
