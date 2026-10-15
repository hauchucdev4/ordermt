import type { ReactNode } from "react";
import { groupTablesBySeats } from "@/lib/tableSeats";

export default function TableSeatGroups<T extends { seats: number | null; name: string }>({
  tables, gridClassName, children,
}: {
  tables: T[];
  gridClassName: string;
  children: (table: T) => ReactNode;
}) {
  return (
    <div className="space-y-6">
      {groupTablesBySeats(tables).map(group => (
        <section key={group.seats ?? "unspecified"} aria-label={group.seats === null ? "Chưa có số ghế" : `${group.seats} ghế`}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold">{group.seats === null ? "Chưa có số ghế" : `${group.seats} ghế`}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{group.tables.length} bàn</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className={`table-seat-grid grid ${gridClassName}`}>
            {group.tables.map(children)}
          </div>
        </section>
      ))}
    </div>
  );
}