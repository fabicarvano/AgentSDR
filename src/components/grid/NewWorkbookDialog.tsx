"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RiFileExcel2Line, RiLoader4Line, RiTableLine } from "@remixicon/react";
import * as Modal from "@/components/alignui/modal";
import WorkbookIcon from "./WorkbookIcon";
import ImportDialog from "./ImportDialog";

type CreatedWorkbook = { workbook: { id: string }; table: { id: string } };

export default function NewWorkbookDialog({
  open,
  folderId,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Where the new workbook is filed. NULL = the root of All Files. */
  folderId?: string | null;
  onClose: () => void;
  onCreated: (workbookId: string) => void;
}) {
  const t = useTranslations("gridMain.newWorkbook");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ workbookId: string; tableId: string; file: File } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: effect resets/seeds local state when props or open state change; deriving during render would change timing
    if (!open) setError(null);
  }, [open]);

  async function createWorkbook(name: string): Promise<CreatedWorkbook> {
    const response = await fetch("/api/grid/workbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, folderId: folderId ?? null }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? t("createFailed"));
    return data;
  }

  async function createBlank() {
    setBusy(true);
    setError(null);
    try {
      // The default name is stored as the workbook name (user data), so it is not translated.
      const created = await createWorkbook("Untitled workbook");
      onCreated(created.workbook.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  // A file is chosen first, the workbook and its empty table are created, and
  // the same mapping screen as Import data opens on that table — one set of
  // type inference and column-name rules for both paths. Leaving that screen
  // without importing removes the workbook again, so Cancel leaves nothing behind.
  async function createFromFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const name = file.name.replace(/\.(csv|tsv|txt|xlsx|xls)$/i, "").trim() || "Untitled workbook";
      const created = await createWorkbook(name);
      setPending({ workbookId: created.workbook.id, tableId: created.table.id, file });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("createFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function abandonPending() {
    const current = pending;
    setPending(null);
    onClose();
    if (current) {
      await fetch(`/api/grid/workbooks/${current.workbookId}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  return (
    <>
    <Modal.Root open={open && !pending} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <Modal.Content size="max-w-lg">
        <Modal.Header icon={WorkbookIcon}>
          <Modal.Title>{t("title")}</Modal.Title>
          <Modal.Description>
            {folderId
              ? t("descriptionInFolder")
              : t("descriptionRoot")}
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void createBlank()}
              disabled={busy}
              className="rounded-2xl p-5 text-left ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 disabled:opacity-50"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-10 bg-primary-alpha-10 text-primary-base">
                <RiTableLine className="size-5" />
              </span>
              <span className="block text-label-sm text-text-strong-950">{t("blankTitle")}</span>
              <span className="mt-1 block text-paragraph-xs text-text-sub-600">
                {t("blankDescription")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-2xl p-5 text-left ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 disabled:opacity-50"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-10 bg-success-lighter text-success-base">
                <RiFileExcel2Line className="size-5" />
              </span>
              <span className="block text-label-sm text-text-strong-950">{t("fileTitle")}</span>
              <span className="mt-1 block text-paragraph-xs text-text-sub-600">
                {t("fileDescription")}
              </span>
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={(event) => void createFromFile(event.target.files?.[0])}
          />

          {busy && (
            <p className="mt-4 flex items-center gap-2 text-paragraph-sm text-text-sub-600">
              <RiLoader4Line className="size-4 animate-spin" />{t("creating")}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-red-alpha-10 px-3 py-2 text-paragraph-sm text-error-base">{error}</p>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
    <ImportDialog
      open={open && pending !== null}
      tableId={pending?.tableId ?? ""}
      initialFile={pending?.file ?? null}
      onClose={() => void abandonPending()}
      onImported={() => {
        const id = pending?.workbookId;
        setPending(null);
        if (id) onCreated(id);
      }}
    />
    </>
  );
}
