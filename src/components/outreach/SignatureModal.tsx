"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RiPenNibLine } from "@remixicon/react";

import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import { Callout, Field } from "@/components/settings/SettingsKit";

export default function SignatureModal({
  mailboxId,
  mailboxAddress,
  initial,
  onClose,
  onSaved,
}: {
  mailboxId: string;
  mailboxAddress?: string;
  initial: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("emailSequence.signature");
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/mailboxes/${mailboxId}/signature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureHtml: value }),
      });
      if (!res.ok) {
        setError(t("saveFailed"));
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content size="max-w-lg">
        <Modal.Header icon={RiPenNibLine}>
          <Modal.Title>{t("title")}</Modal.Title>
          <Modal.Description>{mailboxAddress ? t("forAddress", { address: mailboxAddress }) : t("forThisMailbox")}</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-4">
          <Field
            label={t("fieldLabel")}
            htmlFor={`signature-${mailboxId}`}
            description={
              t.rich("fieldDescription", {
                token: () => (
                  <code className="rounded bg-bg-weak-50 px-1 font-mono text-text-strong-950">%signature%</code>
                ),
              })
            }
          >
            <Textarea.Root
              id={`signature-${mailboxId}`}
              simple
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t("placeholder")}
              rows={6}
            />
          </Field>
          {error && <Callout tone="error">{error}</Callout>}
        </Modal.Body>
        <Modal.Footer>
          <Button.Root variant="neutral" mode="stroke" size="small" onClick={onClose}>
            {t("cancel")}
          </Button.Root>
          <Button.Root variant="primary" mode="filled" size="small" disabled={saving} onClick={handleSave}>
            {saving ? t("saving") : t("save")}
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
