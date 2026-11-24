import { describe, expect, test } from "bun:test";
import { API_ERROR_CODES, ApiError, apiErrorFromResponse } from "@/lib/http/apiErrors";
import { normalizeMapping, parseSpreadsheet } from "./import";

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("import failures carry a code", () => {
  test("an empty file", () => {
    const empty = parseSpreadsheet(bytes(""));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(["importSheetEmpty", "importNoSheets", "importUnreadable"]).toContain(empty.code);
  });

  test("a mapping names the code and the values its sentence needs", () => {
    const known = new Set(["name"]);
    const twice = normalizeMapping([{ headerIndex: 0, action: "skip" }, { headerIndex: 0, action: "skip" }], ["a", "b"], known);
    expect(twice).toMatchObject({ ok: false, code: "importColumnTwice", params: { column: 1 } });
    const unknown = normalizeMapping([{ headerIndex: 0, action: "map", columnKey: "x" }], ["a"], known);
    expect(unknown).toMatchObject({ ok: false, code: "importUnknownTarget", params: { column: "x" } });
    const notArray = normalizeMapping({}, ["a"], known);
    expect(notArray).toMatchObject({ ok: false, code: "importMappingInvalid" });
    const tooLong = normalizeMapping([{ headerIndex: 0, action: "create", type: "text", name: "x".repeat(500) }], ["a"], known);
    expect(tooLong).toMatchObject({ ok: false, code: "importNameTooLong" });
  });

  test("every import code is a registered API error code", () => {
    for (const code of ["importUnreadable", "importNoSheets", "importSheetEmpty", "importHeaderEmpty", "importMappingJson", "importMappingInvalid", "importColumnTwice", "importUnknownTarget", "importColumnType", "importNameMissing", "importNameTooLong"]) {
      expect(API_ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});

describe("apiErrorFromResponse", () => {
  test("keeps a route's own error and code", () => {
    const error = apiErrorFromResponse({ error: "nope", code: "fileEmpty" }, 400);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "nope", status: 400, code: "fileEmpty" });
  });

  test("a response with no error text becomes the coded requestFailed", () => {
    expect(apiErrorFromResponse({}, 502)).toMatchObject({ message: "Request failed (502)", status: 502, code: "requestFailed", params: { status: 502 } });
    expect(apiErrorFromResponse(null, 500)).toMatchObject({ code: "requestFailed" });
  });
});
