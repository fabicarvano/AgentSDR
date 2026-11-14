import * as Table from "@/components/alignui/table";
import { cn } from "@/utils/cn";
import { useAnalyticsFormat } from "../useAnalyticsFormat";

/**
 * The accessible table twin of any chart (ChartCard's table-view toggle).
 *
 * Props: `columns` [{ key, label, align?, swatch? }] — `swatch` puts a colour
 * key beside the header; `rows` Array<Record<key, string | number | null>>
 * (numbers are formatted in the interface language unless `format` is given);
 * `caption` for screen readers; `maxHeight` px, scrolls past it.
 */
export type TableColumn = { key: string; label: string; align?: "left" | "right"; swatch?: string; format?: (value: string | number | null) => string };
export type TableRowData = Record<string, string | number | null>;

export function DataTableView({ columns, rows, caption, maxHeight = 320 }: { columns: TableColumn[]; rows: TableRowData[]; caption: string; maxHeight?: number }) {
  const fmt = useAnalyticsFormat();
  return (
    <div className="overflow-y-auto" style={{ maxHeight }}>
      <Table.Root>
        <Table.Caption className="sr-only">{caption}</Table.Caption>
        <Table.Header>
          <Table.Row>
            {columns.map((column) => (
              <Table.Head key={column.key} className={cn("sticky top-0", column.align === "right" && "text-right")} scope="col">
                <span className={cn("inline-flex items-center gap-1.5", column.align === "right" && "flex-row-reverse")}>
                  {column.swatch && <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: column.swatch }} />}
                  {column.label}
                </span>
              </Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body spacing={4}>
          {rows.map((row, index) => (
            <Table.Row key={index}>
              {columns.map((column) => {
                const raw = row[column.key] ?? null;
                const text = column.format ? column.format(raw) : typeof raw === "number" ? fmt.number(raw) : (raw ?? "—");
                return (
                  <Table.Cell key={column.key} className={cn("h-9 text-paragraph-sm text-text-strong-950", column.align === "right" && "text-right tabular-nums", column.key === columns[0].key && "text-text-sub-600")}>
                    {text}
                  </Table.Cell>
                );
              })}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
}
