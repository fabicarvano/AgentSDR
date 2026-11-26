import { describe, expect, test } from "bun:test";
import {
  companyDomainFromEmail,
  type JobLevel,
  jobTitleOutputs,
  normalizeCnpjCell,
  normalizeEmailCell,
  normalizeJobTitleCell,
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
  const EMPTY = { firstName: null, name2: null, name3: null, name4: null, name5: null, name6: null, lastName: null };

  test("splits a first and a last name", () => {
    expect(normalizeNameCell("Ada Lovelace")).toEqual({ ...EMPTY, firstName: "Ada", name2: "Lovelace", lastName: "Lovelace" });
  });

  test("drops particles and gives each name its own position", () => {
    expect(normalizeNameCell("Maria da Silva dos Santos")).toEqual({
      ...EMPTY,
      firstName: "Maria",
      name2: "Silva",
      name3: "Santos",
      lastName: "Santos",
    });
  });

  test("keeps a suffix such as Junior as a name of its own", () => {
    expect(normalizeNameCell("João Luiz da Silva Carneiro Junior")).toEqual({
      ...EMPTY,
      firstName: "João",
      name2: "Luiz",
      name3: "Silva",
      name4: "Carneiro",
      name5: "Junior",
      lastName: "Junior",
    });
  });

  test("the sixth position takes whatever is left", () => {
    expect(normalizeNameCell("Ana Bia Caio Davi Eva Fabio Gil Hugo")).toEqual({
      firstName: "Ana",
      name2: "Bia",
      name3: "Caio",
      name4: "Davi",
      name5: "Eva",
      name6: "Fabio Gil Hugo",
      lastName: "Hugo",
    });
  });

  test("collapses extra spaces and ignores the case of a particle", () => {
    expect(normalizeNameCell("  Maria   DA  Silva ")).toEqual({ ...EMPTY, firstName: "Maria", name2: "Silva", lastName: "Silva" });
  });

  test("a single word has no last name", () => {
    expect(normalizeNameCell("Madonna")).toEqual({ ...EMPTY, firstName: "Madonna" });
  });

  test("a leading title is dropped", () => {
    expect(normalizeNameCell("Dr. João de Souza")).toEqual({ ...EMPTY, firstName: "João", name2: "Souza", lastName: "Souza" });
    expect(normalizeNameCell("Sra Ana Lima")).toEqual({ ...EMPTY, firstName: "Ana", name2: "Lima", lastName: "Lima" });
  });

  test("a particle in first place is kept, so the first name is never blank", () => {
    expect(normalizeNameCell("Di Caprio")).toEqual({ ...EMPTY, firstName: "Di", name2: "Caprio", lastName: "Caprio" });
  });

  test("blank, or only a title, gives nothing", () => {
    expect(normalizeNameCell("   ")).toEqual(EMPTY);
    expect(normalizeNameCell("")).toEqual(EMPTY);
    expect(normalizeNameCell("Dr.")).toEqual(EMPTY);
  });
});

describe("normalizeCnpjCell", () => {
  const INVALID = { cnpj: null, isValid: false, isHeadquarters: null };

  test("a masked headquarters CNPJ becomes digits and is a headquarters", () => {
    expect(normalizeCnpjCell("11.222.333/0001-81")).toEqual({ cnpj: "11222333000181", isValid: true, isHeadquarters: true });
  });

  test("a masked branch CNPJ is valid and not a headquarters", () => {
    expect(normalizeCnpjCell("11.222.333/0002-62")).toEqual({ cnpj: "11222333000262", isValid: true, isHeadquarters: false });
    expect(normalizeCnpjCell("00.000.000/0002-72")).toEqual({ cnpj: "00000000000272", isValid: true, isHeadquarters: false });
  });

  test("digits only reads the same as the masked number", () => {
    expect(normalizeCnpjCell("11222333000181")).toEqual(normalizeCnpjCell("11.222.333/0001-81"));
  });

  test("a wrong check digit is invalid", () => {
    expect(normalizeCnpjCell("11.222.333/0001-80")).toEqual(INVALID);
  });

  test("repeated digits are invalid although the checksum holds", () => {
    expect(normalizeCnpjCell("11111111111111")).toEqual(INVALID);
    expect(normalizeCnpjCell("00000000000000")).toEqual(INVALID);
  });

  test("a text with the wrong length is invalid and is not padded", () => {
    expect(normalizeCnpjCell("1122233300018")).toEqual(INVALID);
    expect(normalizeCnpjCell("191")).toEqual(INVALID);
  });

  test("a number a spreadsheet import read gets its lost leading zeros back", () => {
    expect(normalizeCnpjCell(191)).toEqual({ cnpj: "00000000000191", isValid: true, isHeadquarters: true });
  });

  test("empty and non-numeric text are invalid", () => {
    expect(normalizeCnpjCell("")).toEqual(INVALID);
    expect(normalizeCnpjCell("abc")).toEqual(INVALID);
  });
});

