export const validSeats = (value: string) => {
  const seats = Number(value);
  return Number.isInteger(seats) && seats >= 1 && seats <= 999;
};

export function sortTablesBySeats<T extends { seats: number | null; name: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) =>
    (a.seats ?? Infinity) - (b.seats ?? Infinity) || a.name.localeCompare(b.name, "vi", { numeric: true })
  );
}

export function groupTablesBySeats<T extends { seats: number | null; name: string }>(tables: T[]) {
  const groups: Array<{ seats: number | null; tables: T[] }> = [];
  for (const table of sortTablesBySeats(tables)) {
    const last = groups[groups.length - 1];
    if (last && last.seats === table.seats) last.tables.push(table);
    else groups.push({ seats: table.seats, tables: [table] });
  }
  return groups;
}