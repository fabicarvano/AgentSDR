"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RiErrorWarningLine, RiLoader4Line, RiPencilLine, RiSaveLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import type { UpdateWhatsappCampaignRequest, WhatsappCampaignSummary } from "@/lib/whatsapp/campaigns/contract";
import type { WhatsappAccountSummary } from "@/lib/whatsapp/contract";
import { cn } from "@/utils/cn";
import { apiJson, fetchWhatsappAccounts } from "./api";
import { SenderPicker } from "./SenderPicker";
import { useApiErrorText } from "@/i18n/useApiErrorText";

export type EditableWhatsappCampaign = Pick<WhatsappCampaignSummary, "id" | "name" | "description" | "senders">;

/** Rename a campaign, change its description, and choose its numbers. */
export function EditWhatsappCampaignModal({
  campaign,
  open,
  onOpenChange,
  onSaved,
}: {
  campaign: EditableWhatsappCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The change is saved; the caller reloads its figures. */
  onSaved: () => void;
}) {
  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="max-w-lg">
        {campaign && <EditForm key={campaign.id} campaign={campaign} onCancel={() => onOpenChange(false)} onSaved={onSaved} />}
      </Modal.Content>
    </Modal.Root>
  );
}

function EditForm({ campaign, onCancel, onSaved }: { campaign: EditableWhatsappCampaign; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations("whatsappCampaigns.edit");
  const apiErrorText = useApiErrorText();
  const te = useTranslations("whatsappCampaigns.errors");
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [accountIds, setAccountIds] = useState<string[]>(campaign.senders.map((s) => s.accountId));
  const [accounts, setAccounts] = useState<WhatsappAccountSummary[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWhatsappAccounts()
      .then((list) => { if (!cancelled) setAccounts(list); })
      .catch((cause) => { if (!cancelled) setAccountsError(apiErrorText(cause, t("loadNumbersFailed"))); });
    return () => { cancelled = true; };
  }, [t, apiErrorText]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError(t("nameRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      const body: UpdateWhatsappCampaignRequest = { name: trimmed, description: description.trim() || null, accountIds };
      await apiJson(`/api/whatsapp/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (cause) {
      setError(apiErrorText(cause, te("generic")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal.Header icon={RiPencilLine}>
        <Modal.Title>{t("title")}</Modal.Title>
        <Modal.Description>{t("description")}</Modal.Description>
      </Modal.Header>
      <Modal.Body className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-label-sm text-text-strong-950">{t("nameLabel")}</span>
          <Input.Root hasError={Boolean(error && !name.trim())}>
            <Input.Wrapper>
              <Input.Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void save(); }} autoFocus />
            </Input.Wrapper>
          </Input.Root>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-label-sm text-text-strong-950">
            {t.rich("descriptionLabel", { soft: (chunks) => <span className="text-text-soft-400">{chunks}</span> })}
          </span>
          <Textarea.Root simple rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} />
        </label>
        <div>
          <span className="mb-1.5 block text-label-sm text-text-strong-950">{t("numbers")}</span>
          <SenderPicker accounts={accounts} selectedIds={accountIds} onChange={setAccountIds} error={accountsError} />
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-paragraph-sm text-error-base">
            <RiErrorWarningLine className="size-4 shrink-0" />{error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button.Root variant="neutral" mode="stroke" size="small" onClick={onCancel}>{t("cancel")}</Button.Root>
        <Button.Root variant="primary" mode="filled" size="small" onClick={() => void save()} disabled={saving}>
          <Button.Icon as={saving ? RiLoader4Line : RiSaveLine} className={cn(saving && "animate-spin")} />
          {t("save")}
        </Button.Root>
      </Modal.Footer>
    </>
  );
}
