import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/server";
import { OrganizationPicker } from "./OrganizationPicker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.oauth.organization");
  return { title: t("metaTitle") };
}

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v);
    }
    redirect(`/sign-in${qs.size ? `?${qs}` : ""}`);
  }
  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  return <OrganizationPicker clientId={clientId} />;
}
