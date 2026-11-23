import type { RefObject } from "react";
import { RiCheckLine, RiFileExcel2Line, RiUserAddLine } from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@/utils/cn";

/**
 * Pieces the campaign wizards (email, LinkedIn, WhatsApp, AI calling) share. They take already-translated text, so
 * each wizard keeps its own catalog domain.
 */

/** The numbered (or checked) square in front of a step. */
export function StepDot({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-label-xs transition",
        done ? "bg-success-lighter text-success-base" : active ? "bg-primary-base text-static-white shadow-regular-xs" : "bg-bg-weak-50 text-text-soft-400",
      )}
    >
      {done ? <RiCheckLine className="size-4" /> : index + 1}
    </div>
  );
}

export function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-label-lg text-text-strong-950">{title}</h2>
      <p className="mt-1 text-paragraph-sm text-text-sub-600">{description}</p>
    </div>
  );
}

export function SummaryRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-sub-600">{label}</dt>
      <dd className={cn("text-label-sm tabular-nums text-text-strong-950", truncate && "min-w-0 truncate")}>{value}</dd>
    </div>
  );
}

export type WizardStepItem = { id: string; label: string; hint: string; icon: RemixiconComponentType };

/** The list of steps on the left of a wizard: you can go back to a step you already reached, not ahead. */
export function WizardStepList({ items, step, busy = false, onSelect }: { items: WizardStepItem[]; step: number; busy?: boolean; onSelect: (index: number) => void }) {
  return (
    <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
      {items.map((item, index) => {
        const active = index === step;
        const done = index < step;
        const reachable = index <= step;
        const Icon = item.icon;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!reachable || active || busy}
              onClick={() => onSelect(index)}
              aria-current={active ? "step" : undefined}
              className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition duration-200 ease-out", active ? "bg-bg-weak-50" : reachable ? "hover:bg-bg-weak-50" : "cursor-default")}
            >
              <StepDot index={index} active={active} done={done} />
              <span className="min-w-0">
                <span className={cn("block text-label-sm", active ? "text-text-strong-950" : "text-text-sub-600")}>{item.label}</span>
                <span className="mt-0.5 hidden text-paragraph-xs text-text-soft-400 lg:block">{item.hint}</span>
              </span>
              <Icon className="ml-auto hidden size-4 text-text-soft-400 sm:block lg:hidden" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** "Upload a sheet" / "Pick from People" cards, the hidden file input and the line saying how many leads are in. */
export function LeadSourceCards({
  fileRef,
  onPickFile,
  onPickPeople,
  importTitle,
  importBody,
  peopleTitle,
  peopleBody,
  addedText,
  hintText,
}: {
  fileRef: RefObject<HTMLInputElement | null>;
  onPickFile: (file: File | null) => void;
  onPickPeople: () => void;
  importTitle: string;
  importBody: string;
  peopleTitle: string;
  peopleBody: string;
  addedText: string;
  hintText: string;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-stroke-sub-300 bg-bg-weak-50 p-6 text-center outline-none transition hover:border-primary-base focus-visible:ring-2 focus-visible:ring-primary-base">
          <span className="flex size-10 items-center justify-center rounded-xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200"><RiFileExcel2Line className="size-5 text-text-sub-600" /></span>
          <span className="mt-3 text-label-md text-text-strong-950">{importTitle}</span>
          <span className="mt-1 text-paragraph-xs text-text-sub-600">{importBody}</span>
        </button>
        <button type="button" onClick={onPickPeople} className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-bg-white-0 p-6 text-center shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base">
          <span className="flex size-10 items-center justify-center rounded-xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200"><RiUserAddLine className="size-5 text-text-sub-600" /></span>
          <span className="mt-3 text-label-md text-text-strong-950">{peopleTitle}</span>
          <span className="mt-1 text-paragraph-xs text-text-sub-600">{peopleBody}</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => onPickFile(event.target.files?.[0] ?? null)} />
      <div role="status" className="mt-4 rounded-xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200">
        <p className="text-label-sm text-text-strong-950">{addedText}</p>
        <p className="mt-1 text-paragraph-xs text-text-sub-600">{hintText}</p>
      </div>
    </>
  );
}
