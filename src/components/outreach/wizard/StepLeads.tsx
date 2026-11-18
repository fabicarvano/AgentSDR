"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiDatabase2Line,
  RiFileExcel2Line,
  RiInformationLine,
  RiLoader4Line,
  RiUploadCloud2Line,
} from "@remixicon/react";

import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";

type ImportResult = {
  total: number;
  imported: number;
  skippedSuppressed: number;
  skippedDuplicate: number;
  failed: { row: number; email: string; error: string }[];
};

export default function StepLeads({
  campaignId,
  onBack,
  onContinue,
}: {
  campaignId: string;
  onBack: () => void;
  onContinue: (leadCount: number) => void;
}) {
  const t = useTranslations("emailWizard.stepLeads");
  const format = useFormatter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [leadCount, setLeadCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const fetchLeadCount = useCallback(async () => {
    const response = await fetch(`/api/outreach/campaigns/${campaignId}/leads?page=1&pageSize=1`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? t("refreshFailed"));
    return Number(data.total ?? 0);
  }, [campaignId, t]);

  const refreshLeadCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      setLeadCount(await fetchLeadCount());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("refreshFailed"));
    } finally {
      setLoadingCount(false);
    }
  }, [fetchLeadCount, t]);

  useEffect(() => {
    let cancelled = false;
    fetchLeadCount()
      .then((count) => {
        if (!cancelled) setLeadCount(count);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t("refreshFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCount(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLeadCount, t]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setResult(null);
    setPendingFile(file);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title-h5 text-text-strong-950">{t("title")}</h2>
          <p className="mt-1 text-paragraph-sm text-text-sub-600">
            {t("subtitle")}
          </p>
        </div>
        <Badge.Root variant="lighter" color={leadCount > 0 ? "green" : "gray"}>
          {loadingCount ? <RiLoader4Line className="size-3.5 animate-spin" /> : <Badge.Dot />}
          {t("enrolled", { count: format.number(leadCount) })}
        </Badge.Root>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setShowPeople(true)}
          className="group flex min-h-48 flex-col items-start rounded-2xl bg-bg-white-0 p-5 text-left shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition hover:-translate-y-0.5 hover:shadow-regular-sm hover:ring-primary-base"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-alpha-10 text-primary-base">
            <RiDatabase2Line className="size-5" />
          </span>
          <span className="mt-5 text-label-md text-text-strong-950">{t("fromPeopleTitle")}</span>
          <span className="mt-1 text-paragraph-sm text-text-sub-600">
            {t("fromPeopleBody")}
          </span>
          <span className="mt-auto pt-4 text-label-sm text-primary-base">{t("browsePeople")}</span>
        </button>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`group flex min-h-48 cursor-pointer flex-col items-start rounded-2xl border border-dashed p-5 text-left transition ${
            dragOver
              ? "border-primary-base bg-primary-alpha-10"
              : "border-stroke-soft-200 bg-bg-white-0 hover:-translate-y-0.5 hover:border-primary-base hover:shadow-regular-sm"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <span className="flex size-10 items-center justify-center rounded-xl bg-feature-lighter text-feature-base">
            {fileName ? <RiFileExcel2Line className="size-5" /> : <RiUploadCloud2Line className="size-5" />}
          </span>
          <span className="mt-5 text-label-md text-text-strong-950">
            {fileName ?? t("uploadTitle")}
          </span>
          <span className="mt-1 text-paragraph-sm text-text-sub-600">
            {t("uploadBody")}
          </span>
          <span className="mt-auto pt-4 text-label-sm text-primary-base">{t("chooseSpreadsheet")}</span>
        </label>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-information-lighter px-4 py-3 text-paragraph-xs text-information-dark">
        <RiInformationLine className="mt-0.5 size-4 shrink-0" />
        {t("emailRequiredNote")}
      </div>

      {error && <p className="mt-3 rounded-xl bg-error-lighter px-4 py-3 text-paragraph-sm text-error-base">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl bg-bg-weak-50 px-4 py-3 text-paragraph-sm ring-1 ring-inset ring-stroke-soft-200">
          <p className="text-text-strong-950">
            <span className="font-semibold">{t("resultRows", { count: result.total })}</span> —{" "}
            <span className="font-medium text-success-base">{t("resultImported", { count: result.imported })}</span>
            {result.skippedDuplicate > 0 && `, ${t("resultDuplicate", { count: result.skippedDuplicate })}`}
            {result.skippedSuppressed > 0 && (
              <>
                , <span className="font-medium text-away-base">{t("resultSuppressed", { count: result.skippedSuppressed })}</span>
              </>
            )}
            {result.failed.length > 0 && (
              <>
                , <span className="font-medium text-error-base">{t("resultFailed", { count: result.failed.length })}</span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t border-stroke-soft-200 pt-5">
        <Button.Root variant="neutral" mode="ghost" size="medium" onClick={onBack}>
          <Button.Icon as={RiArrowLeftLine} />{t("back")}
        </Button.Root>
        <Button.Root onClick={() => onContinue(leadCount)} disabled={loadingCount}>
          {t("continue")}<Button.Icon as={RiArrowRightLine} />
        </Button.Root>
      </div>
      {showPeople && (
        <AddPeopleToCampaignModal
          campaignId={campaignId}
          channel="email"
          onClose={() => setShowPeople(false)}
          onAdded={(summary) => {
            setResult({ total: summary.requested, imported: summary.added, skippedSuppressed: summary.skippedSuppressed, skippedDuplicate: summary.skippedDuplicate, failed: [] });
            void refreshLeadCount();
          }}
        />
      )}
      {pendingFile && (
        <CampaignCsvMappingDialog
          file={pendingFile}
          endpoint={`/api/outreach/campaigns/${campaignId}/leads/import`}
          channel="email"
          onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
          onImported={(data) => {
            setResult(data as unknown as ImportResult);
            setPendingFile(null);
            if (fileRef.current) fileRef.current.value = "";
            void refreshLeadCount();
          }}
        />
      )}
    </div>
  );
}
