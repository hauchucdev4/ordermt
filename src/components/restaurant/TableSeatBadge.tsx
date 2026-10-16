export default function TableSeatBadge({ seats, occupied = false, inline = false }: { seats: number | null; occupied?: boolean; inline?: boolean }) {
  if (seats === null) return null;
  const color = occupied ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground";
  return (
    <span title={`${seats} ghế · ${occupied ? "Có khách" : "Trống"}`} aria-label={`${seats} ghế · ${occupied ? "Có khách" : "Trống"}`} className={`${inline ? "" : "absolute right-2 top-2 "}flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${color}`}>
      {seats}
    </span>
  );
}