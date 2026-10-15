export default function TableSeatBadge({ seats }: { seats: number | null }) {
  if (seats === null) return null;
  const color = seats <= 4 ? "bg-primary text-primary-foreground" : seats <= 8 ? "bg-accent text-accent-foreground" : "bg-warning text-warning-foreground";
  return (
    <span title={`${seats} ghế`} aria-label={`${seats} ghế`} className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${color}`}>
      {seats}
    </span>
  );
}