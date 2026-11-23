"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckboxBlankLine,
  RiCheckboxLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiFlashlightLine,
  RiLoader4Line,
  RiSearchLine,
} from "@remixicon/react";
import * as Select from "@/components/alignui/select";
import type { GridColumn } from "@/lib/grid/schema";
import type { IntegrationConnection } from "@/lib/grid/providers";
import type { EnrichmentConfig } from "@/lib/grid/types";
import { effectiveColumnType, inputAcceptsColumnType } from "@/lib/grid/value-types";
import { DocsLink } from "@/components/page/DocsLink";
import IntegrationIcon from "./IntegrationIcon";
import {
  ACTION_CATEGORIES,
  INTEGRATIONS,
  getIntegration,
  getIntegrationAction,
} from "@/lib/integrations/catalog";
import type { Messages } from "@/i18n/catalog";
import type { ActionCategory, ActionInputDefinition, IntegrationDefinition } from "@/lib/integrations/types";
import { useColumnTypeLabel } from "./columnTypes";

type Step = "setup" | "outputs";

/**
 * The text of the integrations (description, auth field labels) and of the action categories lives in the
 * catalog under gridEnrich.registry, not in src/lib/integrations/*: that registry is read by server code and
 * stays in English. `_enrichmentsCovered` and CATEGORY_KEY fail tsc when this list or ActionCategory grows
 * without text. A new integration in the registry is not caught by tsc (its key is a plain string): add it to
 * INTEGRATION_KEYS and the catalog. Anything without an entry (a new integration, an action's own name,
 * description, inputs and outputs) shows the registry's English instead of failing.
 */
const INTEGRATION_KEYS = [
  "apollo", "cleanlist", "companyenrich", "snov", "millionverifier", "contactout", "findymail", "fullenrich",
  "hunter", "leadmagic", "lusha", "zerobounce", "similarweb", "semrush", "rocketreach", "icypeas",
] as const;
const _enrichmentsCovered: Record<(typeof INTEGRATION_KEYS)[number], { description: string }> =
  {} as Messages["gridEnrich"]["registry"]["integrations"];
void _enrichmentsCovered;
void INTEGRATION_KEYS; // the list is read as a type by the check above

const CATEGORY_KEY: Record<ActionCategory, keyof Messages["gridEnrich"]["registry"]["categories"]> = {
  ai: "ai",
  "enrich-company-info": "enrichCompanyInfo",
  "enrich-person-info": "enrichPersonInfo",
  extract: "extract",
  normalize: "normalize",
  score: "score",
  organize: "organize",
  summarize: "summarize",
  tools: "tools",
};

function useRegistryTexts() {
  const tr = useTranslations("gridEnrich.registry") as unknown as ((key: string, values?: Record<string, string>) => string) & {
    has: (key: string) => boolean;
  };
  const lookup = (key: string, fallback: string, values?: Record<string, string>) =>
    tr.has(key) ? tr(key, values) : fallback;
  // Action, input and output texts: integrationsRegistry.<integration>.actions.<action>… (English fallback).
  const ta = useTranslations("integrationsRegistry") as unknown as ((key: string) => string) & { has: (key: string) => boolean };
  const own = (key: string, fallback: string) => (ta.has(key) ? ta(key) : fallback);
  type AuthField = IntegrationDefinition["auth"]["fields"][number];
  return {
    description: (integration: IntegrationDefinition) =>
      lookup(`integrations.${integration.key}.description`, integration.description),
    actionName: (integrationKey: string, action: { key: string; name: string }) =>
      own(`${integrationKey}.actions.${action.key}.name`, action.name),
    actionDescription: (integrationKey: string, action: { key: string; description: string }) =>
      own(`${integrationKey}.actions.${action.key}.description`, action.description),
    inputName: (integrationKey: string, actionKey: string | null | undefined, input: { key: string; name: string }) =>
      own(`${integrationKey}.actions.${actionKey ?? ""}.inputs.${input.key}.name`, input.name),
    inputDescription: (integrationKey: string, actionKey: string | null | undefined, input: { key: string; description: string }) =>
      own(`${integrationKey}.actions.${actionKey ?? ""}.inputs.${input.key}.description`, input.description),
    // Shown only: the column a run creates is named from the English registry (a name is data, not interface).
    outputName: (integrationKey: string, actionKey: string | null | undefined, output: { key: string; name: string }) =>
      own(`${integrationKey}.actions.${actionKey ?? ""}.outputs.${output.key}.name`, output.name),
    category: (key: ActionCategory, fallback: string) => lookup(`categories.${CATEGORY_KEY[key]}`, fallback),
    fieldLabel: (integration: IntegrationDefinition | null | undefined, field: AuthField) =>
      !integration
        ? field.label
        : lookup(
            `integrations.${integration.key}.fields.${field.key}.label`,
            lookup(`authFields.${field.key}.label`, field.label, { name: integration.name }),
          ),
    fieldPlaceholder: (integration: IntegrationDefinition | null | undefined, field: AuthField) =>
      !integration
        ? field.placeholder
        : lookup(
            `integrations.${integration.key}.fields.${field.key}.placeholder`,
            lookup(`authFields.${field.key}.placeholder`, field.placeholder ?? "", { name: integration.name }),
          ),
  };
}

