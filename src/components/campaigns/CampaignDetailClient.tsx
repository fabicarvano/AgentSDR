"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Messages } from "@/i18n/catalog";
import type { QualificationDebugTrace } from "@/lib/qualification";

interface CampaignInfo {
  id: string;
  name: string;
  status: string;
  targetMode: string;
  targetLeadCount: number;
  targetDomainCount: number | null;
  accumulatedLeadCount: number;
  apolloLink: string | null;
  inputMode: string;
}

interface DomainRow {
  id: string | null;
  domain: string;
  status: string;
  isParentCompany: boolean;
  checkedAt: string | null;
  allLeadCount: number | null;
  verifiedEmployeeCount: number | null;
  revenue: string | null;
  parentId: string | null;
  parentPending: boolean;
  parentDomain: string | null;
  parentPreviouslyAdded: boolean;
  parentCampaignId: string | null;
  reason: string | null;
  qualificationDebug: QualificationDebugTrace | null;
}

interface ActiveJobInfo {
  id: string;
  status: string;
  currentDomain: string | null;
}

interface LiveStats {
  accumulated: number;
  qualified: number;
  processed: number;
  campaignStatus: string;
  jobStatus?: string | null;
  currentDomain?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  qualified: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  apollo_no_data: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  apollo_has_data: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
  not_live: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  no_ads: "bg-bg-weak-50 text-text-strong-950/60",
  pending: "bg-bg-weak-50 text-text-strong-950/50",
};

type DomainStatusKey = keyof Messages["emailCampaigns"]["legacyDetail"]["domainStatus"];
type CampaignStatusKey = keyof Messages["emailCampaigns"]["legacyStatus"];

// Raw domain status (snake_case, stored in the database) -> catalog key. Unknown values fall back to the raw text.
const DOMAIN_STATUS_KEY: Record<string, DomainStatusKey> = {
  qualified: "qualified",
  apollo_no_data: "apolloNoData",
  apollo_has_data: "apolloHasData",
  not_live: "notLive",
  no_ads: "noAds",
  pending: "pending",
};
// Fails to compile when a key is added to the catalog without a mapping above.
const _domainStatusCovered: Record<DomainStatusKey, true> = {
  qualified: true, apolloNoData: true, apolloHasData: true, notLive: true, noAds: true, pending: true,
};
void _domainStatusCovered;

const CAMPAIGN_STATUS_KEYS: Record<CampaignStatusKey, true> = { building: true, ready: true, paused: true, done: true };

function StatusBadge({ status }: { status: string }) {
  const tDomain = useTranslations("emailCampaigns.legacyDetail.domainStatus");
  const key = DOMAIN_STATUS_KEY[status];
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide ${
        STATUS_TONE[status] ?? "bg-bg-weak-50 text-text-strong-950/60"
      }`}
    >
      {key ? tDomain(key) : status.replace(/_/g, " ")}
    </span>
  );
}

function sortDomainRows(rows: DomainRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
    const bTime = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
    return bTime - aTime;
  });
}

type Formatter = ReturnType<typeof useFormatter>;

function formatRevenue(value: string | null, format: Formatter) {
  if (value === null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${format.number(Math.round(n))}`;
}

