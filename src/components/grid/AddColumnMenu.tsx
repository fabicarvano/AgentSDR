"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react";
import type { ColumnType } from "@/lib/grid/types";
import { COLUMN_TYPE_GROUPS } from "./columnTypes";
import { functionMenuGroups, isFunctionGroupKey, type FunctionMenuItem } from "./functionMenu";

const FUNCTION_GROUPS = functionMenuGroups();

/** A function's name: integrationsRegistry.<integration>.actions.<action>.name, the registry's English without it. */
function useFunctionName() {
  const t = useTranslations("integrationsRegistry") as unknown as ((key: string) => string) & {
    has: (key: string) => boolean;
  };
  return ({ integrationKey, action }: FunctionMenuItem) => {
    const key = `${integrationKey}.actions.${action.key}.name`;
    return t.has(key) ? t(key) : action.name;
  };
}

/**
 * The "Add column" dropdown, matching Clay's grouping and order.
 *
 * Anchored to its trigger rather than centred as a modal — this is a menu, not
 * a dialog, and the distinction matters for how quickly a column can be added.
 *
 * Functions is not a column type: it opens the list of functions in place, and
 * picking one reports it through onPickFunction.
 */
export default function AddColumnMenu({
  open,
  onClose,
  onPick,
  onPickFunction,
  anchorRect,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: ColumnType) => void;
  onPickFunction: (integrationKey: string, actionKey: string) => void;
  anchorRect: DOMRect | null;
}) {
  const t = useTranslations("gridColumns.addColumnMenu");
  const tType = useTranslations("gridColumns.columnTypes");
  const functionName = useFunctionName();
  const ref = useRef<HTMLDivElement>(null);
  const functionsRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [functionsOpen, setFunctionsOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: effect resets/seeds local state when props or open state change; deriving during render would change timing
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the list starts closed each time the menu opens
      setFunctionsOpen(false);
      return;
    }

    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    // The menu has a fixed maximum height: bring the list it just grew by into view.
    if (functionsOpen) functionsRef.current?.scrollIntoView({ block: "nearest" });
  }, [functionsOpen]);

  if (!open || !mounted || !anchorRect) return null;

  // Flip upward when the menu would overflow the viewport bottom.
  const MENU_H = 560;
  const openUp = anchorRect.bottom + MENU_H > window.innerHeight;
  const top = openUp ? Math.max(8, anchorRect.top - MENU_H - 4) : anchorRect.bottom + 4;
  const left = Math.min(anchorRect.left, window.innerWidth - 296);

  return (
    <div
      ref={ref}
      style={{ top, left, maxHeight: MENU_H }}
      className="fixed z-50 w-72 overflow-y-auto overscroll-contain rounded-xl border border-stroke-soft-200 bg-bg-white-0 py-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]"
    >
      {COLUMN_TYPE_GROUPS.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="my-1.5 h-px bg-bg-weak-50" />}
          {group.map((m) => {
            const isFunctions = m.type === "functions" && m.available;
            return (
              <div key={m.type}>
                <button
                  type="button"
                  disabled={!m.available}
                  title={m.available ? undefined : t("comingSoon")}
                  aria-expanded={isFunctions ? functionsOpen : undefined}
                  onClick={() => {
                    if (!m.available) return;
                    if (isFunctions) {
                      setFunctionsOpen((value) => !value);
                      return;
                    }
                    onPick(m.type);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] transition ${
                    m.available
                      ? "text-text-strong-950 hover:bg-bg-weak-50"
                      : "cursor-not-allowed text-text-disabled-300"
                  }`}
                >
                  <m.icon
                    className={`size-[18px] shrink-0 ${
                      m.available ? "text-text-soft-400" : "text-text-disabled-300"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate">{m.labelKey ? tType(m.labelKey) : m.type}</span>
                  {isFunctions && (functionsOpen
                    ? <RiArrowDownSLine className="size-4 shrink-0 text-text-soft-400" />
                    : <RiArrowRightSLine className="size-4 shrink-0 text-text-soft-400" />)}
                </button>
                {isFunctions && functionsOpen && (
                  <div ref={functionsRef} className="mb-1 ml-[21px] border-l border-stroke-soft-200 pl-1.5">
                    <p className="px-2 pb-1 pt-1.5 text-[11px] leading-4 text-text-sub-600">{t("functionsHint")}</p>
                    {FUNCTION_GROUPS.map((functionGroup) => (
                      <div key={functionGroup.category}>
                        {isFunctionGroupKey(functionGroup.category) && (
                          <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-soft-400">
                            {t(`functionGroups.${functionGroup.category}`)}
                          </p>
                        )}
                        {functionGroup.items.map((item) => (
                          <button
                            key={`${item.integrationKey}.${item.action.key}`}
                            type="button"
                            onClick={() => {
                              onPickFunction(item.integrationKey, item.action.key);
                              onClose();
                            }}
                            className="block w-full truncate rounded-md px-2 py-[6px] text-left text-[13px] text-text-strong-950 transition hover:bg-bg-weak-50"
                          >
                            {functionName(item)}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
