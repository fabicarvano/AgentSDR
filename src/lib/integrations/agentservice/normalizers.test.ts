import { describe, expect, test } from "bun:test";
import {
  companyDomainFromEmail,
  normalizeEmailCell,
  normalizeLinkedinCell,
  normalizeNameCell,
  normalizePhoneCell,
  siteDomain,
} from "./normalizers";

describe("normalizePhoneCell", () => {
  test("formats a Brazilian mobile typed with punctuation", () => {
    expect(normalizePhoneCell("(21) 98654-5481", "BR")).toEqual({
      phone: "+5521986545481",
      isValid: true,
      isMobile: true,
      secondPhone: null,
    });
  });

  test("keeps a number that already has its country code, whatever the default country", () => {
    expect(normalizePhoneCell("+55 21 98654-5481", undefined).phone).toBe("+5521986545481");
  });

  test("reads a number a spreadsheet import turned into a number", () => {
    expect(normalizePhoneCell(21986545481, "BR").phone).toBe("+5521986545481");
  });

  test("a cell with two numbers fills the first and second phone", () => {
    const result = normalizePhoneCell("(21) 98654-5481 / (21) 3333-4444", "BR");
    expect(result.phone).toBe("+5521986545481");
    expect(result.secondPhone).toBe("+552133334444");
    expect(result.isMobile).toBe(true);
  });

  test("the same number twice is one number", () => {
    const result = normalizePhoneCell("21 98654-5481 ou (21) 98654-5481", "BR");
    expect(result.phone).toBe("+5521986545481");
    expect(result.secondPhone).toBeNull();
  });

  test("a landline is valid but not mobile", () => {
    const result = normalizePhoneCell("(21) 3333-4444", "BR");
    expect(result.isValid).toBe(true);
    expect(result.isMobile).toBe(false);
  });

  test("a number without + and no country to read it in is not guessed", () => {
    expect(normalizePhoneCell("(21) 98654-5481", undefined)).toEqual({
      phone: null,
      isValid: false,
      isMobile: null,
      secondPhone: null,
    });
  });

  test("a spreadsheet number that already carries the country code is read as it is", () => {
    expect(normalizePhoneCell(5521986545481, "BR").phone).toBe("+5521986545481");
  });

  test("a number the country does not assign is invalid", () => {
    expect(normalizePhoneCell("(21) 1111-1111", "BR").isValid).toBe(false);
  });

  test("text that is not a number is invalid, not an error", () => {
    expect(normalizePhoneCell("sem telefone", "BR").isValid).toBe(false);
  });
});

describe("normalizeEmailCell", () => {
  test("lowercases and trims", () => {
    expect(normalizeEmailCell("  Ada@Acme.COM ")).toEqual({ email: "ada@acme.com", isValid: true, isPersonal: false });
  });

  test("finds the address inside a name or mailto:", () => {
    expect(normalizeEmailCell("Ada Lovelace <Ada@Acme.com>").email).toBe("ada@acme.com");
    expect(normalizeEmailCell("mailto:ada@acme.com").email).toBe("ada@acme.com");
    expect(normalizeEmailCell("ada@acme.com.").email).toBe("ada@acme.com");
  });

  test("flags a personal mailbox", () => {
    expect(normalizeEmailCell("ada@gmail.com").isPersonal).toBe(true);
  });

  test("anything else is invalid, with no personal flag", () => {
    expect(normalizeEmailCell("sem email")).toEqual({ email: null, isValid: false, isPersonal: null });
  });
});

describe("siteDomain", () => {
  test("drops scheme, www, path, query and port", () => {
    expect(siteDomain("https://www.Acme.com.br/sobre?x=1")).toBe("acme.com.br");
    expect(siteDomain("acme.com:8080/a")).toBe("acme.com");
  });

  test("rejects what is not a domain", () => {
    expect(siteDomain("sem site")).toBeNull();
    expect(siteDomain("ada@acme.com")).toBeNull();
    expect(siteDomain("")).toBeNull();
  });
});

describe("companyDomainFromEmail", () => {
  test("returns the company domain of a work address", () => {
    expect(companyDomainFromEmail("Ada <ada@Acme.com>")).toBe("acme.com");
  });

  test("returns nothing for a personal mailbox or a non-address", () => {
    expect(companyDomainFromEmail("ada@gmail.com")).toBeNull();
    expect(companyDomainFromEmail("acme.com")).toBeNull();
  });
});

describe("normalizeLinkedinCell", () => {
  test("takes the slug from a profile URL with tracking and builds the clean link", () => {
    expect(normalizeLinkedinCell("https://br.linkedin.com/in/Ada-Lovelace/?trk=abc")).toEqual({
      slug: "ada-lovelace",
      profileUrl: "https://www.linkedin.com/in/ada-lovelace",
    });
  });

  test("accepts a bare slug", () => {
    expect(normalizeLinkedinCell("ada-lovelace").slug).toBe("ada-lovelace");
  });

  test("a company page, a Sales Navigator link and text have no public slug", () => {
    expect(normalizeLinkedinCell("https://www.linkedin.com/company/acme").slug).toBeNull();
    expect(normalizeLinkedinCell("https://www.linkedin.com/sales/lead/ACwAAAabc123").slug).toBeNull();
    expect(normalizeLinkedinCell("Ada Lovelace").slug).toBeNull();
  });
});

describe("personal mailboxes", () => {
  test("Brazilian providers count as personal", () => {
    for (const domain of ["uol.com.br", "bol.com.br", "terra.com.br", "yahoo.com.br", "hotmail.com.br", "outlook.com.br", "msn.com", "aol.com"]) {
      expect(normalizeEmailCell(`ada@${domain}`).isPersonal).toBe(true);
      expect(companyDomainFromEmail(`ada@${domain}`)).toBeNull();
    }
  });

  test("a company address is not personal and gives its domain", () => {
    expect(normalizeEmailCell("ada@acme.com.br").isPersonal).toBe(false);
    expect(companyDomainFromEmail("Ada <ada@acme.com.br>")).toBe("acme.com.br");
  });
});

describe("blank cells", () => {
  test("a blank phone is not valid", () => {
    expect(normalizePhoneCell("", "BR")).toEqual({ phone: null, isValid: false, isMobile: null, secondPhone: null });
    expect(normalizePhoneCell("   ", "BR").isValid).toBe(false);
  });

  test("a blank e-mail is not valid", () => {
    expect(normalizeEmailCell("")).toEqual({ email: null, isValid: false, isPersonal: null });
  });

  test("blank site, e-mail and profile give empty results", () => {
    expect(siteDomain("")).toBeNull();
    expect(companyDomainFromEmail("")).toBeNull();
    expect(normalizeLinkedinCell("").slug).toBeNull();
  });
});

describe("normalizeNameCell", () => {
  test("splits a first and a last name", () => {
    expect(normalizeNameCell("Ada Lovelace")).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });

  test("collapses extra spaces and keeps particles in the last name", () => {
    expect(normalizeNameCell("  Maria   da  Silva ")).toEqual({ firstName: "Maria", lastName: "da Silva" });
  });

  test("a single word has no last name", () => {
    expect(normalizeNameCell("Madonna")).toEqual({ firstName: "Madonna", lastName: null });
  });

  test("blank gives nothing", () => {
    expect(normalizeNameCell("   ")).toEqual({ firstName: null, lastName: null });
    expect(normalizeNameCell("")).toEqual({ firstName: null, lastName: null });
  });

  test("a prefix is not treated specially", () => {
    expect(normalizeNameCell("Dr. João de Souza")).toEqual({ firstName: "Dr.", lastName: "João de Souza" });
  });
});
