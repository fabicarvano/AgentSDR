import type { EnrichmentConfig } from "@/lib/grid/types";
import { responsePointerFromOutputKey, valueAtJsonPointer } from "@/lib/grid/json-pointer";

const MAX_AUDIT_BYTES = 256 * 1024;

export function mapConfiguredOutputs(
  config: EnrichmentConfig,
  logicalOutputs: Record<string, unknown>,
  response: unknown,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config.outputs).map(([outputKey, columnKey]) => {
      const pointer = responsePointerFromOutputKey(outputKey);
      const value = pointer === null ? logicalOutputs[outputKey] : valueAtJsonPointer(response, pointer);
      return [columnKey, value ?? null];
    }),
  );
}

const DEFAULT_PRIMARY_KEYS: readonly string[] = ["name", "title", "position", "email", "domain", "url", "link"];

function scalarText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function primaryOfObject(value: unknown, keys: readonly string[]): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const text = scalarText(record[key]);
    if (text) return text;
  }
  return null;
}

/**
 * The one value a grid cell shows for a structured provider output (a list of
 * jobs, a list of links...). The full object stays in the run's response, which
 * the cell details panel shows. Never returns JSON: an unknown shape gives null.
 * Scalars stay as they are, a list of scalars is joined, a list of objects gives
 * the first item that has one of `keys`, an object gives its own.
 */
export function toPrimaryText(value: unknown, keys: readonly string[] = DEFAULT_PRIMARY_KEYS): string | null {
  const scalar = scalarText(value);
  if (scalar) return scalar;
  if (Array.isArray(value)) {
    const scalars = value.map(scalarText).filter((item): item is string => item !== null);
    if (scalars.length) return scalars.join("; ");
    for (const item of value) {
      const text = primaryOfObject(item, keys);
      if (text) return text;
    }
    return null;
  }
  return primaryOfObject(value, keys);
}

/** Applies `toPrimaryText` to the listed outputs and leaves every other output as it is. */
export function toPrimaryOutputs(
  outputs: Record<string, unknown>,
  primaryKeys: Record<string, readonly string[]>,
): Record<string, unknown> {
  const result = { ...outputs };
  for (const [outputKey, keys] of Object.entries(primaryKeys)) {
    if (outputKey in result) result[outputKey] = toPrimaryText(result[outputKey], keys);
  }
  return result;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

export function errorMessage(body: unknown, fallback: string): string {
  const record = asRecord(body);
  const value = record.error ?? record.message;
  return typeof value === "string" ? value.slice(0, 300) : fallback.slice(0, 300);
}

export function truncate(value: unknown): unknown {
  try {
    const json = JSON.stringify(value);
    return json.length > MAX_AUDIT_BYTES
      ? { truncated: true, preview: json.slice(0, MAX_AUDIT_BYTES) }
      : value;
  } catch {
    return null;
  }
}