describe("normalizeJobTitleCell", () => {
  const cases: Array<[string, JobLevel]> = [
    ["CEO", "c_level"],
    ["Diretor Presidente", "c_level"],
    ["Sócio", "c_level"],
    ["Founder", "c_level"],
    ["Chief Revenue Officer", "c_level"],
    ["Fundadora", "c_level"],
    ["Presidente", "c_level"],
    ["Sócio-diretor", "c_level"],
    ["Vice-presidente de Vendas", "vp"],
    ["VP of Sales", "vp"],
    ["Vice President", "vp"],
    ["SVP Marketing", "vp"],
    ["Diretor Comercial", "director"],
    ["DIRETORA DE MARKETING", "director"],
    ["Sales Director", "director"],
    ["Head of Growth", "director"],
    ["Gerente de Contas", "manager"],
    ["Product Manager", "manager"],
    ["gerente", "manager"],
    ["Gerente e Analista", "manager"],
    ["Coordenador de TI", "coordinator"],
    ["Supervisor de Vendas", "coordinator"],
    ["Líder de Equipe", "coordinator"],
    ["Analista de Marketing", "analyst"],
    ["Business Analyst", "analyst"],
    ["Especialista em CRM", "analyst"],
    ["Assistente de Diretoria", "assistant"],
    ["Executive Assistant", "assistant"],
    ["Estagiário de Vendas", "assistant"],
    ["Auxiliar Administrativo", "assistant"],
    ["Assistente de Gerente", "assistant"],
    ["Assistant to the CEO", "assistant"],
    ["Assistente Administrativo", "assistant"],
    ["Assistant Vice President", "vp"],
    ["Assistant Manager", "manager"],
    ["Assistant Director", "director"],
    ["Diretor Assistente", "director"],
    ["Gerente de Contas Assistente", "manager"],
    ["Trainee Program Manager", "manager"],
    ["Gestor Comercial", "manager"],
    ["Gestora de Contas", "manager"],
    ["Superintendente", "director"],
    ["CRO", "c_level"],
    ["CHRO", "c_level"],
    ["Chairman", "c_level"],
    ["Team Leader", "coordinator"],
    ["Consultor de Vendas", "unknown"],
    ["Product Owner", "unknown"],
    ["Lead Developer", "unknown"],
    ["Gerenciamento de Projetos", "unknown"],
    ["Diretoria", "unknown"],
  ];

  for (const [title, level] of cases) {
    test(`${title} is ${level}`, () => {
      expect(normalizeJobTitleCell(title)).toEqual({ level });
    });
  }

  test("accents and case are ignored", () => {
    expect(normalizeJobTitleCell("SÓCIO").level).toBe("c_level");
    expect(normalizeJobTitleCell("socio").level).toBe("c_level");
  });

  test("a blank title has no level", () => {
    expect(normalizeJobTitleCell("")).toEqual({ level: null });
    expect(normalizeJobTitleCell("   ")).toEqual({ level: null });
  });
});

describe("jobTitleOutputs", () => {
  test("gives the level in Portuguese and keeps the stable code beside it", () => {
    expect(jobTitleOutputs("Gerente de Vendas")).toEqual({ level: "Gerente", levelCode: "manager" });
    expect(jobTitleOutputs("CEO")).toEqual({ level: "C-level", levelCode: "c_level" });
    expect(jobTitleOutputs("Vice President")).toEqual({ level: "VP", levelCode: "vp" });
    expect(jobTitleOutputs("Head of Sales")).toEqual({ level: "Diretor", levelCode: "director" });
    expect(jobTitleOutputs("Coordenadora")).toEqual({ level: "Coordenador/Supervisor", levelCode: "coordinator" });
    expect(jobTitleOutputs("Data Analyst")).toEqual({ level: "Analista/Especialista", levelCode: "analyst" });
    expect(jobTitleOutputs("Estagiário")).toEqual({ level: "Assistente/Estagiário", levelCode: "assistant" });
    expect(jobTitleOutputs("Astronauta")).toEqual({ level: "Não identificado", levelCode: "unknown" });
  });

  test("an empty title gives two empty outputs", () => {
    expect(jobTitleOutputs("  ")).toEqual({ level: null, levelCode: null });
  });
});
