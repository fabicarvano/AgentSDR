import type { IntegrationActionDefinition, IntegrationDefinition } from "../types";

const DOCS_URL = "https://github.com/fabicarvano/AgentSDR/blob/main/docs/tables/agentservice.mdx";

function action(
  definition: Pick<IntegrationActionDefinition, "key" | "name" | "description" | "tags" | "inputs" | "outputs"> & {
    handler: string;
  },
): IntegrationActionDefinition {
  const { handler, ...rest } = definition;
  return {
    ...rest,
    docsUrl: DOCS_URL,
    category: "normalize",
    type: "enrichment",
    handlerKey: `agentservice.${handler}`,
    implemented: true,
  };
}

/**
 * AgentService: the actions that run inside AgentSDR and call nobody.
 *
 * It is an integration only because the grid knows no other way to offer an
 * action. There is no account to add: the organization always has one verified
 * connection (see agentServiceConnection in lib/grid/providers.ts), so the
 * actions are never greyed out and a run costs nothing.
 */
export const AGENTSERVICE: IntegrationDefinition = {
  key: "agentservice",
  name: "AgentService",
  description: "Clean and standardize values inside AgentSDR. No account or credits needed.",
  websiteUrl: "https://github.com/fabicarvano/AgentSDR",
  iconText: "AS",
  iconBackground: "#0f766e",
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
          example: "https://www.acme.com/about",
        },
      ],
      outputs: [{ key: "domain", name: "Domain", columnType: "text", example: "acme.com" }],
    }),
    action({
      key: "company-domain-from-email",
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
          example: "https://br.linkedin.com/in/ada-lovelace/?trk=abc",
        },
      ],
      outputs: [
        { key: "slug", name: "Profile Slug", columnType: "text", example: "ada-lovelace" },
        { key: "profileUrl", name: "Profile URL", columnType: "url", example: "https://www.linkedin.com/in/ada-lovelace" },
      ],
    }),
  ],
};
