import type { IntegrationActionDefinition, IntegrationDefinition } from "../types";

const DOCS_URL = "https://github.com/fabicarvano/AgentSDR/blob/main/docs/tables/functions.mdx";

function action(
  definition: Pick<IntegrationActionDefinition, "key" | "name" | "description" | "tags" | "inputs" | "outputs"> &
    Partial<Pick<IntegrationActionDefinition, "category" | "defaultOutputs">> & {
      handler: string;
    },
): IntegrationActionDefinition {
  const { handler, ...rest } = definition;
  return {
    category: "normalize",
    ...rest,
    docsUrl: DOCS_URL,
    type: "enrichment",
    handlerKey: `agentservice.${handler}`,
    implemented: true,
  };
}

type ActionInput = IntegrationActionDefinition["inputs"][number];

/** Examples for Name 2 to Name 6 of the split name action. */
const NAME_POSITION_EXAMPLES = ["Silva", "Santos", "Carneiro", "Junior", "Neto"];

/** A required cell input that accepts an empty cell (the action then returns empty). */
function cellInput(
  input: Pick<ActionInput, "key" | "name" | "description" | "example"> &
    Partial<Pick<ActionInput, "valueType" | "acceptedColumnTypes">>,
): ActionInput {
  return {
    valueType: "text",
    acceptedColumnTypes: ["text"],
    ...input,
    required: true,
    allowEmpty: true,
  };
}

/**
 * AgentService: the actions that run inside AgentSDR and call nobody.
 *
 * The tables offer them as functions (kind "function": Add column, Functions), not
 * as a provider. Underneath it is still an integration definition, because the
 * runner knows no other way to run an action: the organization always has one
 * verified connection (see virtualConnectionFor in lib/grid/providers.ts), so a
 * run needs no account and costs nothing.
 */