function formatTimestamp(value: string | null, format: Formatter) {
  if (!value) return "—";
  return format.dateTime(new Date(value), {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ParentCell({ domain, campaignId }: { domain: DomainRow; campaignId: string }) {
  const t = useTranslations("emailCampaigns.legacyDetail");
  if (domain.parentDomain) {
    const previouslyAdded =
      domain.parentPreviouslyAdded ||
      Boolean(domain.parentCampaignId && domain.parentCampaignId !== campaignId);

    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-text-strong-950/70">{domain.parentDomain}</span>
        {previouslyAdded && domain.parentCampaignId ? (
          <Link
            href={`/campaigns/${domain.parentCampaignId}`}
            onClick={(event) => event.stopPropagation()}
            className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {t("previouslyAdded")}
          </Link>
        ) : previouslyAdded ? (
          <span className="text-[10px] text-text-strong-950/40">{t("previouslyAdded")}</span>
        ) : null}
      </span>
    );
  }
  if (domain.parentPending) {
    return <span className="text-amber-700 dark:text-amber-400">{t("needsResearch")}</span>;
  }
  return <span className="text-text-strong-950/35">{t("noParent")}</span>;
}

function Stat({ label, value, pulse }: { label: string; value: string; pulse?: boolean }) {
  return (
    <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl px-4 py-3">
      <p className="text-[10px] text-text-strong-950/40 uppercase tracking-widest">{label}</p>
      <p className={`text-lg font-bold text-text-strong-950 mt-0.5 font-mono ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-100">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function DebugSidePanel({
  domain,
  onClose,
}: {
  domain: DomainRow;
  onClose: () => void;
}) {
  const t = useTranslations("emailCampaigns.legacyDetail");
  const debug = domain.qualificationDebug;
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-stroke-soft-200 bg-bg-white-0 shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-text-strong-950 truncate">{domain.domain}</p>
            <p className="mt-1 text-xs text-text-strong-950/45">{domain.reason ?? t("noReason")}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg border border-stroke-soft-200 text-text-strong-950/50 hover:bg-bg-weak-50"
            aria-label={t("closePanel")}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!debug ? (
            <p className="text-sm text-text-strong-950/45">{t("noTrace")}</p>
          ) : (
            <div className="flex flex-col gap-5">
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-strong-950/45">
                  {t("aiParentLookup")}
                </h2>
                <JsonBlock value={debug.parentLookup ?? null} />
              </section>

              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-strong-950/45">
                  {t("apolloChildLookup")}
                </h2>
                <JsonBlock value={debug.apollo?.child ?? null} />
              </section>

              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-strong-950/45">
                  {t("apolloParentLookup")}
                </h2>
                <JsonBlock value={debug.apollo?.parent ?? null} />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailClient({
  campaign,
  activeJob,
  domains: initialDomains,
}: {
  campaign: CampaignInfo;
  activeJob: ActiveJobInfo | null;
  domains: DomainRow[];
}) {
  const t = useTranslations("emailCampaigns.legacyDetail");
  const tStatus = useTranslations("emailCampaigns.legacyStatus");
  const format = useFormatter();
  const [running, setRunning] = useState(Boolean(activeJob));
  const [stopping, setStopping] = useState(false);
  const [limit, setLimit] = useState("200");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live state — updated by SSE events while the job runs.
  const [domains, setDomains] = useState<DomainRow[]>(() => sortDomainRows(initialDomains));
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [apolloLink, setApolloLink] = useState<string | null>(campaign.apolloLink);
  const [currentDomain, setCurrentDomain] = useState<string | null>(activeJob?.currentDomain ?? null);
  const [selectedDomain, setSelectedDomain] = useState<DomainRow | null>(null);

  const esRef = useRef<EventSource | null>(null);

  // Derived display values: prefer live stats when running, fall back to props.
  const displayAccumulated = liveStats?.accumulated ?? campaign.accumulatedLeadCount;
  const displayStatus = liveStats?.campaignStatus ?? campaign.status;
  const displayQualified = liveStats?.qualified ?? domains.filter((d) => d.status === "qualified").length;
  const displayProcessed = liveStats?.processed ?? domains.length;
  // "domains" mode target is a fixed batch size (top N candidates to analyze),
  // not a qualified-count goal — so its progress is processed-so-far / N,
  // excluding incidentally-discovered parent companies from the candidate count.
  const displayTargetedDomainsProcessed = domains.filter((d) => !d.isParentCompany).length;

  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/export`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "campaign.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  const pendingParents = domains.filter((d) => d.parentPending && !d.parentDomain);

  const openStream = useCallback(() => {
    esRef.current?.close();
    setError(null);
    setNotice(null);
    setRunning(true);

    const es = new EventSource(`/api/campaigns/${campaign.id}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as {
          type: string;
          data: unknown;
        };

        if (event.type === "domain") {
          const row = event.data as DomainRow;
          setDomains((prev) => {
            const idx = prev.findIndex((d) => d.domain === row.domain);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return sortDomainRows(next);
            }
            return sortDomainRows([row, ...prev]);
          });
        } else if (event.type === "stats") {
          const stats = event.data as LiveStats;
          setLiveStats(stats);
          setCurrentDomain(stats.currentDomain ?? null);
        } else if (event.type === "all_domains") {
          // Final snapshot including parent rows — replace the full list.
          setDomains(sortDomainRows(event.data as DomainRow[]));
        } else if (event.type === "done") {
          const { apolloLink: link, stopped, failed } = event.data as {
            apolloLink: string | null;
            stopped?: boolean;
            failed?: boolean;
          };
          if (link) setApolloLink(link);
          if (stopped) setNotice(t("jobStopped"));
          if (failed) setError(t("jobFailed"));
          setRunning(false);
          setStopping(false);
          setCurrentDomain(null);
          es.close();
          esRef.current = null;
        } else if (event.type === "error") {
          const { message } = event.data as { message: string };
          setError(message);
          setRunning(false);
          setStopping(false);
          setCurrentDomain(null);
          es.close();
          esRef.current = null;
        }
      } catch {
        // Malformed event — ignore.
      }
    };

    es.onerror = () => {
      setError(t("connectionLost"));
      setRunning(false);
      setStopping(false);
      setCurrentDomain(null);
      es.close();
      esRef.current = null;
    };
    // t is deliberately left out: a changed identity would reopen the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  useEffect(() => {
    if (!activeJob || esRef.current) return;
    openStream();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [activeJob, openStream]);

  async function startStream() {
    setError(null);
    setNotice(null);
    setRunning(true);
    setStopping(false);
    setCurrentDomain(null);

    const res = await fetch(`/api/campaigns/${campaign.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: Number(limit) || 100 }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? t("startFailed"));
      setRunning(false);
      return;
    }

    openStream();
  }

  async function stopStream() {
    if (!running || stopping) return;
    setStopping(true);
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/campaigns/${campaign.id}/stop`, { method: "POST" });
    if (!res.ok) {
      setStopping(false);
      setError(t("stopFailed"));
    }
  }

  async function setParent(childDomain: string, parentDomain: string) {
    if (!parentDomain.trim()) return;
    const res = await fetch(
      `/api/targeted-domains/${encodeURIComponent(childDomain)}/parent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentDomain: parentDomain.trim() }),
      },
    );
    if (res.ok) {
      setDomains((prev) =>
        prev.map((d) =>
          d.domain === childDomain
            ? { ...d, parentDomain: parentDomain.trim(), parentPending: false }
            : d,
        ),
      );
    }
  }

  function copyLink() {
    if (!apolloLink) return;
    navigator.clipboard.writeText(apolloLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label={t("statStatus")} value={displayStatus in CAMPAIGN_STATUS_KEYS ? tStatus(displayStatus as CampaignStatusKey) : displayStatus} pulse={running} />
        {campaign.targetMode === "domains" ? (
          <Stat
            label={t("statDomains")}
            value={`${format.number(displayTargetedDomainsProcessed)} / ${format.number(campaign.targetDomainCount ?? 0)}`}
            pulse={running}
          />
        ) : (
          <Stat
            label={t("statLeads")}
            value={`${format.number(displayAccumulated)} / ${format.number(campaign.targetLeadCount)}`}
            pulse={running}
          />
        )}
        <Stat label={t("statQualified")} value={String(displayQualified)} pulse={running} />
        <Stat label={t("statProcessed")} value={String(displayProcessed)} pulse={running} />
      </div>

      {/* Run controls */}
      <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        {campaign.targetMode === "domains" ? (
          <span className="text-sm text-text-strong-950/60">
            {t("analyzesTop", { count: campaign.targetDomainCount ?? 0 })}
          </span>
        ) : (
          <>
            <span className="text-sm text-text-strong-950/60">{t("processUpTo")}</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              disabled={running}
              className="w-24 h-9 border border-stroke-soft-200 rounded-lg px-3 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            />
            <span className="text-sm text-text-strong-950/60">{t("candidates")}</span>
          </>
        )}

        {running && currentDomain && (
          <span className="text-xs text-text-strong-950/40 font-mono truncate max-w-xs">
            ↳ {currentDomain}
          </span>
        )}

        <button
          onClick={exportCsv}
          disabled={exporting || domains.length === 0}
          className="ml-auto h-9 px-4 border border-stroke-soft-200 text-text-strong-950/70 text-sm font-semibold rounded-lg hover:bg-bg-weak-50 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? t("exporting") : t("exportCsv")}
        </button>

        <button
          onClick={startStream}
          disabled={running}
          className="h-9 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {running && (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {running ? t("running") : t("run")}
        </button>
        {running && (
          <button
            onClick={stopStream}
            disabled={stopping}
            className="h-9 px-4 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 text-sm font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors disabled:opacity-60"
          >
            {stopping ? t("stopping") : t("stop")}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p className="text-xs text-text-strong-950/50">{notice}</p>}

      {/* Apollo link */}
      {apolloLink && (
        <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl px-4 py-3">
          <p className="text-[10px] text-text-strong-950/40 uppercase tracking-widest mb-1.5">
            {t("apolloLink")}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={apolloLink}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate flex-1"
            >
              {apolloLink}
            </a>
            <button
              onClick={copyLink}
              className="shrink-0 h-8 px-3 text-xs font-medium text-text-strong-950/70 border border-stroke-soft-200 rounded-lg hover:bg-bg-weak-50"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      )}

      {/* Parent research queue */}
      {pendingParents.length > 0 && (
        <div className="bg-amber-50/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2">
            {t("parentResearchNeeded", { count: pendingParents.length })}
          </p>
          <div className="flex flex-col gap-2">
            {pendingParents.map((d) => (
              <ParentResearchRow key={d.domain} domain={d.domain} onSubmit={setParent} />
            ))}
          </div>
        </div>
      )}

      {/* Domains table */}
      <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-weak-50 text-left text-[10px] text-text-strong-950/50 uppercase tracking-widest">
              <th className="px-4 py-2.5 font-semibold">{t("colDomain")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colTimestamp")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colStatus")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colParentCompany")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colRevenue")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colAllLeads")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colVerified")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colParent")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("colReason")}</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 && !running ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-strong-950/40">
                  {t("emptyDomains")}
                </td>
              </tr>
            ) : domains.length === 0 && running ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-text-strong-950/40 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-stroke-sub-300 border-t-indigo-400 rounded-full animate-spin" />
                    {t("processing")}
                  </div>
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr
                  key={d.domain}
                  onClick={() => setSelectedDomain(d)}
                  className={`border-t border-stroke-soft-200 transition-colors ${
                    currentDomain === d.domain ? "bg-indigo-50/40 dark:bg-indigo-500/10" : ""
                  } cursor-pointer hover:bg-bg-weak-50`}
                >
                  <td className="px-4 py-2.5 text-text-strong-950 font-medium font-mono text-xs">
                    {d.domain}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-strong-950/50">
                    {formatTimestamp(d.checkedAt, format)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-strong-950/60">
                    {d.isParentCompany ? t("yes") : t("no")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-strong-950/70">
                    {formatRevenue(d.revenue, format)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-strong-950/70">
                    {d.allLeadCount ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-strong-950/70">
                    {d.verifiedEmployeeCount ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <ParentCell domain={d} campaignId={campaign.id} />
                  </td>
                  <td className="px-4 py-2.5 text-text-strong-950/50 text-xs">{d.reason ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedDomain && (
        <DebugSidePanel domain={selectedDomain} onClose={() => setSelectedDomain(null)} />
      )}
    </div>
  );
}

function ParentResearchRow({
  domain,
  onSubmit,
}: {
  domain: string;
  onSubmit: (child: string, parent: string) => void;
}) {
  const t = useTranslations("emailCampaigns.legacyDetail");
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-strong-950/70 w-48 truncate">{domain}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // Example domain, not interface text.
        // eslint-disable-next-line i18next/no-literal-string
        placeholder="parent-domain.com"
        className="flex-1 h-9 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 text-sm text-text-strong-950 bg-bg-white-0 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <button
        onClick={() => onSubmit(domain, value)}
        className="h-9 px-3 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
      >
        {t("setParent")}
      </button>
    </div>
  );
}
