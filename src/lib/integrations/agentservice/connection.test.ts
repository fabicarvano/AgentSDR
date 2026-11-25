import { describe, expect, test } from "bun:test";
import { agentServiceConnectionIdFor } from "./connection";

const ORG_A = "6f1c2d9e-0a53-4b7e-9d41-2c8f7a6b5e10";
const ORG_B = "a2b4c6d8-1e3f-4a5b-8c7d-9e0f1a2b3c4d";

describe("agentServiceConnectionIdFor", () => {
  test("is stable for one organization", () => {
    expect(agentServiceConnectionIdFor(ORG_A)).toBe(agentServiceConnectionIdFor(ORG_A));
  });

  test("differs between organizations, so another organization's id does not match", () => {
    expect(agentServiceConnectionIdFor(ORG_A)).not.toBe(agentServiceConnectionIdFor(ORG_B));
  });

  test("has the shape of a version 5 UUID, which the id checks accept", () => {
    expect(agentServiceConnectionIdFor(ORG_A)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
