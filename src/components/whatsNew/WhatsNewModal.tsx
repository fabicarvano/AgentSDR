"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { RiBugLine, RiSparklingLine, RiArrowUpCircleLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Modal from "@/components/alignui/modal";
import { isChromeless } from "@/components/AppShell";
import { useSession } from "@/lib/auth/client";
import { shouldOpenPopup, shouldPersistDismissal, shownFlagKey } from "@/lib/releases/popup";
import type { LocalizedRelease, ReleaseItemType } from "@/lib/releases/types";
import { cn } from "@/utils/cn";

type CurrentRelease = LocalizedRelease & { dismissed: boolean };

// Colour AND text (the badge label) tell the types apart. Types are stable values; the label comes from a key.
const TYPE_STYLE: Record<ReleaseItemType, { icon: React.ElementType; badge: string }> = {
  new: { icon: RiSparklingLine, badge: "bg-success-lighter text-success-dark" },
  improvement: { icon: RiArrowUpCircleLine, badge: "bg-information-lighter text-information-dark" },
  fix: { icon: RiBugLine, badge: "bg-warning-lighter text-warning-dark" },
};

/** sessionStorage can throw (private window, blocked site data): the pop-up then simply may show again. */
function readShown(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeShown(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

/**
 * "What's new in this version": opens once per sign-in session after the first
 * page of the signed-in app loads, unless the person ticked "Don't show this
 * again" for this version (stored in the database, not in the browser).
 * Mounted in the root layout, so it survives navigation.
 */
export function WhatsNewModal() {
  const pathname = usePathname();
  const chromeless = isChromeless(pathname);
  const { data: session } = useSession();
  const sessionId = session?.session.id ?? null;
  const [release, setRelease] = useState<CurrentRelease | null>(null);
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const gotItRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("whatsNew");
  const format = useFormatter();

  useEffect(() => {
    if (chromeless || !sessionId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/releases/current", { signal: controller.signal });
        if (!res.ok) return; // 401 (no session) and 404 (no notes): stay silent
        const data = (await res.json()) as CurrentRelease;
        const key = shownFlagKey(sessionId, data.version);
        if (!shouldOpenPopup({ dismissed: data.dismissed, shownThisSession: readShown(key) })) return;
        writeShown(key);
        setRelease(data);
        setDontShow(false);
        setOpen(true);
      } catch {
        /* network error or aborted: nothing to show */
      }
    })();
    return () => controller.abort();
  }, [chromeless, sessionId]);

  function close() {
    setOpen(false);
    if (!release || !shouldPersistDismissal({ checkboxChecked: dontShow })) return;
    // A failed save must not break the UI: the pop-up just shows again in the next sign-in.
    fetch("/api/releases/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: release.version }),
    })
      .then((res) => {
        if (!res.ok) console.warn(`Could not save the dismissal of the release notes (HTTP ${res.status})`);
      })
      .catch((error) => console.warn("Could not save the dismissal of the release notes", error));
  }

  if (!release) return null;

  return (
    <Modal.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Modal.Content
        size="max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          gotItRef.current?.focus();
        }}
      >
        <Modal.Header>
          <Modal.Title>{t("modal.title", { version: release.version })}</Modal.Title>
          <Modal.Description>
            {t("modal.description", { date: format.dateTime(new Date(`${release.date}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" }) })}
          </Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <h3 className="mb-4 text-label-md text-text-strong-950">{release.title}</h3>
          <ul className="space-y-3">
            {release.items.map((item) => {
              const style = TYPE_STYLE[item.type];
              const Icon = style.icon;
              return (
                <li key={`${item.type}:${item.text}`} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-label-xs", style.badge)}>
                    <Icon className="size-3.5" aria-hidden="true" />
                    {t(`types.${item.type}`)}
                  </span>
                  <span className="min-w-0 flex-1 text-paragraph-sm text-text-sub-600">{item.text}</span>
                </li>
              );
            })}
          </ul>
        </Modal.Body>
        <Modal.Footer className="justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-paragraph-sm text-text-sub-600">
            <Checkbox.Root checked={dontShow} onCheckedChange={(checked) => setDontShow(checked === true)} />
            {t("modal.dontShowAgain")}
          </label>
          <Button.Root ref={gotItRef} variant="primary" size="small" onClick={close}>
            {t("modal.gotIt")}
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
