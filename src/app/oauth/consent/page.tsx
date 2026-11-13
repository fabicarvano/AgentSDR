import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrgContext } from "@/lib/auth/context";
import { ConsentForm } from "./ConsentForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.oauth.consent");
  return { title: t("metaTitle") };
}

export const dynamic = "force-dynamic";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const ctx = await getOrgContext();
  if (!ctx) {
    // The signed query goes to the sign-in page, where the OAuth plugin resumes the flow.
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v);
    }
    redirect(`/sign-in${qs.size ? `?${qs}` : ""}`);
  }
  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  const requestedScope = typeof params.scope === "string" ? params.scope : "";
  // Any app can register itself under any name, so say where the approval goes.
  let returnsTo: string | null = null;
  try {
    returnsTo = typeof params.redirect_uri === "string" ? new URL(params.redirect_uri).host : null;
  } catch {
    returnsTo = null;
  }
  return (
    <ConsentForm
      clientId={clientId}
      returnsTo={returnsTo}
      requestedScope={requestedScope}
      userName={ctx.userName}
      userEmail={ctx.userEmail}
      organizationName={ctx.organizationName}
    />
  );
}