export const AGENTSERVICE: IntegrationDefinition = {
  key: "agentservice",
  kind: "function",
  name: "AgentService",
  description: "Clean and standardize values inside AgentSDR. No account or credits needed.",
  websiteUrl: "https://github.com/fabicarvano/AgentSDR",
  iconUrl: "/Integrations - Icon/agentsdr.svg",
  iconText: "AS",
  iconBackground: "#1f3bad",
  auth: { type: "api_key", fields: [] },
  actions: [
    action({
      key: "normalize-phone",
      name: "Normalize phone",
      description: "Turn a phone number into the international format (+5521986545481) that WhatsApp and calls expect.",
      tags: ["phone", "whatsapp", "e164", "format", "mobile"],
      handler: "normalizePhone",
      inputs: [
        {
          key: "phone",
          name: "Phone",
          description: "The phone number. A cell with several numbers keeps the first two valid ones.",
          valueType: "textOrNumber",
          acceptedColumnTypes: ["text", "number"],
          required: true,
          allowEmpty: true,
          example: "(21) 98654-5481",
        },
      ],
      outputs: [
        { key: "phone", name: "Normalized Phone", columnType: "text", example: "+5521986545481" },
        { key: "isValid", name: "Valid Phone", columnType: "boolean" },
        { key: "isMobile", name: "Mobile Phone", columnType: "boolean" },
        { key: "secondPhone", name: "Second Phone", columnType: "text", example: "+552133334444" },
      ],
    }),
    action({
      key: "normalize-email",
      name: "Normalize email",
      description: "Clean an email address: lowercase, no spaces or extra text, and flag personal mailboxes.",
      tags: ["email", "format", "personal", "gmail"],
      handler: "normalizeEmail",
      inputs: [
        {
          key: "email",
          name: "Email",
          description: "The email address, even with a name or mailto: around it.",
          valueType: "text",
          acceptedColumnTypes: ["text", "email"],
          required: true,
          allowEmpty: true,
          example: "Ada <Ada@Acme.com>",
        },
      ],
      outputs: [
        { key: "email", name: "Normalized Email", columnType: "email", example: "ada@acme.com" },
        { key: "isValid", name: "Valid Email", columnType: "boolean" },
        { key: "isPersonal", name: "Personal Email", columnType: "boolean" },
      ],
    }),
    action({
      key: "site-domain",
      category: "extract",
      name: "Domain from website",
      description: "Get the plain domain from a website address, without https, www or the page path.",
      tags: ["domain", "website", "url", "company"],
      handler: "siteDomain",
      inputs: [
        {
          key: "website",
          name: "Website",
          description: "The company website or domain.",
          valueType: "text",
          acceptedColumnTypes: ["text", "url"],
          required: true,
          allowEmpty: true,
          example: "https://www.acme.com/about",
        },
      ],
      outputs: [{ key: "domain", name: "Domain", columnType: "text", example: "acme.com" }],
    }),
    action({
      key: "company-domain-from-email",
      category: "extract",
      name: "Company domain from email",
      description: "Get the company domain behind a work email. Personal mailboxes such as Gmail return nothing.",
      tags: ["domain", "email", "company"],
      handler: "companyDomainFromEmail",
      inputs: [
        {
          key: "email",
          name: "Email",
          description: "The work email address.",
          valueType: "text",
          acceptedColumnTypes: ["text", "email"],
          required: true,
          allowEmpty: true,
          example: "ada@acme.com",
        },
      ],
      outputs: [{ key: "domain", name: "Company Domain", columnType: "text", example: "acme.com" }],
    }),
    action({
      key: "normalize-linkedin",
      name: "Normalize LinkedIn profile",
      description: "Get the public profile name and the clean profile link from a LinkedIn URL.",
      tags: ["linkedin", "profile", "url", "slug"],
      handler: "normalizeLinkedin",
      inputs: [
        {
          key: "profile",
          name: "LinkedIn Profile",
          description: "A LinkedIn profile URL, with or without tracking parameters.",
          valueType: "text",
          acceptedColumnTypes: ["text", "url"],
          required: true,
          allowEmpty: true,
          example: "https://br.linkedin.com/in/ada-lovelace/?trk=abc",
        },
      ],
      outputs: [
        { key: "slug", name: "Profile Slug", columnType: "text", example: "ada-lovelace" },
        { key: "profileUrl", name: "Profile URL", columnType: "url", example: "https://www.linkedin.com/in/ada-lovelace" },
      ],
    }),
    action({
      key: "normalize-name",
      // First and last name, not First Name and Name 2.
      defaultOutputs: ["firstName", "lastName"],
      name: "Normalize name",
      description: "Split a full name into one column per name, dropping particles such as da and dos and titles such as Dr.",
      tags: ["name", "first name", "last name", "middle name", "split"],
      handler: "normalizeName",
      inputs: [
        cellInput({
          key: "name",
          name: "Full Name",
          description: "The full name of the person.",
          example: "Maria da Silva dos Santos",
        }),
      ],
      outputs: [
        { key: "firstName", name: "First Name", columnType: "text", example: "Maria" },
        ...NAME_POSITION_EXAMPLES.map((example, index) => ({
          key: `name${index + 2}`,
          name: `Name ${index + 2}`,
          columnType: "text" as const,
          example,
        })),
        { key: "lastName", name: "Last Name", columnType: "text", example: "Santos" },
      ],
    }),
    action({
      key: "normalize-cnpj",
      name: "Normalize CNPJ",
      description: "Keep only the digits of a CNPJ, check it, and tell a headquarters from a branch.",
      tags: ["cnpj", "company", "brazil", "headquarters", "branch"],
      handler: "normalizeCnpj",
      inputs: [
        cellInput({
          key: "cnpj",
          name: "CNPJ",
          description: "The company CNPJ, with or without dots, slash and dash.",
          valueType: "textOrNumber",
          acceptedColumnTypes: ["text", "number"],
          example: "11.222.333/0001-81",
        }),
      ],
      outputs: [
        { key: "cnpj", name: "Normalized CNPJ", columnType: "text", example: "11222333000181" },
        { key: "isValid", name: "Valid CNPJ", columnType: "boolean" },
        { key: "isHeadquarters", name: "Headquarters", columnType: "boolean" },
      ],
    }),
    action({
      key: "normalize-job-title",
      name: "Normalize job title",
      description: "Turn a job title into a seniority level: C-level, VP, director, manager, coordinator, analyst or assistant.",
      tags: ["job title", "seniority", "level", "role", "cargo"],
      handler: "normalizeJobTitle",
      inputs: [
        cellInput({
          key: "title",
          name: "Job Title",
          description: "The job title, in Portuguese or English.",
          example: "Gerente de Vendas",
        }),
      ],
      outputs: [
        { key: "level", name: "Seniority Level", columnType: "text", example: "Gerente" },
        { key: "levelCode", name: "Level Code", columnType: "text", example: "manager" },
      ],
    }),
  ],
};
