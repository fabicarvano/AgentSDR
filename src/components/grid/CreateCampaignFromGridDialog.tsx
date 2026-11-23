"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { RiCloseLine, RiLoader4Line, RiMegaphoneLine } from "@remixicon/react";
import * as Select from "@/components/alignui/select";
import type { Messages } from "@/i18n/catalog";
import type { GridColumn } from "@/lib/grid/schema";
import type { GridCampaignChannel, GridCampaignMapping } from "@/lib/leads/gridCampaigns";

// labelKey is a typed key under gridEnrich.campaign.fields, rendered with t(`fields.${labelKey}`).
// The Record fails tsc when a GridCampaignMapping field has no text.
type FieldLabelKey = keyof Messages["gridEnrich"]["campaign"]["fields"];
const _fieldsCovered: Record<keyof GridCampaignMapping, string> = {} as Messages["gridEnrich"]["campaign"]["fields"];
void _fieldsCovered;

const PERSON_FIELDS: { key: keyof GridCampaignMapping; labelKey: FieldLabelKey }[] = [
  { key: "email", labelKey: "email" },
  { key: "linkedinUrl", labelKey: "linkedinUrl" },
  { key: "firstName", labelKey: "firstName" },
  { key: "lastName", labelKey: "lastName" },
  { key: "fullName", labelKey: "fullName" },
  { key: "title", labelKey: "title" },
  { key: "companyName", labelKey: "companyName" },
  { key: "companyDomain", labelKey: "companyDomain" },
];

const LINKEDIN_FIELDS: { key: keyof GridCampaignMapping; labelKey: FieldLabelKey }[] = [
  { key: "invitationMessage", labelKey: "invitationMessage" },
  { key: "acceptanceMessage", labelKey: "acceptanceMessage" },
  { key: "followUp1Message", labelKey: "followUp1Message" },
  { key: "followUp2Message", labelKey: "followUp2Message" },
  { key: "followUp3Message", labelKey: "followUp3Message" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestedMapping(columns: GridColumn[]): GridCampaignMapping {
  const aliases: Record<string, string[]> = {
    email: ["email", "emailaddress", "workemail"],
    linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile", "profileurl"],
    firstName: ["firstname", "first"],
    lastName: ["lastname", "last"],
    fullName: ["fullname", "name"],
    title: ["title", "jobtitle", "headline"],
    companyName: ["company", "companyname"],
    companyDomain: ["domain", "companydomain", "website"],
    invitationMessage: ["invitationmessage", "invitation"],
    acceptanceMessage: ["acceptancemessage", "acceptance"],
    followUp1Message: ["followup1", "followup1message"],
    followUp2Message: ["followup2", "followup2message"],
    followUp3Message: ["followup3", "followup3message"],
  };
  return Object.fromEntries(Object.entries(aliases).flatMap(([field, names]) => {
    const column = columns.find((candidate) => names.includes(normalize(candidate.name)));
    return column ? [[field, column.key]] : [];
  })) as GridCampaignMapping;
}

export default function CreateCampaignFromGridDialog({
  open,
  tableId,
  columns,
  rowIds,
  onClose,
  onCreated,
}: {
  open: boolean;
  tableId: string;
  columns: GridColumn[];
  rowIds: string[];
  onClose: () => void;
  onCreated: (result: { campaignId: string; channel: GridCampaignChannel; created: number; failed: number }) => void;
}) {
  const t = useTranslations("gridEnrich.campaign");
  const [channel, setChannel] = useState<GridCampaignChannel>("email");
  const [name, setName] = useState("");
  const [mapping, setMapping] = useState<GridCampaignMapping>(() => suggestedMapping(columns));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(
    () => channel === "linkedin" ? [...PERSON_FIELDS, ...LINKEDIN_FIELDS] : PERSON_FIELDS,
    [channel],
  );
  const requiredField = channel === "email" ? "email" : "linkedinUrl";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/grid/tables/${tableId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, name, rowIds, mapping }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t("errors.create"));
      onCreated(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.create"));
    } finally {
      setBusy(false);
    }
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-bg-white-0 shadow-xl ring-1 ring-stroke-soft-200">
        <div className="flex items-start justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-text-strong-950">{t("title")}</h2>
            <p className="text-[13px] text-text-sub-600">{t("subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md p-1 text-text-soft-400 hover:bg-bg-weak-50"><RiCloseLine className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[13px] font-medium text-text-strong-950">{t("channel")}
              <Select.Root size="small" value={channel} onValueChange={(next) => setChannel(next as GridCampaignChannel)}>
                <Select.Trigger aria-label={t("channel")} className="mt-1.5 w-full font-normal">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="email">{t("channelEmail")}</Select.Item>
                  <Select.Item value="linkedin">{t("channelLinkedin")}</Select.Item>
                </Select.Content>
              </Select.Root>
            </label>
            <label className="text-[13px] font-medium text-text-strong-950">{t("name")}
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("namePlaceholder")} className="mt-1.5 w-full rounded-lg border border-stroke-soft-200 px-3 py-2 font-normal outline-none focus:border-blue-500" />
            </label>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-stroke-soft-200">
            <div className="grid grid-cols-2 bg-bg-weak-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-sub-600"><span>{t("campaignField")}</span><span>{t("gridColumn")}</span></div>
            {fields.map((field) => (
              <div key={field.key} className="grid grid-cols-2 items-center gap-3 border-t border-stroke-soft-200 px-3 py-2">
                <span className="text-[13px] text-text-strong-950">{t(`fields.${field.labelKey}`)}{field.key === requiredField ? <span className="ml-1 text-red-500">*</span> : null}</span>
                <Select.Root size="small" value={mapping[field.key] ?? ""} onValueChange={(next) => setMapping((current) => ({ ...current, [field.key]: next || undefined }))}>
                  <Select.Trigger aria-label={t("columnAria", { field: t(`fields.${field.labelKey}`) })}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="">{t("doNotMap")}</Select.Item>
                    {columns.map((column) => <Select.Item key={column.key} value={column.key}>{column.name}</Select.Item>)}
                  </Select.Content>
                </Select.Root>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-3 py-2 text-[12px] text-blue-800 dark:text-blue-400">{t("note", { count: rowIds.length })}</p>
          {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-stroke-soft-200 px-5 py-4">
          <span className="text-[13px] text-text-sub-600">{t("selected", { count: rowIds.length })}</span>
          <div className="flex gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-stroke-soft-200 px-3 py-2 text-[13px] font-medium text-text-strong-950">{t("cancel")}</button><button type="button" onClick={() => void create()} disabled={busy || !name.trim() || !mapping[requiredField]} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50">{busy ? <RiLoader4Line className="size-4 animate-spin" /> : <RiMegaphoneLine className="size-4" />}{t("create")}</button></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
