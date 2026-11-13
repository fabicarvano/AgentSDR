"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { authClient, useSession } from "@/lib/auth/client";
import { useAuthError } from "@/i18n/useAuthError";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, SecondaryButton, linkClass } from "@/components/auth/fields";
import { Spinner } from "@/components/auth/fields";
import Link from "next/link";

type Invitation = {
  id: string;
  organizationName: string;
  inviterEmail: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date | string;
  organizationId: string;
};

export default function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("auth.acceptInvitation");
  const tc = useTranslations("auth.common");
  const authError = useAuthError();
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "wrong-email">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [declined, setDeclined] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (isPending) return;
    let cancelled = false;
    authClient.organization.getInvitation({ query: { id } }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err || !data) {
        // Signed out, a stranger's invitation, or gone: the API answers the same for all.
        setState(session ? (err?.status === 403 ? "wrong-email" : "missing") : "ready");
        return;
      }
      const inv = data as Invitation;
      setInvite(inv);
      setExpired(inv.status !== "pending" || new Date(inv.expiresAt).getTime() < Date.now());
      setState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [id, isPending, session]);

  const from = encodeURIComponent(`/accept-invitation/${id}`);

  async function accept() {
    setError("");
    setBusy("accept");
    const res = await authClient.organization.acceptInvitation({ invitationId: id });
    if (res.error) {
      setError(authError(res.error, t("acceptFailed")));
      return setBusy(null);
    }
    const organizationId = res.data?.invitation?.organizationId ?? invite?.organizationId;
    if (organizationId) {
      const active = await authClient.organization.setActive({ organizationId });
      if (active.error) {
        setError(authError(active.error, t("switchFailed")));
        return setBusy(null);
      }
    }
    window.location.href = "/analytics";
  }

  async function decline() {
    setError("");
    setBusy("decline");
    const { error: err } = await authClient.organization.rejectInvitation({ invitationId: id });
    setBusy(null);
    if (err) setError(authError(err, t("declineFailed")));
    else setDeclined(true);
  }

  if (state === "loading" || isPending) {
    return (
      <AuthShell title={t("loadingTitle")}>
        <div className="flex justify-center text-slate-400">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  if (declined) {
    return (
      <AuthShell title={t("declinedTitle")} subtitle={t("declinedSubtitle")}>
        <Link href="/" className={linkClass}>
          {t("goHome")}
        </Link>
      </AuthShell>
    );
  }

  if (state === "wrong-email") {
    return (
      <AuthShell title={t("wrongAccountTitle")} subtitle={t("wrongAccountSubtitle")}>
        <Link href={`/sign-in?from=${from}`} className={linkClass}>
          {t("switchAccount")}
        </Link>
      </AuthShell>
    );
  }

  if (state === "missing" || expired) {
    return (
      <AuthShell
        title={expired ? t("expiredTitle") : t("notFoundTitle")}
        subtitle={expired ? t("expiredSubtitle") : t("notFoundSubtitle")}
      >
        <Link href="/sign-in" className={linkClass}>
          {tc("backToSignIn")}
        </Link>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell
        title={t("invitedTitle")}
        subtitle={
          invite
            ? t("signedOutSubtitle", { inviter: invite.inviterEmail, organization: invite.organizationName })
            : t("signedOutSubtitleGeneric")
        }
      >
        <div className="flex flex-col gap-3">
          <Link href={`/sign-in?from=${from}`} className="w-full rounded-lg bg-indigo-600 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-500">
            {t("signInToAccept")}
          </Link>
          <Link href={`/sign-up?from=${from}`} className="w-full rounded-lg border border-slate-700 bg-slate-800 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-slate-700">
            {t("createAccount")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("invitedTitle")}
      subtitle={invite ? t("invitedBy", { inviter: invite.inviterEmail, organization: invite.organizationName }) : t("invitedGeneric")}
    >
      <div className="flex flex-col gap-3">
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <button
          type="button"
          onClick={accept}
          disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "accept" && <Spinner />}
          {t("accept")}
        </button>
        <SecondaryButton onClick={decline} loading={busy === "decline"} disabled={!!busy}>
          {t("decline")}
        </SecondaryButton>
      </div>
    </AuthShell>
  );
}
