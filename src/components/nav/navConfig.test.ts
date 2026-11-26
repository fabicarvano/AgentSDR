import { describe, expect, mock, test } from "bun:test";

// lucide-react calls react.createContext, which the react-server build used by `bun run test` lacks.
// The icon is never rendered here, so a stub is enough; the import has to follow the mock.
mock.module("lucide-react", () => ({ Funnel: () => null }));
const { NAV_SECTIONS, activeHref, allLinks, paletteItems } = await import("./navConfig");

describe("navigation after the Prospecting module was switched off", () => {
  const hrefs = allLinks().map((l) => l.href);

  test("the old module routes are not in the menu", () => {
    expect(hrefs).not.toContain("/domains");
    expect(hrefs).not.toContain("/campaigns");
    expect(paletteItems((k) => k).map((i) => i.href)).not.toContain("/domains");
    expect(paletteItems((k) => k).map((i) => i.href)).not.toContain("/campaigns");
  });

  test("Prospecting is a plain link in Data, right before Tables", () => {
    const data = NAV_SECTIONS.find((s) => s.labelKey === "data");
    expect(data?.entries.map((e) => (e.kind === "link" ? e.href : e.id))).toEqual(["/prospecting", "/tables"]);
    expect(paletteItems((k) => k).map((i) => i.href)).toContain("/prospecting");
    expect(activeHref("/prospecting")).toBe("/prospecting");
  });

  test("the campaign pages of the other channels stay in the menu", () => {
    for (const href of ["/outreach/campaigns", "/linkedin/campaigns", "/whatsapp/campaigns", "/calling/campaigns"]) {
      expect(hrefs).toContain(href);
    }
    expect(activeHref("/campaigns")).toBeUndefined();
  });
});
