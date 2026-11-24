import type { useFormatter } from "next-intl";
import type { Messages } from "@/i18n/catalog";

export type Campaign = { id: string; name: string; channel: "email" | "linkedin"; status?: string };

export type PersonRow = {
  person: { id: string; email: string | null; linkedinUrl: string | null; fullName: string | null; title: string | null; profilePictureUrl?: string | null; phone?: string | null; source: string; raw?: Record<string, unknown>; updatedAt: string | Date | null };
  company: { name: string | null; domain: string } | null;
  campaigns: Campaign[];
  crm: { recordId: string; categoryKey: string | null; subcategory: string | null; workflowState: string; activeChannel: string | null; activeSequence: string | null; currentStep: string | null; lastInboundAt: string | Date | null; lastOutboundAt: string | Date | null; lastInteractionAt: string | Date | null; nextActionAt: string | Date | null; unacknowledgedAiChange: boolean } | null;
};

export type CompanyRow = {
  company: { id: string; name: string | null; domain: string; linkedinUrl: string | null; source: string; updatedAt: string | Date };
  peopleCount: number;
  campaigns: Campaign[];
};

export type LeadsTab = "people" | "companies";
export type Direction = "asc" | "desc";

export type PeopleFilters = {
  campaignChannel: string;
  hasEmail: boolean;
  hasLinkedin: boolean;
  crmCategory: string;
  crmSubcategoryId: string;
  crmWorkflowState: string;
  crmAiChange: boolean;
};

export const EMPTY_FILTERS: PeopleFilters = { campaignChannel: "", hasEmail: false, hasLinkedin: false, crmCategory: "", crmSubcategoryId: "", crmWorkflowState: "", crmAiChange: false };

export function activeFilterCount(filters: PeopleFilters): number {
  return [filters.campaignChannel, filters.hasEmail, filters.hasLinkedin, filters.crmCategory, filters.crmSubcategoryId, filters.crmWorkflowState, filters.crmAiChange].filter(Boolean).length;
}

export const PAGE_SIZE = 25;

export const linkedInPersonHref = (value: string) => (value.startsWith("http") ? value : `https://www.linkedin.com/in/${value}`);
export const linkedInCompanyHref = (value: string) => (value.startsWith("http") ? value : `https://www.linkedin.com/company/${value}`);
export const initials = (value: string | null) => (value || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

/** next-intl's formatter (useFormatter), handed in so these helpers follow the interface language. */
type Format = ReturnType<typeof useFormatter>;

// Dates are stored as UTC instants; formatting them in UTC keeps a day from shifting with the viewer's zone.
export const dateLabel = (format: Format, value: string | Date | null | undefined) => (value
  ? format.dateTime(new Date(value), { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
  : "—");

/** "Oct 3" this year, "Oct 3, 2025" otherwise (in the interface language), for dates inside a table cell. */
export const shortDate = (format: Format, value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return format.dateTime(date, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
};

/** Whether a timestamp is still ahead of now. */
export const isFuture = (value: string | Date) => new Date(value).getTime() > Date.now();

/** Key of a sort option's label in leads.sort (the labels live in the catalog, not here). */
export type SortLabelKey = keyof Messages["leads"]["sort"];

/** Sort choices per tab, for the toolbar's sort menu (keys match the API). */
export const SORTS: Record<LeadsTab, Array<{ key: string; labelKey: SortLabelKey }>> = {
  people: [
    { key: "updated", labelKey: "updated" },
    { key: "created", labelKey: "created" },
    { key: "name", labelKey: "name" },
    { key: "company", labelKey: "company" },
    { key: "title", labelKey: "title" },
    { key: "email", labelKey: "email" },
  ],
  companies: [
    { key: "updated", labelKey: "updated" },
    { key: "name", labelKey: "name" },
    { key: "domain", labelKey: "domain" },
    { key: "people", labelKey: "people" },
  ],
};

/** CRM categories the people filter offers; `value` is what the API stores, `labelKey` the entry in leads.crm.category. */
export const CRM_CATEGORIES = [
  { value: "customer", labelKey: "customer" },
  { value: "interested", labelKey: "interested" },
  { value: "not_interested", labelKey: "notInterested" },
  { value: "other", labelKey: "other" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: keyof Messages["leads"]["crm"]["category"] }>;

/** CRM workflow states, in the order the filter lists them; `labelKey` is the entry in leads.crm.state. */
export const CRM_STATES = [
  { value: "unclassified", labelKey: "unclassified" },
  { value: "classifying", labelKey: "classifying" },
  { value: "action_required", labelKey: "actionRequired" },
  { value: "waiting", labelKey: "waiting" },
  { value: "idle", labelKey: "idle" },
  { value: "paused", labelKey: "paused" },
  { value: "closed", labelKey: "closed" },
  { value: "error", labelKey: "error" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: keyof Messages["leads"]["crm"]["state"] }>;
