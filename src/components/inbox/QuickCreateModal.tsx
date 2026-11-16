"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RiStickyNoteLine, RiTaskLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";

/** "+ Task" / "+ Note" from an open thread: creates one tied to that lead. */
export default function QuickCreateModal({
  type,
  leadId,
  leadName,
  onClose,
  onCreated,
}: {
  type: "task" | "note";
  leadId: string;
  /** Who it is for, shown in the description. */
  leadName?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("inboxMain.quickCreate");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const isTask = type === "task";

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const endpoint = isTask ? "/api/outreach/inbox/tasks" : "/api/outreach/inbox/notes";
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isTask ? { name, description, leadId } : { title: name, description, leadId }),
      });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header icon={isTask ? RiTaskLine : RiStickyNoteLine}>
          <Modal.Title>{isTask ? t("newTask") : t("newNote")}</Modal.Title>
          <Modal.Description>
            {isTask
              ? leadName
                ? t("descriptionTaskFor", { name: leadName })
                : t("descriptionTask")
              : leadName
                ? t("descriptionNoteFor", { name: leadName })
                : t("descriptionNote")}
          </Modal.Description>
        </Modal.Header>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <Modal.Body className="space-y-3">
            <Input.Root>
              <Input.Wrapper>
                <Input.Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isTask ? t("taskName") : t("noteTitle")}
                  aria-label={isTask ? t("taskName") : t("noteTitle")}
                  autoFocus
                />
              </Input.Wrapper>
            </Input.Root>
            <Textarea.Root simple rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} aria-label={t("descriptionLabel")} />
          </Modal.Body>
          <Modal.Footer>
            <Button.Root type="button" variant="neutral" mode="stroke" size="small" onClick={onClose}>
              {t("cancel")}
            </Button.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={saving || !name.trim()}>
              {saving ? t("saving") : isTask ? t("createTask") : t("createNote")}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
