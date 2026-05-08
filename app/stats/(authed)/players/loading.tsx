import {
  PageHeadingSkeleton,
  SectionSkeleton,
  BigSkeleton,
  TableSkeleton,
  BarRowsSkeleton,
} from "../../_skeletons";

export default function PlayersLoading() {
  return (
    <div>
      <PageHeadingSkeleton />

      <SectionSkeleton title="Returning players · all time">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <BigSkeleton key={i} />
          ))}
        </div>
      </SectionSkeleton>

      <SectionSkeleton title="By language · last 30d">
        <TableSkeleton rows={6} cols={6} />
      </SectionSkeleton>

      <SectionSkeleton title="Hide hints toggle · last 30d">
        <BarRowsSkeleton rows={2} />
      </SectionSkeleton>
    </div>
  );
}
