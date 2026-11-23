/**
 * The message catalog is split by domain: messages/<locale>/<domain>.json, so
 * several people (or agents) can translate different areas without touching the
 * same file. English is the source of truth: these types come from it, so a
 * component that asks for a key English does not have fails `tsc`.
 *
 * To add a domain, create messages/en/<domain>.json and messages/pt-BR/<domain>.json
 * (each file's top-level keys are the namespaces it owns, and a namespace lives in
 * exactly one file), then add it in the three places below. messages.test.ts fails
 * if a locale is missing the file, an orphan file exists, or a namespace is owned twice.
 */
import type analytics from "../../messages/en/analytics.json";
import type auth from "../../messages/en/auth.json";
import type callingAiSetup from "../../messages/en/callingAiSetup.json";
import type callingAiWork from "../../messages/en/callingAiWork.json";
import type callingMain from "../../messages/en/callingMain.json";
import type callsMain from "../../messages/en/callsMain.json";
import type whatsappCampaigns from "../../messages/en/whatsappCampaigns.json";
import type common from "../../messages/en/common.json";
import type crmActions from "../../messages/en/crmActions.json";
import type crmPipeline from "../../messages/en/crmPipeline.json";
import type crmRecord from "../../messages/en/crmRecord.json";
import type crmSequences from "../../messages/en/crmSequences.json";
import type crmShared from "../../messages/en/crmShared.json";
import type emailCampaigns from "../../messages/en/emailCampaigns.json";
import type emailLeads from "../../messages/en/emailLeads.json";
import type emailMailboxes from "../../messages/en/emailMailboxes.json";
import type emailSequence from "../../messages/en/emailSequence.json";
import type emailWizard from "../../messages/en/emailWizard.json";
import type gridColumns from "../../messages/en/gridColumns.json";
import type gridEnrich from "../../messages/en/gridEnrich.json";
import type gridMain from "../../messages/en/gridMain.json";
import type inboxMain from "../../messages/en/inboxMain.json";
import type inboxShell from "../../messages/en/inboxShell.json";
import type inboxThread from "../../messages/en/inboxThread.json";
import type leads from "../../messages/en/leads.json";
import type linkedinCampaigns from "../../messages/en/linkedinCampaigns.json";
import type linkedinMain from "../../messages/en/linkedinMain.json";
import type linkedinSearch from "../../messages/en/linkedinSearch.json";
import type serverCalling from "../../messages/en/serverCalling.json";
import type serverCrm from "../../messages/en/serverCrm.json";
import type serverMeta from "../../messages/en/serverMeta.json";
import type serverWhatsapp from "../../messages/en/serverWhatsapp.json";
import type integrationsRegistry from "../../messages/en/integrationsRegistry.json";
import type settings from "../../messages/en/settings.json";
import type settingsAccounts from "../../messages/en/settingsAccounts.json";
import type settingsAi from "../../messages/en/settingsAi.json";
import type settingsChannels from "../../messages/en/settingsChannels.json";
import type settingsKnowledge from "../../messages/en/settingsKnowledge.json";
import type settingsOrg from "../../messages/en/settingsOrg.json";
import type settingsStations from "../../messages/en/settingsStations.json";
import type shared from "../../messages/en/shared.json";
import type shell from "../../messages/en/shell.json";

type Catalog = {
  analytics: typeof analytics;
  auth: typeof auth;
  callingAiSetup: typeof callingAiSetup;
  callingAiWork: typeof callingAiWork;
  callingMain: typeof callingMain;
  callsMain: typeof callsMain;
  common: typeof common;
  crmActions: typeof crmActions;
  crmPipeline: typeof crmPipeline;
  crmRecord: typeof crmRecord;
  crmSequences: typeof crmSequences;
  crmShared: typeof crmShared;
  emailCampaigns: typeof emailCampaigns;
  emailLeads: typeof emailLeads;
  emailMailboxes: typeof emailMailboxes;
  emailSequence: typeof emailSequence;
  emailWizard: typeof emailWizard;
  gridColumns: typeof gridColumns;
  gridEnrich: typeof gridEnrich;
  gridMain: typeof gridMain;
  inboxMain: typeof inboxMain;
  inboxShell: typeof inboxShell;
  inboxThread: typeof inboxThread;
  leads: typeof leads;
  linkedinCampaigns: typeof linkedinCampaigns;
  linkedinMain: typeof linkedinMain;
  linkedinSearch: typeof linkedinSearch;
  serverCalling: typeof serverCalling;
  serverCrm: typeof serverCrm;
  serverMeta: typeof serverMeta;
  serverWhatsapp: typeof serverWhatsapp;
  integrationsRegistry: typeof integrationsRegistry;
  settings: typeof settings;
  settingsAccounts: typeof settingsAccounts;
  settingsAi: typeof settingsAi;
  settingsChannels: typeof settingsChannels;
  settingsKnowledge: typeof settingsKnowledge;
  settingsOrg: typeof settingsOrg;
  settingsStations: typeof settingsStations;
  shared: typeof shared;
  shell: typeof shell;
  whatsappCampaigns: typeof whatsappCampaigns;
};

/** Same list as Catalog's keys: the loader and the tests walk it. */
export const DOMAINS = ["analytics", "auth", "callingAiSetup", "callingAiWork", "callingMain", "callsMain", "common", "crmActions", "crmPipeline", "crmRecord", "crmSequences", "crmShared", "emailCampaigns", "emailLeads", "emailMailboxes", "emailSequence", "emailWizard", "gridColumns", "gridEnrich", "gridMain", "inboxMain", "inboxShell", "inboxThread", "integrationsRegistry", "leads", "linkedinCampaigns", "linkedinMain", "linkedinSearch", "settings", "settingsAccounts", "settingsAi", "settingsChannels", "settingsKnowledge", "settingsOrg", "settingsStations", "serverCalling", "serverCrm", "serverMeta", "serverWhatsapp", "shared", "shell", "whatsappCampaigns"] as const satisfies readonly (keyof Catalog)[]; // gitleaks:allow (domain names such as "linkedinMain", not a LinkedIn client id)

export type Domain = (typeof DOMAINS)[number];

// Compile-time check that DOMAINS lists every Catalog key (a forgotten one is an error here).
const _allDomainsListed: Exclude<keyof Catalog, Domain> extends never ? true : false = true;
void _allDomainsListed;

type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;

/** Every message, all domains merged: what next-intl sees as `Messages`. */
export type Messages = Intersect<Catalog[keyof Catalog]>;
