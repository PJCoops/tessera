import {
  PageHeadingSkeleton,
  SectionSkeleton,
  TierBarSkeleton,
  TableSkeleton,
  Bar,
} from "../../_skeletons";

export default function PuzzlesLoading() {
  return (
    <div>
      <PageHeadingSkeleton />

      <SectionSkeleton title="Today's tiers">
        <TierBarSkeleton />
      </SectionSkeleton>

      <SectionSkeleton title="Hardest & easiest · last 30d">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border border-[color:var(--color-rule)] rounded-md p-4"
            >
              <Bar className="h-2.5 w-24" />
              <Bar className="h-5 w-16 mt-2" />
              <Bar className="h-2.5 w-32 mt-2" />
            </div>
          ))}
        </div>
      </SectionSkeleton>

      <SectionSkeleton title="Tier distribution · last 30d">
        <TierBarSkeleton />
      </SectionSkeleton>

      <SectionSkeleton title="Per-puzzle difficulty · last 30d">
        <TableSkeleton rows={10} cols={4} />
      </SectionSkeleton>
    </div>
  );
}