function ColumnMappingSelect({
  input,
  columns,
  value,
  onChange,
}: {
  input: ActionInputDefinition;
  columns: GridColumn[];
  value: string;
  onChange: (columnKey: string) => void;
}) {
  const t = useTranslations("gridEnrich.enrichment");
  const format = useFormatter();
  const columnTypeLabel = useColumnTypeLabel();
  // The server's rule (a Text "domain" column can feed a URL input).
  const compatible = columns.filter((column) =>
    inputAcceptsColumnType(input.acceptedColumnTypes, effectiveColumnType(column)),
  );
  return (
    <>
      <Select.Root size="small" value={value} onValueChange={onChange}>
        <Select.Trigger aria-label={t("mapping.selectAria")} className="w-full">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="">{t("mapping.selectPlaceholder")}</Select.Item>
          {compatible.map((column) => (
            <Select.Item key={column.key} value={column.key}>
              {column.name} · {columnTypeLabel(effectiveColumnType(column))}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {!compatible.length && (
        <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-400">
          {t("mapping.noCompatible", {
            types: format.list(input.acceptedColumnTypes.map((type) => columnTypeLabel(type)), { type: "disjunction" }),
          })}
        </span>
      )}
    </>
  );
}

export default function EnrichmentDialog({
  open,
  tableId,
  columns,
  firstRowIds,
  column: columnProp,
  afterColumnId,
  beforeColumnId,
  onClose,
  onSaved,
}: {
  open: boolean;
  tableId: string;
  columns: GridColumn[];
  firstRowIds: string[];
  column?: GridColumn;
  afterColumnId?: string;
  beforeColumnId?: string;
  onClose: () => void;
  onSaved: (activeJobs?: number) => void | Promise<void>;
}) {
  const t = useTranslations("gridEnrich.enrichment");
  const registry = useRegistryTexts();
  const columnTypeLabel = useColumnTypeLabel();
  // A column created by this dialog: if the run that follows is refused, the
  // dialog stays open on it and the next save updates it instead of adding another.
  const [created, setCreated] = useState<GridColumn | null>(null);
  const column = columnProp ?? created ?? undefined;
  const seededColumnId = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [outputSearch, setOutputSearch] = useState("");
  const [integrationKey, setIntegrationKey] = useState(INTEGRATIONS[0]?.key ?? "");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("setup");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [activeFilterKeys, setActiveFilterKeys] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<Set<string>>(new Set());
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectedIntegrationKeys, setConnectedIntegrationKeys] = useState<Set<string>>(new Set());
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [autoRun, setAutoRun] = useState(true);
  const [runInBatches, setRunInBatches] = useState(false);
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [runCondition, setRunCondition] = useState("");
  const [delayEnabled, setDelayEnabled] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The portal target only exists after client hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!open) {
      seededColumnId.current = null;
      // Closing the dialog resets its draft before the next open.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch("");
      setOutputSearch("");
      setActionKey(null);
      setStep("setup");
      setInputs({});
      setActiveFilterKeys([]);
      setOutputs(new Set());
      setConnections([]);
      setConnectedIntegrationKeys(new Set());
      setConnectionsLoading(false);
      setConnectionId("");
      setAddingAccount(false);
      setAccountName("");
      setCredentialValues({});
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !column || column.type !== "enrichment") return;
    // Seed once per column: a grid refresh hands over a new column object
    // while the form is being edited, and must not reset it.
    if (seededColumnId.current === column.id) return;
    seededColumnId.current = column.id;
    const config = column.config as EnrichmentConfig;
    // Synchronize the editable draft when a saved enrichment is opened.
    setIntegrationKey(config.integrationKey);
    setActionKey(config.actionKey);
    setStep("setup");
    const action = getIntegrationAction(config.integrationKey, config.actionKey);
    setInputs(Object.fromEntries(Object.entries(config.inputs).map(([key, binding]) => [key, binding.columnKey])));
    setActiveFilterKeys(
      action?.inputs
        .filter((input) => input.group === "filter" && !input.hidden && config.inputs[input.key])
        .map((input) => input.key) ?? [],
    );
    const catalogOutputKeys = new Set(action?.outputs.map((output) => output.key) ?? []);
    setOutputs(new Set(Object.keys(config.outputs).filter((key) => catalogOutputKeys.has(key))));
    setConnectionId(config.connectionId);
    setAutoRun(column.autoRun);
    setRunInBatches(Boolean(config.runInBatches));
    setConditionEnabled(Boolean(config.runCondition));
    setRunCondition(config.runCondition ?? "");
    setDelayEnabled(Boolean(config.delaySeconds));
    setDelaySeconds(config.delaySeconds || 30);
  }, [column, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all(
      INTEGRATIONS.map(async (candidate) => {
        try {
          const response = await fetch(`/api/grid/integrations/${candidate.key}/connections`);
          if (!response.ok) return null;
          const data = await response.json();
          const available = (data.connections ?? []).some(
            (connection: IntegrationConnection) => connection.enabled && connection.verified,
          );
          return available ? candidate.key : null;
        } catch {
          return null;
        }
      }),
    ).then((keys) => {
      if (!cancelled) setConnectedIntegrationKeys(new Set(keys.filter((key): key is string => Boolean(key))));
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || !integrationKey) return;
    let cancelled = false;
    // Reflect the request started by this dependency change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectionsLoading(true);
    void fetch(`/api/grid/integrations/${integrationKey}/connections`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? t("errors.loadAccounts"));
        if (!cancelled) {
          const next = (data.connections ?? []) as IntegrationConnection[];
          setConnections(next);
          if (next.some((item) => item.enabled && item.verified)) {
            setConnectedIntegrationKeys((current) => new Set(current).add(integrationKey));
          } else {
            setConnectedIntegrationKeys((current) => {
              const updated = new Set(current);
              updated.delete(integrationKey);
              return updated;
            });
          }
          setConnectionId((current) =>
            next.some((item) => item.id === current && item.verified)
              ? current
              : next.find((item) => item.verified)?.id || "",
          );
        }
      })
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : t("errors.loadAccounts")))
      .finally(() => !cancelled && setConnectionsLoading(false));
    return () => { cancelled = true; };
  }, [integrationKey, open, t]);

  function selectIntegration(key: string) {
    setIntegrationKey(key);
    setAddingAccount(false);
    setAccountName("");
    setCredentialValues({});
    setError(null);
  }

  // The column's own outputs (and the column itself) cannot be its inputs: that would be a cycle.
  const inputColumns = useMemo(() => columns.filter((candidate) =>
    candidate.id !== column?.id
    && !(column
      && candidate.type === "integration_output"
      && (candidate.config as { sourceColumnKey?: string }).sourceColumnKey === column.key)
  ), [columns, column]);

  const integration = getIntegration(integrationKey);
  const action = actionKey ? getIntegrationAction(integrationKey, actionKey) : null;
  // The closure captures the category (a string), not `action`: passing a closure over `action` to the registry
  // call made the React Compiler skip the component ("this dependency may be modified later").
  const actionCategory = action?.category;
  const categoryName = actionCategory
    ? registry.category(
        actionCategory,
        ACTION_CATEGORIES.find((category) => category.key === actionCategory)?.name ?? actionCategory,
      )
    : null;

  // Not wrapped in useMemo: it reads the translated texts through `registry` (see the note on filteredOutputs).
  // The search matches the English registry words (tags, category) and the words shown in the interface language.
  const filteredActions = (() => {
    if (!integration) return [];
    const query = search.trim().toLowerCase();
    if (!query) return integration.actions;
    return integration.actions.filter((candidate) =>
      [candidate.name, candidate.description, candidate.category, ...candidate.tags, registry.actionName(integrationKey, candidate), registry.actionDescription(integrationKey, candidate)]
        .join(" ").toLowerCase().includes(query),
    );
  })();

  // Not wrapped in useMemo: with the translated registry texts the React Compiler could not preserve a manual
  // memo over `action` (lint error). It memoizes this on its own.
  const filteredOutputs = (() => {
    if (!action) return [];
    const query = outputSearch.trim().toLowerCase();
    return query
      ? action.outputs.filter((output) => `${output.name} ${registry.outputName(integrationKey, actionKey, output)} ${output.key} ${output.columnType} ${columnTypeLabel(output.columnType)}`.toLowerCase().includes(query))
      : action.outputs;
  })();

  function chooseAction(nextActionKey: string) {
    if (connectionsLoading) return;
    if (!connectedIntegrationKeys.has(integrationKey)) {
      setAddingAccount(true);
      return;
    }
    setActionKey(nextActionKey);
    setStep("setup");
    setInputs({});
    setActiveFilterKeys([]);
    setOutputs(new Set());
    setError(null);
  }

  async function addAccount() {
    if (!integration) return;
    const missing = integration.auth.fields.find(
      (field) => field.required && !credentialValues[field.key]?.trim(),
    );
    if (missing) return setError(t("errors.enterField", { field: registry.fieldLabel(integration, missing) }));
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/grid/integrations/${integration.key}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: accountName, credentials: credentialValues }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? t("errors.addAccount"));
        return;
      }
      setConnections((current) => [...current, data.connection]);
      setConnectedIntegrationKeys((current) => new Set(current).add(integration.key));
      setConnectionId(data.connection.id);
      setAddingAccount(false);
      setAccountName("");
      setCredentialValues({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.addAccount"));
    } finally {
      setBusy(false);
    }
  }

  // One mapped input: its label (and star when required), its description and the column picker. Shared by the
  // standard and the advanced lists.
  function renderMappedInput(input: ActionInputDefinition) {
    return (
      <label key={input.key} className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-text-strong-950">
          {registry.inputName(integrationKey, actionKey, input)}{input.required && <span className="text-red-500"> *</span>}
        </span>
        {input.description && <span className="mb-2 block text-[12px] text-text-sub-600">{registry.inputDescription(integrationKey, actionKey, input)}</span>}
        <ColumnMappingSelect
          input={input}
          columns={inputColumns}
          value={inputs[input.key] ?? ""}
          onChange={(columnKey) => setInputColumn(input.key, columnKey)}
        />
      </label>
    );
  }

  function continueToOutputs() {
    if (!action) return;
    if (!connectionId) return setError(t("errors.connectFirst", { provider: integration?.name ?? t("errors.providerFallback") }));
    const missing = action.inputs.find((input) => input.required && !inputs[input.key]);
    if (missing) return setError(t("errors.selectColumnFor", { name: registry.inputName(integrationKey, actionKey, missing) }));
    if (action.filterBuilder) {
      const mappedFilters = action.inputs.filter(
        (input) => input.group === "filter" && inputs[input.key],
      ).length;
      if (mappedFilters < action.filterBuilder.minFilters) {
        return setError(t("errors.minFilters", { count: action.filterBuilder.minFilters }));
      }
    }
    setError(null);
    setStep("outputs");
  }

  function setInputColumn(inputKey: string, columnKey: string) {
    setError(null);
    setInputs((current) => {
      if (columnKey) return { ...current, [inputKey]: columnKey };
      const next = { ...current };
      delete next[inputKey];
      return next;
    });
  }

  function addFilter(inputKey: string) {
    if (!inputKey) return;
    setActiveFilterKeys((current) => current.includes(inputKey) ? current : [...current, inputKey]);
  }

  function replaceFilter(currentKey: string, nextKey: string) {
    if (!nextKey || currentKey === nextKey) return;
    setActiveFilterKeys((current) => current.map((key) => key === currentKey ? nextKey : key));
    setInputs((current) => {
      const next = { ...current };
      delete next[currentKey];
      return next;
    });
  }

  function removeFilter(inputKey: string) {
    setActiveFilterKeys((current) => current.filter((key) => key !== inputKey));
    setInputColumn(inputKey, "");
  }

  async function save(runFirstTen: boolean) {
    if (!action || !connectionId) return;
    if (!outputs.size) return setError(t("errors.selectOutput"));
    // The grid can hand over its coverage row, which is not a real row.
    const runRowIds = firstRowIds.filter((id) => id !== "__coverage").slice(0, 10);
    if (runFirstTen && action.implemented && runRowIds.length === 0) {
      return setError(t("errors.noRowsToRun"));
    }
    const mappedInputs = Object.fromEntries(
      Object.entries(inputs).filter(([, columnKey]) => Boolean(columnKey)),
    );
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/grid/tables/${tableId}/enrichments`, {
        method: column ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationKey,
          actionKey: action.key,
          columnId: column?.id,
          connectionId,
          inputs: mappedInputs,
          selectedOutputs: [...outputs],
          autoRun,
          runInBatches,
          runCondition: conditionEnabled ? runCondition : undefined,
          delaySeconds: delayEnabled ? delaySeconds : 0,
          afterColumnId,
          beforeColumnId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setError(data.error ?? t("errors.addEnrichment"));
      if (!column && Array.isArray(data.columns) && data.columns[0]) {
        // Already seeded from what is on screen; do not re-seed from the saved copy.
        seededColumnId.current = (data.columns[0] as GridColumn).id;
        setCreated(data.columns[0] as GridColumn);
      }

      let activeJobs: number | undefined;
      if (runFirstTen && action.implemented) {
        const runResponse = await fetch(`/api/grid/tables/${tableId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnKey: data.primaryColumnKey, rowIds: runRowIds }),
        });
        const runData = await runResponse.json().catch(() => ({}));
        if (!runResponse.ok) {
          // The columns exist now: refresh the grid and keep the dialog open on them.
          await onSaved();
          return setError(runData.error ?? t("errors.savedRunFailed"));
        }
        activeJobs = runData.activeJobs;
      }

      setError(null);
      await onSaved(activeJobs);
      onClose();
    } catch {
      setError(t("errors.save"));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !mounted) return null;

  const mappedFilterCount = action?.inputs.filter(
    (input) => input.group === "filter" && inputs[input.key],
  ).length ?? 0;
  const missingInputs = !action
    || action.inputs.some((input) => input.required && !inputs[input.key])
    || Boolean(action.filterBuilder && mappedFilterCount < action.filterBuilder.minFilters);
  const configuredConnection = connections.find((item) => item.id === connectionId && item.verified);
  const visibleInputs = action?.inputs.filter((input) => !input.hidden) ?? [];
  const filterInputs = visibleInputs.filter((input) => input.group === "filter");
  const advancedInputs = visibleInputs.filter((input) => input.group === "advanced");
  const standardInputs = visibleInputs.filter((input) => !input.group);
  const activeFilterInputs = activeFilterKeys.flatMap((key) => {
    const input = filterInputs.find((candidate) => candidate.key === key);
    return input ? [input] : [];
  });
  const legacyMappedFilterInputs = action?.inputs.filter(
    (input) => input.hidden && input.group === "filter" && inputs[input.key],
  ) ?? [];
  const unusedFilterInputs = filterInputs.filter((input) => !activeFilterKeys.includes(input.key));

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]" onClick={busy ? undefined : onClose} />
      <div className={`absolute flex overflow-hidden bg-bg-white-0 shadow-2xl ring-1 ring-stroke-soft-200 ${action ? "inset-y-0 right-0 w-full max-w-[600px] flex-col" : "left-1/2 top-1/2 h-[min(760px,90vh)] w-[min(1000px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stroke-soft-200 px-5">
          <div className="flex min-w-0 items-center gap-2">
            {action && <button type="button" onClick={() => step === "outputs" ? setStep("setup") : column ? onClose() : setActionKey(null)} disabled={busy} className="rounded-lg border border-stroke-soft-200 p-2 text-text-sub-600 hover:bg-bg-weak-50"><RiArrowLeftLine className="size-5" /></button>}
            {action && integration && <IntegrationIcon integration={integration} size={32} />}
            <h2 className="truncate text-[18px] font-semibold text-text-strong-950">{action ? registry.actionName(integrationKey, action) : t("title")}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-text-sub-600 hover:bg-bg-weak-50 disabled:opacity-50"><RiCloseLine className="size-5" /></button>
        </div>

        {!action ? (
          <Catalog
            search={search}
            setSearch={setSearch}
            integrationKey={integrationKey}
            setIntegrationKey={selectIntegration}
            filteredActions={filteredActions}
            chooseAction={chooseAction}
            connectedIntegrationKeys={connectedIntegrationKeys}
            connectionsLoading={connectionsLoading}
            addingAccount={addingAccount}
            onAddingAccountChange={setAddingAccount}
            accountName={accountName}
            onAccountNameChange={(next) => { setAccountName(next); setError(null); }}
            credentialValues={credentialValues}
            onCredentialChange={(key, value) =>
              { setCredentialValues((current) => ({ ...current, [key]: value })); setError(null); }
            }
            busy={busy}
            error={error}
            onAddAccount={addAccount}
          />
        ) : step === "setup" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto bg-bg-weak-50/50 p-5">
              <section className="mb-4">
                <h3 className="text-[13px] font-semibold text-text-strong-950">{t("action.title")}</h3>
                <div className="mt-2 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4">
                  <p className="text-[14px] font-semibold text-text-strong-950">{integration?.name} <span className="mx-1 text-text-soft-400">›</span> {registry.actionName(integrationKey, action)}</p>
                  <p className="mt-1 text-[13px] text-text-sub-600">{registry.actionDescription(integrationKey, action)}</p>
                  <a href={action.docsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 hover:underline">{t("action.viewDocs")} <RiExternalLinkLine className="size-3.5" /></a>
                  <p className="mt-2 text-[11px] font-medium text-text-soft-400">{t("action.categoryLine", { category: categoryName ?? "" })}</p>
                </div>
              </section>

              <section className="mb-4 overflow-hidden rounded-xl border border-stroke-soft-200 bg-bg-white-0">
                <h3 className="bg-bg-weak-50 px-4 py-3 text-[14px] font-semibold text-text-strong-950">{t("account.title")}</h3>
                <div className="p-4">
                  {connections.length > 0 && (
                    <Select.Root size="small" value={connectionId} onValueChange={(next) => { setConnectionId(next); setError(null); }}>
                      <Select.Trigger aria-label={t("account.aria", { provider: integration?.name ?? t("account.integrationFallback") })} className="w-full">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="">{t("account.select", { provider: integration?.name ?? "" })}</Select.Item>
                        {connections.map((connection) => (
                          <Select.Item key={connection.id} value={connection.id} disabled={!connection.verified}>
                            {connection.verified ? connection.name : t("account.needsVerification", { name: connection.name })}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  )}
                  {!addingAccount ? (
                    <button type="button" onClick={() => setAddingAccount(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-[13px] font-medium text-white hover:bg-blue-700"><RiAddLine className="size-4" />{t("account.add")}</button>
                  ) : (
                    <div className="mt-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 p-3">
                      <input value={accountName} onChange={(event) => { setAccountName(event.target.value); setError(null); }} placeholder={t("account.namePlaceholder", { provider: integration?.name ?? "" })} className="mt-2 w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-[13px] outline-none focus:border-blue-500" />
                      {integration?.auth.fields.map((field) => (
                        <label key={field.key} className="mt-2 block">
                          <span className="mb-1 block text-[11px] font-medium text-text-sub-600">{registry.fieldLabel(integration, field)}{field.required && <span className="text-red-500"> *</span>}</span>
                          <input type={field.inputType} autoComplete="off" value={credentialValues[field.key] ?? ""} onChange={(event) => { setCredentialValues((current) => ({ ...current, [field.key]: event.target.value })); setError(null); }} placeholder={registry.fieldPlaceholder(integration, field)} className="w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-[13px] outline-none focus:border-blue-500" />
                        </label>
                      ))}
                      <p className="mt-2 text-[11px] text-text-sub-600">{t("account.encryptedNote")}</p>
                      <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setAddingAccount(false); setCredentialValues({}); }} className="px-2 py-1.5 text-[12px] text-text-sub-600">{t("account.cancel")}</button><button type="button" onClick={() => void addAccount()} disabled={busy || integration?.auth.fields.some((field) => field.required && !credentialValues[field.key]?.trim())} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">{busy ? t("account.verifying") : t("account.verifyConnect")}</button></div>
                    </div>
                  )}
                </div>
              </section>

              <section className="mb-4 overflow-hidden rounded-xl border border-stroke-soft-200 bg-bg-white-0">
                <h3 className="bg-bg-weak-50 px-4 py-3 text-[14px] font-semibold text-text-strong-950">{t("columnMapping.title")}</h3>
                <div className="space-y-4 p-4">
                  {standardInputs.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-sub-600">{t("columnMapping.setupInputs")}</p>
                      {standardInputs.map(renderMappedInput)}
                    </div>
                  )}

                  {action.filterBuilder && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-sub-600">{t("columnMapping.searchFilters")}</p>
                        <p className="mt-1 text-[12px] leading-5 text-text-sub-600">
                          {t("columnMapping.filtersIntro")}
                        </p>
                      </div>

                      {legacyMappedFilterInputs.map((input) => (
                        <div key={input.key} className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[13px] font-medium text-amber-950 dark:text-amber-400">{t("columnMapping.legacyTitle")}</p>
                              <p className="mt-1 text-[12px] leading-5 text-amber-800 dark:text-amber-400">
                                {t("columnMapping.legacyBody")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInputColumn(input.key, "")}
                              className="rounded-lg p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/15"
                              aria-label={t("columnMapping.legacyRemoveAria")}
                            >
                              <RiCloseLine className="size-4" />
                            </button>
                          </div>
                          <div className="mt-3">
                            <ColumnMappingSelect
                              input={input}
                              columns={inputColumns}
                              value={inputs[input.key] ?? ""}
                              onChange={(columnKey) => setInputColumn(input.key, columnKey)}
                            />
                          </div>
                        </div>
                      ))}

                      {activeFilterInputs.map((input) => (
                        <div key={input.key} className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50/60 p-3">
                          <div className="flex items-start gap-2">
                            <label className="min-w-0 flex-1">
                              <span className="mb-1 block text-[11px] font-medium text-text-sub-600">{t("columnMapping.filter")}</span>
                              <Select.Root size="small" value={input.key} onValueChange={(next) => replaceFilter(input.key, next)}>
                                <Select.Trigger aria-label={t("columnMapping.filter")} className="w-full">
                                  <Select.Value />
                                </Select.Trigger>
                                <Select.Content>
                                  <Select.Item value={input.key}>{registry.inputName(integrationKey, actionKey, input)}</Select.Item>
                                  {unusedFilterInputs.map((candidate) => (
                                    <Select.Item key={candidate.key} value={candidate.key}>{registry.inputName(integrationKey, actionKey, candidate)}</Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeFilter(input.key)}
                              className="mt-5 rounded-lg p-2.5 text-text-sub-600 hover:bg-bg-soft-200 hover:text-text-strong-950"
                              aria-label={t("columnMapping.removeFilterAria", { name: registry.inputName(integrationKey, actionKey, input) })}
                            >
                              <RiCloseLine className="size-4" />
                            </button>
                          </div>
                          {input.description && <p className="mt-2 text-[12px] text-text-sub-600">{registry.inputDescription(integrationKey, actionKey, input)}</p>}
                          <label className="mt-3 block">
                            <span className="mb-1 block text-[11px] font-medium text-text-sub-600">{t("columnMapping.mapValuesFrom")}</span>
                            <ColumnMappingSelect
                              input={input}
                              columns={inputColumns}
                              value={inputs[input.key] ?? ""}
                              onChange={(columnKey) => setInputColumn(input.key, columnKey)}
                            />
                          </label>
                        </div>
                      ))}

                      {unusedFilterInputs.length > 0 && (
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-medium text-text-sub-600">{t("columnMapping.addFilter")}</span>
                          <Select.Root size="small" value="" onValueChange={addFilter}>
                            <Select.Trigger aria-label={t("columnMapping.addFilter")} className="w-full border-dashed border-blue-300 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                              <Select.Value placeholder={t("columnMapping.chooseFilter")} />
                            </Select.Trigger>
                            <Select.Content>
                              {unusedFilterInputs.map((input) => (
                                <Select.Item key={input.key} value={input.key}>{registry.inputName(integrationKey, actionKey, input)}</Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Root>
                        </label>
                      )}

                      {activeFilterInputs.length === 0 && legacyMappedFilterInputs.length === 0 && (
                        <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-400">
                          {t("columnMapping.needOneFilter")}
                        </p>
                      )}
                    </div>
                  )}

                  {advancedInputs.length > 0 && (
                    <details className="rounded-lg border border-stroke-soft-200">
                      <summary className="cursor-pointer px-3 py-2.5 text-[13px] font-medium text-text-strong-950">
                        {t("columnMapping.advanced")}
                      </summary>
                      <div className="space-y-4 border-t border-stroke-soft-200 p-3">
                        {advancedInputs.map(renderMappedInput)}
                      </div>
                    </details>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-bg-white-0">
                <h3 className="bg-bg-weak-50 px-4 py-3 text-[14px] font-semibold text-text-strong-950">{t("run.title")}</h3>
                <div className="space-y-4 p-4 text-[13px]">
                  <Toggle label={t("run.autoRun")} checked={autoRun} onChange={setAutoRun} />
                  <Toggle label={t("run.inBatches")} checked={runInBatches} onChange={setRunInBatches} disabled />
                  <label className="flex items-start gap-2"><input type="checkbox" checked={conditionEnabled} onChange={(event) => setConditionEnabled(event.target.checked)} className="mt-0.5 size-4" /><span><span className="font-medium text-text-strong-950">{t("run.addCondition")}</span><span className="block text-[12px] text-text-sub-600">{t("run.conditionHelp")}</span></span></label>
                  {conditionEnabled && <input value={runCondition} onChange={(event) => setRunCondition(event.target.value)} placeholder={t("run.conditionPlaceholder", { example: "{{email}} != ''" })} className="w-full rounded-lg border border-stroke-soft-200 px-3 py-2 text-[13px] outline-none focus:border-blue-500" />}
                  <div><p className="font-medium text-text-strong-950">{t("run.delay")}</p><label className="mt-2 flex items-center gap-2"><input type="radio" checked={!delayEnabled} onChange={() => setDelayEnabled(false)} />{t("run.immediately")}</label><label className="mt-2 flex items-center gap-2"><input type="radio" checked={delayEnabled} onChange={() => setDelayEnabled(true)} />{t("run.afterDelay")}</label>{delayEnabled && <label className="mt-2 flex items-center gap-2 pl-5"><input type="number" min={1} max={600} value={delaySeconds} onChange={(event) => setDelaySeconds(Math.max(1, Math.min(600, Number(event.target.value) || 1)))} className="w-20 rounded-lg border border-stroke-soft-200 px-2 py-1.5" />{t("run.seconds")}</label>}</div>
                </div>
              </section>
            </div>
            {error && <p role="alert" className="mx-5 mb-3 mt-3 shrink-0 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>}
            <div className="flex shrink-0 items-center justify-between border-t border-stroke-soft-200 bg-bg-white-0 px-5 py-4"><span className="text-[12px] text-text-sub-600">{configuredConnection ? t("footer.accountConnected") : t("footer.apiKeyRequired")}</span><button type="button" onClick={continueToOutputs} disabled={busy || missingInputs || !configuredConnection} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white disabled:bg-blue-300">{t("footer.continue")}</button></div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-[18px] font-semibold text-text-strong-950">{t("outputs.title")}</h3><p className="mt-2 text-[13px] leading-5 text-text-sub-600">{t("outputs.intro")}</p></div><span className="shrink-0 text-[13px] text-text-sub-600">{t("outputs.selected", { count: outputs.size })}</span></div>
              <label className="mt-5 flex items-center gap-2 rounded-lg border border-stroke-soft-200 px-3 py-2.5"><RiSearchLine className="size-4 text-text-soft-400" /><input value={outputSearch} onChange={(event) => setOutputSearch(event.target.value)} placeholder={t("outputs.searchPlaceholder")} className="min-w-0 flex-1 text-[13px] outline-none" /></label>
              <div className="mt-4 space-y-2">{filteredOutputs.map((output) => { const selected = outputs.has(output.key); const alreadyAdded = column ? Object.prototype.hasOwnProperty.call((column.config as EnrichmentConfig).outputs, output.key) : false; return <button key={output.key} type="button" disabled={alreadyAdded} onClick={() => { setError(null); setOutputs((current) => { const next = new Set(current); if (selected) next.delete(output.key); else next.add(output.key); return next; }); }} className="flex w-full items-center gap-3 rounded-lg bg-bg-weak-50 px-3 py-3 text-left hover:bg-bg-weak-50 disabled:cursor-default">{selected ? <RiCheckboxLine className="size-5 text-blue-600 dark:text-blue-400" /> : <RiCheckboxBlankLine className="size-5 text-text-soft-400" />}<span className="min-w-0 flex-1"><span className="font-medium text-text-strong-950">{registry.outputName(integrationKey, actionKey, output)}</span>{output.example && <span className="ml-2 text-text-sub-600">{output.example}</span>}<span className="block text-[11px] text-text-soft-400">{alreadyAdded ? t("outputs.typeAlreadyAdded", { type: columnTypeLabel(output.columnType) }) : columnTypeLabel(output.columnType)}</span></span></button>; })}</div>
            </div>
            {error && <p role="alert" className="mx-5 mb-3 mt-3 shrink-0 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-stroke-soft-200 bg-bg-white-0 px-5 py-4"><button type="button" onClick={() => void save(false)} disabled={busy || !outputs.size} className="rounded-lg border border-stroke-soft-200 px-3 py-2.5 text-[13px] font-semibold text-text-strong-950 hover:bg-bg-weak-50 disabled:opacity-50">{column ? t("outputs.saveChanges") : t("outputs.saveWithoutRunning")}</button><button type="button" title={action.implemented ? undefined : t("outputs.notImplemented")} onClick={() => void save(true)} disabled={busy || !outputs.size || !action.implemented} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-[13px] font-semibold text-white disabled:bg-blue-300">{busy && <RiLoader4Line className="size-4 animate-spin" />}{t("outputs.saveAndRun")}</button></div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Catalog({
  search,
  setSearch,
  integrationKey,
  setIntegrationKey,
  filteredActions,
  chooseAction,
  connectedIntegrationKeys,
  connectionsLoading,
  addingAccount,
  onAddingAccountChange,
  accountName,
  onAccountNameChange,
  credentialValues,
  onCredentialChange,
  busy,
  error,
  onAddAccount,
}: {
  search: string;
  setSearch: (value: string) => void;
  integrationKey: string;
  setIntegrationKey: (value: string) => void;
  filteredActions: NonNullable<ReturnType<typeof getIntegration>>["actions"];
  chooseAction: (key: string) => void;
  connectedIntegrationKeys: ReadonlySet<string>;
  connectionsLoading: boolean;
  addingAccount: boolean;
  onAddingAccountChange: (value: boolean) => void;
  accountName: string;
  onAccountNameChange: (value: string) => void;
  credentialValues: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
  busy: boolean;
  error: string | null;
  onAddAccount: () => Promise<void>;
}) {
  const t = useTranslations("gridEnrich.enrichment");
  const registry = useRegistryTexts();
  const integration = getIntegration(integrationKey);
  const connected = connectedIntegrationKeys.has(integrationKey);
  return (
    <>
      <label className="flex h-[58px] shrink-0 items-center gap-3 border-b border-stroke-soft-200 px-6">
        <RiSearchLine className="size-5 text-text-soft-400" />
        <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("catalog.searchPlaceholder")} className="min-w-0 flex-1 text-[15px] outline-none placeholder:text-text-soft-400" />
      </label>
      <div className="flex h-[54px] shrink-0 items-end gap-6 border-b border-stroke-soft-200 px-6">
        <span className="border-b-2 border-blue-600 px-1 pb-3 text-[14px] font-semibold text-blue-600 dark:text-blue-400">{t("catalog.tabIntegrations")}</span>
        <span className="px-1 pb-3 text-[14px] text-text-disabled-300">{t("catalog.tabDiscover")}</span>
        <span className="px-1 pb-3 text-[14px] text-text-disabled-300">{t("catalog.tabTemplates")}</span>
        <span className="px-1 pb-3 text-[14px] text-text-disabled-300">{t("catalog.tabFunctions")}</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-stroke-soft-200 p-3">
          {INTEGRATIONS.map((candidate) => {
            const candidateConnected = connectedIntegrationKeys.has(candidate.key);
            return (
              <button key={candidate.key} type="button" onClick={() => setIntegrationKey(candidate.key)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium ${candidate.key === integrationKey ? "bg-bg-weak-50" : "hover:bg-bg-weak-50"}`}>
                <span className={candidateConnected ? "" : "grayscale opacity-50"}><IntegrationIcon integration={candidate} size={28} /></span>
                <span className={candidateConnected ? "text-text-strong-950" : "text-text-sub-600"}>{candidate.name}</span>
                <span className={`ml-auto size-2 rounded-full ${candidateConnected ? "bg-emerald-500" : "bg-bg-sub-300"}`} />
              </button>
            );
          })}
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex items-start justify-between gap-4 border-b border-stroke-soft-200 px-6 py-4">
            <div><h3 className="text-[16px] font-semibold">{integration?.name}</h3><p className="mt-1 text-[13px] text-text-sub-600">{integration ? registry.description(integration) : null}</p></div>
            {connectionsLoading ? (
              <span className="shrink-0 rounded-full bg-bg-weak-50 px-2 py-1 text-[11px] font-medium text-text-sub-600">{t("catalog.checking")}</span>
            ) : connected ? (
              <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">{t("catalog.connected")}</span>
            ) : (
              <button type="button" onClick={() => onAddingAccountChange(true)} className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-700"><RiAddLine className="mr-1 inline size-4" />{t("catalog.addIntegration")}</button>
            )}
          </div>
          {!connectionsLoading && !connected && (
            <div className="border-b border-stroke-soft-200 bg-blue-50/40 dark:bg-blue-500/10 px-6 py-4">
              {!addingAccount ? (
                <div>
                  <p className="text-[13px] font-semibold text-text-strong-950">{t("catalog.connectToUse", { name: integration?.name ?? "" })}</p>
                  <p className="mt-1 text-[12px] text-text-sub-600">
                    {t("catalog.credentialsVerified")}{" "}
                    <DocsLink page="integrations/enrichment-providers#connect-a-provider-account" appearance="inline" className="ml-1 text-[12px]" />
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-bg-white-0 p-4">
                  <h4 className="text-[14px] font-semibold text-text-strong-950">{t("catalog.addAccountTitle", { name: integration?.name ?? "" })}</h4>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-[12px] font-medium text-text-strong-950">{t("catalog.accountName")}</span>
                    <input value={accountName} onChange={(event) => onAccountNameChange(event.target.value)} placeholder={t("catalog.accountPlaceholder", { name: integration?.name ?? t("account.integrationFallback") })} className="w-full rounded-lg border border-stroke-soft-200 px-3 py-2 text-[13px] outline-none focus:border-blue-500" />
                  </label>
                  {integration?.auth.fields.map((field) => (
                    <label key={field.key} className="mt-3 block">
                      <span className="mb-1 block text-[12px] font-medium text-text-strong-950">{registry.fieldLabel(integration, field)}{field.required && <span className="text-red-500"> *</span>}</span>
                      <input type={field.inputType} autoComplete="off" value={credentialValues[field.key] ?? ""} onChange={(event) => onCredentialChange(field.key, event.target.value)} placeholder={registry.fieldPlaceholder(integration, field)} className="w-full rounded-lg border border-stroke-soft-200 px-3 py-2 text-[13px] outline-none focus:border-blue-500" />
                    </label>
                  ))}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-text-sub-600">{t("catalog.credentialsEncrypted")}</p>
                    {integration?.auth.helpUrl && <a href={integration.auth.helpUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">{t("catalog.findApiKey")} <RiExternalLinkLine className="inline size-3" /></a>}
                  </div>
                  {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-400">{error}</p>}
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" disabled={busy} onClick={() => onAddingAccountChange(false)} className="rounded-lg px-3 py-2 text-[12px] font-medium text-text-sub-600 hover:bg-bg-weak-50 disabled:opacity-50">{t("account.cancel")}</button>
                    <button type="button" disabled={busy || integration?.auth.fields.some((field) => field.required && !credentialValues[field.key]?.trim())} onClick={() => void onAddAccount()} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">{busy && <RiLoader4Line className="size-3.5 animate-spin" />}{busy ? t("account.verifying") : t("account.verifyConnect")}</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {filteredActions.map((candidate) => (
            <div key={candidate.key} className={`flex items-start border-b border-stroke-soft-200 ${connected ? "hover:bg-bg-weak-50" : "bg-bg-weak-50/50 text-text-soft-400"}`}>
              <button type="button" disabled={!connected || connectionsLoading} aria-disabled={!connected || connectionsLoading} onClick={() => chooseAction(candidate.key)} className="flex min-w-0 flex-1 items-start gap-3 px-6 py-4 text-left disabled:cursor-not-allowed">
                {integration && <span className={connected ? "" : "grayscale opacity-50"}><IntegrationIcon integration={integration} size={28} /></span>}
                <span>
                  <span className={`block text-[14px] font-semibold ${connected ? "text-text-strong-950" : "text-text-sub-600"}`}>{registry.actionName(integrationKey, candidate)}</span>
                  <span className={`mt-1 block text-[13px] ${connected ? "text-text-sub-600" : "text-text-soft-400"}`}>{registry.actionDescription(integrationKey, candidate)}</span>
                  <span className={`mt-1.5 block text-[12px] ${connected ? "text-text-sub-600" : "text-text-soft-400"}`}><RiFlashlightLine className="mr-1 inline size-3.5" />{t("catalog.enrichmentLine", { name: integration?.name ?? "" })}</span>
                </span>
              </button>
              <a href={candidate.docsUrl} target="_blank" rel="noreferrer" aria-label={t("catalog.openDocsAria", { name: registry.actionName(integrationKey, candidate) })} title={t("action.viewDocs")} className="m-4 rounded-md p-2 text-text-soft-400 hover:bg-bg-white-0 hover:text-blue-600 dark:hover:text-blue-400"><RiExternalLinkLine className="size-4" /></a>
            </div>
          ))}
        </main>
      </div>
    </>
  );
}

function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const t = useTranslations("gridEnrich.enrichment");
  return <div className="flex items-center justify-between"><span><span className="font-medium text-text-strong-950">{label}</span>{disabled && <span className="ml-2 text-[11px] text-text-soft-400">{t("run.comingLater")}</span>}</span><button type="button" disabled={disabled} aria-pressed={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-blue-600" : "bg-bg-sub-300"} disabled:opacity-50`}><span className={`absolute top-1 size-4 rounded-full bg-static-white transition ${checked ? "left-6" : "left-1"}`} /></button></div>;
}
