"use client";

import { useTranslations } from "next-intl";
import { RiFilter3Line } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Popover from "@/components/alignui/popover";
import * as Select from "@/components/alignui/select";
import { activeFilterCount, CRM_CATEGORIES, CRM_STATES, type PeopleFilters } from "./leadTypes";

export type Subcategory = { id: string; name: string; categoryKey: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><span className="block text-label-xs text-text-sub-600">{label}</span>{children}</div>;
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-paragraph-sm text-text-strong-950">
      <Checkbox.Root id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}

export function LeadsFilterPopover({ filters, subcategories, onChange, onClear }: {
  filters: PeopleFilters;
  subcategories: Subcategory[];
  onChange: (patch: Partial<PeopleFilters>) => void;
  onClear: () => void;
}) {
  const t = useTranslations("leads.filter");
  const tc = useTranslations("leads.crm");
  const count = activeFilterCount(filters);
  const visibleSubcategories = subcategories.filter((item) => !filters.crmCategory || item.categoryKey === filters.crmCategory);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button.Root variant="neutral" mode="stroke" size="small">
          <Button.Icon as={RiFilter3Line} />
          {t("trigger")}
          {count > 0 && <Badge.Root size="medium" variant="filled" color="blue" square>{count}</Badge.Root>}
        </Button.Root>
      </Popover.Trigger>
      <Popover.Content align="end" showArrow={false} sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between">
          <h2 className="text-label-md text-text-strong-950">{t("title")}</h2>
          <button type="button" onClick={onClear} disabled={!count} className="text-label-sm text-primary-base outline-none hover:underline focus-visible:underline disabled:pointer-events-none disabled:text-text-disabled-300">{t("clearAll")}</button>
        </div>
        <div className="mt-4 space-y-4">
          <Field label={t("campaign.label")}>
            <Select.Root size="small" value={filters.campaignChannel} onValueChange={(value) => onChange({ campaignChannel: value })}>
              <Select.Trigger aria-label={t("campaign.aria")}><Select.Value placeholder={t("campaign.all")} /></Select.Trigger>
              <Select.Content>
                <Select.Item value="">{t("campaign.all")}</Select.Item>
                <Select.Item value="email">{t("campaign.email")}</Select.Item>
                <Select.Item value="linkedin">{t("campaign.linkedin")}</Select.Item>
                <Select.Item value="unassigned">{t("campaign.unassigned")}</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label={t("category.label")}>
            <Select.Root size="small" value={filters.crmCategory} onValueChange={(value) => onChange({ crmCategory: value, crmSubcategoryId: "" })}>
              <Select.Trigger aria-label={t("category.aria")}><Select.Value placeholder={t("category.all")} /></Select.Trigger>
              <Select.Content>
                <Select.Item value="">{t("category.all")}</Select.Item>
                {CRM_CATEGORIES.map((category) => <Select.Item key={category.value} value={category.value}>{tc(`category.${category.labelKey}`)}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label={t("subcategory.label")}>
            <Select.Root size="small" value={filters.crmSubcategoryId} onValueChange={(value) => onChange({ crmSubcategoryId: value })} disabled={!visibleSubcategories.length}>
              <Select.Trigger aria-label={t("subcategory.aria")}><Select.Value placeholder={t("subcategory.all")} /></Select.Trigger>
              <Select.Content>
                <Select.Item value="">{t("subcategory.all")}</Select.Item>
                {visibleSubcategories.map((item) => <Select.Item key={item.id} value={item.id}>{item.name}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label={t("state.label")}>
            <Select.Root size="small" value={filters.crmWorkflowState} onValueChange={(value) => onChange({ crmWorkflowState: value })}>
              <Select.Trigger aria-label={t("state.aria")}><Select.Value placeholder={t("state.all")} /></Select.Trigger>
              <Select.Content>
                <Select.Item value="">{t("state.all")}</Select.Item>
                {/* No `capitalize` class any more: the label arrives already cased for its language. */}
                {CRM_STATES.map((state) => <Select.Item key={state.value} value={state.value}>{tc(`state.${state.labelKey}`)}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
          <div className="space-y-3 border-t border-stroke-soft-200 pt-4">
            <Check id="lead-filter-has-email" label={t("hasEmail")} checked={filters.hasEmail} onChange={(hasEmail) => onChange({ hasEmail })} />
            <Check id="lead-filter-has-linkedin" label={t("hasLinkedin")} checked={filters.hasLinkedin} onChange={(hasLinkedin) => onChange({ hasLinkedin })} />
            <Check id="lead-filter-ai-change" label={t("aiChanged")} checked={filters.crmAiChange} onChange={(crmAiChange) => onChange({ crmAiChange })} />
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
