import { describe, expect, test } from "bun:test";
import { emailReach, type EmailBadge, type EmailStatusKey } from "./reachEmail";

describe("email reach state per validation status", () => {
  const rows: Array<[string | null, EmailStatusKey, string, EmailBadge | null]> = [
    [null, "unverified", "text-text-soft-400", null],
    ["validando", "verifying", "text-warning-base", "clock"],
    ["na_fila", "verifying", "text-warning-base", "clock"],
    ["valido", "validated", "text-success-base", "check"],
    ["valido_presumido", "validatedPresumed", "text-green-400", "check"],
    ["valido_ativo", "validatedHot", "text-green-700", "fire"],
    ["invalido", "invalid", "text-error-base", "x"],
    ["temporario", "unconfirmed", "text-warning-base", "question"],
    ["indeterminado", "unconfirmed", "text-warning-base", "question"],
  ];
  for (const [status, statusKey, colorClass, badge] of rows) {
    test(`${status ?? "no record"} -> ${statusKey}`, () => {
      expect(emailReach(status)).toEqual({ statusKey, colorClass, badge });
    });
  }

  test("an unknown status reads as not verified", () => {
    expect(emailReach("something_new")).toEqual(emailReach(null));
    expect(emailReach(undefined)).toEqual(emailReach(null));
  });

  test("every state with a record has its own badge or colour, so colour is never the only signal", () => {
    const signals = ["validando", "valido", "valido_presumido", "valido_ativo", "invalido", "temporario"].map((s) => {
      const r = emailReach(s);
      return `${r.badge}|${r.statusKey}`;
    });
    expect(new Set(signals).size).toBe(signals.length);
  });
});
