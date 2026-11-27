import type { StaticColumnType } from "@/lib/grid/types";

export type ActionCategory =
  | "ai"
  | "enrich-company-info"
  | "enrich-person-info"
  | "extract"
  | "normalize"
  | "score"
  | "organize"
  | "summarize"
  | "tools";

export type ActionExecutionType = "enrichment" | "waterfall" | "ai" | "function";

export type InputValueType =
  | "text"
  /** Free text, or a number a spreadsheet import read as one (a phone with no punctuation). */
  | "textOrNumber"
  | "email"
  | "url"
  | "domain"
  | "number"
  | "boolean"
  | "date"
  | "json";

export type ActionInputDefinition = {
  key: string;
  name: string;
  description: string;
  valueType: InputValueType;
  /** Grid column types accepted by the mapping UI and server validator. */
  acceptedColumnTypes: StaticColumnType[];
  required: boolean;
  /**
   * A blank cell still runs the action, with "" as the value, instead of failing the
   * row with "A value is required". For local actions whose answer to "nothing"
   * is a normal result (Valid Phone = false); paid providers leave it off.
   */
  allowEmpty?: boolean;
  example?: string;
  /** Optional presentation group for actions that expose an addable filter builder. */
  group?: "filter" | "advanced";
  /** Accept a scalar cell or a list-valued cell and normalize it provider-side. */
  multiple?: boolean;
  /** Retain a persisted input contract without offering it for new mappings. */
  hidden?: boolean;
};

export type ActionOutputDefinition = {
  key: string;
  name: string;
  description?: string;
  columnType: StaticColumnType;
  example?: string;
};

export type IntegrationActionDefinition = {
  key: string;
  name: string;
  description: string;
  /** Official provider documentation for this specific action. */
  docsUrl: string;
  category: ActionCategory;
  type: ActionExecutionType;
  tags: string[];
  inputs: ActionInputDefinition[];
  outputs: ActionOutputDefinition[];
  /**
   * Output keys ticked when a function is added to a table (see `defaultOutputKeys` in the catalog). Without it
   * the first two outputs are ticked. Provider integrations start with none ticked and never read this.
   */
  defaultOutputs?: string[];
  handlerKey: string;
  /** False until the provider-specific server handler is registered. */
  implemented: boolean;
  /** Render named filter inputs as addable rows and require this many mappings. */
  filterBuilder?: {
    minFilters: number;
  };
  creditsPerRun?: number;
  async?: {
    maxBatchSize: number;
    pollAfterMs: number;
    timeoutMs: number;
    webhookSupported: boolean;
  };
};

/**
 * How the tables present a definition. A "function" runs inside AgentSDR, needs no account and is added from
 * Add column, Functions; an "integration" is a provider picked in the enrichment dialog. Not the same thing as
 * the action-level ActionExecutionType "function".
 */
export type IntegrationKind = "integration" | "function";

export type IntegrationDefinition = {
  key: string;
  /** Absent means "integration". */
  kind?: IntegrationKind;
  name: string;
  description: string;
  /** Canonical provider website. Used for the favicon fallback. */
  websiteUrl: string;
  /** Preferred local or remote SVG/logo asset. */
  iconUrl?: string;
  iconText: string;
  iconBackground: string;
  auth: {
    type: "api_key" | "oauth2";
    fields: Array<{
      key: string;
      label: string;
      placeholder?: string;
      inputType: "text" | "password";
      required: boolean;
    }>;
    helpUrl?: string;
  };
  actions: IntegrationActionDefinition[];
};
