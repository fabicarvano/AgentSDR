import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/page/Skeletons";

export default async function Loading() {
  const t = await getTranslations("callingAiSetup.page");
  return (
    <div aria-busy="true" aria-label={t("loadingAria")} className="mx-auto w-full max-w-[1440px] space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
