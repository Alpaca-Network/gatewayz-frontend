// Small label/value tile shared by StakingHeader and BalancesCard.
export function StatTile({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold">{loading ? '…' : value}</span>
    </div>
  );
}
