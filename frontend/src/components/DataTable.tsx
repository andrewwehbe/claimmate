import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { classNames } from "../lib/format";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  /** Applied to both header and cells (e.g. text-right, font-mono). */
  className?: string;
  headerClassName?: string;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  compact?: boolean;
  emptyState?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

/** Dense data table: sticky header, sortable columns, 0px radius, row hover. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  compact = false,
  emptyState,
  rowClassName,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      if (av < bv) return -sort.dir;
      if (av > bv) return sort.dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key === key
        ? s.dir === 1
          ? { key, dir: -1 }
          : null
        : { key, dir: 1 },
    );
  };

  if (rows.length === 0 && emptyState) {
    return <div className="border border-gray-200 bg-white">{emptyState}</div>;
  }

  return (
    <div className="overflow-auto border border-gray-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr className="border-b border-gray-200">
            {columns.map((col) => {
              const sortable = Boolean(col.sortValue);
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={classNames(
                    "h-9 whitespace-nowrap px-3 text-left text-xs font-medium text-gray-500",
                    col.className,
                    col.headerClassName,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={classNames(
                        "inline-flex items-center gap-1 hover:text-gray-900",
                        active && "text-gray-900",
                      )}
                    >
                      {col.header}
                      {active &&
                        (sort!.dir === 1 ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        ))}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={classNames(
                "border-b border-gray-100 last:border-b-0",
                compact ? "h-9" : "h-11",
                onRowClick && "cursor-pointer transition-colors hover:bg-gray-50",
                rowClassName?.(row),
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={classNames(
                    "whitespace-nowrap px-3 align-middle",
                    col.className,
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
