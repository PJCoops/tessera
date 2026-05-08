import {
  PageHeadingSkeleton,
  SectionSkeleton,
  BarRowsSkeleton,
} from "../../_skeletons";

export default function DailyLoading() {
  return (
    <div>
      <PageHeadingSkeleton />

      <SectionSkeleton title="Last 14 days">
        <BarRowsSkeleton rows={14} />
      </SectionSkeleton>

      <SectionSkeleton title="Moves to solve · last 30d">
        <BarRowsSkeleton rows={10} />
      </SectionSkeleton>
    </div>
  );
}
