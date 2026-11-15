"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RiAddLine } from "@remixicon/react";

import * as Button from "@/components/alignui/button";
import ConnectMailboxDialog from "./ConnectMailboxDialog";

export default function AddMailboxButton() {
  const t = useTranslations("settingsAccounts.addMailbox");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button.Root variant="primary" mode="filled" size="small" onClick={() => setOpen(true)}>
        <Button.Icon as={RiAddLine} />
        {t("button")}
      </Button.Root>
      {open && <ConnectMailboxDialog onClose={() => setOpen(false)} />}
    </>
  );
}
