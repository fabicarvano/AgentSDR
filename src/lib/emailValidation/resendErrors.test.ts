import { describe, expect, test } from "bun:test";
import { classifyResendError, dailyLimit, pauseUntil, retryDelayMs, sendBudget } from "./resendErrors";

describe("classifyResendError", () => {
  test("quotas, rate limit and other 429s", () => {
    expect(classifyResendError(429, { name: "daily_quota_exceeded" })).toBe("daily_quota");
    expect(classifyResendError(429, { name: "monthly_quota_exceeded" })).toBe("monthly_quota");
    expect(classifyResendError(429, { name: "rate_limit_exceeded" })).toBe("rate_limit");
    expect(classifyResendError(429, null)).toBe("rate_limit");
  });
  test("key and domain problems are configuration errors", () => {
    expect(classifyResendError(401, { name: "missing_api_key" })).toBe("config");
    expect(classifyResendError(403, { name: "suspended_api_key" })).toBe("config");
    expect(classifyResendError(403, { name: "validation_error", message: "The domain is not verified" })).toBe("config");
    expect(classifyResendError(422, { name: "missing_required_field" })).toBe("config");
  });
  test("a bad recipient is an invalid email", () => {
    expect(classifyResendError(422, { name: "validation_error", message: "Invalid `to` field." })).toBe("invalid_email");
    expect(classifyResendError(400, { name: "validation_error", message: "Invalid recipient" })).toBe("invalid_email");
    expect(classifyResendError(400, { name: "validation_error", message: "Invalid `from` field." })).toBe("config");
  });
  test("network errors and 5xx are transient", () => {
    expect(classifyResendError(null, null)).toBe("transient");
    expect(classifyResendError(500, { name: "application_error" })).toBe("transient");
    expect(classifyResendError(503, { name: "service_unavailable" })).toBe("transient");
  });
});

describe("pauseUntil", () => {
  const now = new Date("2026-11-18T15:30:00Z");
  test("daily quota waits for the next UTC day", () => {
    expect(pauseUntil("daily_quota", now)?.toISOString()).toBe("2026-11-19T00:00:00.000Z");
  });
  test("monthly quota waits for the 1st, across a year end", () => {
    expect(pauseUntil("monthly_quota", now)?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(pauseUntil("monthly_quota", new Date("2026-12-20T10:00:00Z"))?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  test("configuration errors wait an hour; the rest do not pause the queue", () => {
    expect(pauseUntil("config", now)?.toISOString()).toBe("2026-11-18T16:30:00.000Z");
    expect(pauseUntil("rate_limit", now)).toBeNull();
    expect(pauseUntil("transient", now)).toBeNull();
    expect(pauseUntil("invalid_email", now)).toBeNull();
  });
});

describe("retryDelayMs", () => {
  test("doubles from 2 minutes and stops at 6 hours", () => {
    expect(retryDelayMs(1)).toBe(2 * 60_000);
    expect(retryDelayMs(3)).toBe(8 * 60_000);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60_000);
  });
});

describe("daily limit", () => {
  test("defaults to 100 and ignores garbage", () => {
    expect(dailyLimit(undefined)).toBe(100);
    expect(dailyLimit("")).toBe(100);
    expect(dailyLimit("abc")).toBe(100);
    expect(dailyLimit("-5")).toBe(100);
    expect(dailyLimit("2.5")).toBe(100);
    expect(dailyLimit("250")).toBe(250);
    expect(dailyLimit("0")).toBe(0);
  });
  test("budget is the batch, capped by what is left today", () => {
    expect(sendBudget(100, 0)).toBe(20);
    expect(sendBudget(100, 90)).toBe(10);
    expect(sendBudget(100, 100)).toBe(0);
    expect(sendBudget(100, 140)).toBe(0);
    expect(sendBudget(0, 0)).toBe(0);
  });
});
