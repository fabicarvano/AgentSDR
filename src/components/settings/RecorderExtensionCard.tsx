"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { RiChromeLine, RiDownload2Line, RiRefreshLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { DocsLink } from "@/components/page/DocsLink";
import { isRecorderInstalled, recorderVersion, sendToRecorder } from "@/lib/calls/client";
import { RECORDER_INSTALLED_ATTRIBUTE } from "@/lib/calls/contract";
import {
  isOlderVersion,
  LATEST_RECORDER_VERSION,
  RECORDER_DOWNLOAD_PATH,
  RECORDER_SELF_UPDATE_VERSION,
} from "@/lib/calls/recorderRelease";
import { errorMessage } from "@/components/crm/crm-utils";

type Installed = { state: "checking" } | { state: "missing" } | { state: "installed"; version: string | null };

/** The extension marks the page, and marks it again with its new version after an update. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [RECORDER_INSTALLED_ATTRIBUTE] });
  return () => observer.disconnect();
}
/** The installed version ("" when unreadable), null when missing; undefined on the server. */
const readVersion = () => (isRecorderInstalled() ? (recorderVersion() ?? "") : null);
const readOnServer = () => undefined;

/**
 * The Call Recorder extension: which version this browser runs against the
 * one this deployment serves, the download, and how to install or update it.
 * It is loaded unpacked, so Chrome never updates it on its own.
 */
export function RecorderExtensionCard() {
  const t = useTranslations("settingsChannels.recorderExtension");
  const code = (chunks: React.ReactNode) => <Code>{chunks}</Code>;
  const version = useSyncExternalStore(subscribe, readVersion, readOnServer);
  const installed: Installed =
    version === undefined ? { state: "checking" } : version === null ? { state: "missing" } : { state: "installed", version: version || null };

  const outdated =
    installed.state === "installed" && (!installed.version || isOlderVersion(installed.version, LATEST_RECORDER_VERSION));
  // 0.14.0 and later install an update themselves; older copies are replaced by hand once.
  const canSelfUpdate =
    installed.state === "installed" && Boolean(installed.version) && !isOlderVersion(installed.version!, RECORDER_SELF_UPDATE_VERSION);
  const [updateError, setUpdateError] = useState("");

  const openUpdater = async () => {
    setUpdateError("");
    try {
      const reply = await sendToRecorder({ type: "recorder:update" });
      if (reply.type === "recorder:update-rejected") setUpdateError(reply.error);
    } catch (cause) {
      setUpdateError(errorMessage(cause));
    }
  };

  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-stroke-soft-200">
              <RiChromeLine className="size-5 text-text-sub-600" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-label-md text-text-strong-950">{t("title")}</h3>
                {installed.state === "missing" && (
                  <Badge.Root size="medium" variant="lighter" color="gray">{t("notInstalled")}</Badge.Root>
                )}
                {installed.state === "installed" && outdated && (
                  <Badge.Root size="medium" variant="lighter" color="orange">
                    {installed.version ? t("updateAvailableWithVersion", { version: installed.version }) : t("updateAvailable")}
                  </Badge.Root>
                )}
                {installed.state === "installed" && !outdated && (
                  <Badge.Root size="medium" variant="lighter" color="green">{t("upToDate")}</Badge.Root>
                )}
              </div>
              <p className="mt-1 text-paragraph-sm text-text-sub-600">
                {t("description")}
              </p>
              <p className="mt-1 text-paragraph-xs text-text-soft-400">{t("latestVersion", { version: LATEST_RECORDER_VERSION })}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {outdated ? (
              <DocsLink page="whatsapp/calling#update-the-extension">{t("howToUpdate")}</DocsLink>
            ) : (
              <DocsLink page="whatsapp/calling#install-the-extension">{installed.state === "missing" ? t("howToInstall") : t("setupGuide")}</DocsLink>
            )}
            {outdated && canSelfUpdate ? (
              <Button.Root variant="primary" mode="filled" size="small" onClick={() => void openUpdater()}>
                <Button.Icon as={RiRefreshLine} />
                {t("update")}
              </Button.Root>
            ) : (
              <Button.Root
                asChild
                variant={outdated || installed.state === "missing" ? "primary" : "neutral"}
                mode={outdated || installed.state === "missing" ? "filled" : "stroke"}
                size="small"
              >
                <a href={RECORDER_DOWNLOAD_PATH} download>
                  <Button.Icon as={RiDownload2Line} />
                  {t("download")}
                </a>
              </Button.Root>
            )}
          </div>
        </div>
        {updateError && <p className="text-paragraph-sm text-error-base">{updateError}</p>}

        <div className="grid gap-4 border-t border-stroke-soft-200 pt-4 text-paragraph-sm text-text-sub-600 sm:grid-cols-2">
          <div>
            <p className="text-label-sm text-text-strong-950">{t("firstTime.title")}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>{t("firstTime.step1")}</li>
              <li>{t.rich("firstTime.step2", { code })}</li>
              <li>{t.rich("firstTime.step3", { code })}</li>
            </ol>
          </div>
          <div>
            <p className="text-label-sm text-text-strong-950">{t("toUpdate.title")}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>{t("toUpdate.step1")}</li>
              <li>{t.rich("toUpdate.step2", { code })}</li>
              <li>{t("toUpdate.step3")}</li>
            </ol>
            <p className="mt-2 text-paragraph-xs text-text-soft-400">
              {t.rich("toUpdate.oldVersions", { version: RECORDER_SELF_UPDATE_VERSION, code })}
            </p>
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-bg-weak-50 px-1 py-0.5 text-paragraph-xs text-text-strong-950">{children}</code>;
}
