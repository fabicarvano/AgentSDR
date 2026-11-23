import { useTranslations } from "next-intl";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/page/Skeletons";

export default function JobsLoading() {
  const t = useTranslations("linkedinMain.loading");
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" aria-busy="true" aria-label={t("label")}>
      <PageHeaderSkeleton action={false} />
      <TableSkeleton rows={10} columns={4} />
    </div>
  );
}
