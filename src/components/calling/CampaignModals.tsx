"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RiDeleteBinLine, RiPencilLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import { useCrmText } from "@/components/crm/useCrmText";
import { FormError, TextField } from "@/components/calls/fields";
import { deleteCampaign, updateCampaign } from "@/lib/calls/client";
import type { CampaignSummary } from "@/lib/calls/contract";

/** Prefilled name/description edit, shared by the campaign list and the campaign page. */
export function EditCampaignModal({
  open,
  onOpenChange,
  campaign,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignSummary | null;
  onUpdated: (campaign: CampaignSummary) => void;
}) {
  const t = useTranslations("callingMain.campaignModals");
  const { errorMessage } = useCrmText();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && campaign) {
      setName(campaign.name);
      setDescription(campaign.description ?? "");
      setError("");
      setSubmitting(false);
    }
  }, [open, campaign]);

  const submit = async () => {
    if (!campaign || !name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await updateCampaign(campaign.id, { name: name.trim(), description: description.trim() || null });
      onUpdated(updated);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <Modal.Content>
        <Modal.Header icon={RiPencilLine}>
          <Modal.Title>{t("editTitle")}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="space-y-3">
          {error && <FormError>{error}</FormError>}
          <TextField label={t("name")} autoFocus value={name} onChange={setName} disabled={submitting} />
          <TextField label={t("description")} value={description} onChange={setDescription} disabled={submitting} />
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close asChild>
            <Button.Root variant="neutral" mode="stroke" size="small" disabled={submitting}>{t("cancel")}</Button.Root>
          </Modal.Close>
          <Button.Root variant="primary" mode="filled" size="small" disabled={submitting || !name.trim()} onClick={() => void submit()}>
            {submitting ? t("saving") : t("saveChanges")}
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

/** Archive-confirm modal, shared by the campaign list and the campaign page. */
export function DeleteCampaignModal({
  open,
  onOpenChange,
  campaign,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignSummary | null;
  onDeleted: () => void;
}) {
  const t = useTranslations("callingMain.campaignModals");
  const { errorMessage } = useCrmText();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    if (!campaign) return;
    setSubmitting(true);
    setError("");
    try {
      await deleteCampaign(campaign.id);
      onDeleted();
    } catch (cause) {
      setError(errorMessage(cause));
      setSubmitting(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <Modal.Content>
        <Modal.Header icon={RiDeleteBinLine}>
          <Modal.Title>{t("deleteTitle")}</Modal.Title>
          <Modal.Description>
            {t("deleteBody", { name: campaign?.name ?? "" })}
          </Modal.Description>
        </Modal.Header>
        {error && (
          <Modal.Body>
            <FormError>{error}</FormError>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Modal.Close asChild>
            <Button.Root variant="neutral" mode="stroke" size="small" disabled={submitting}>{t("cancel")}</Button.Root>
          </Modal.Close>
          <Button.Root variant="error" mode="filled" size="small" disabled={submitting} onClick={() => void submit()}>
            {submitting ? t("deleting") : t("deleteButton")}
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
