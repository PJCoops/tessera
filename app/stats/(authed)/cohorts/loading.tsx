import {
  PageHeadingSkeleton,
  SectionSkeleton,
  TableSkeleton,
  Bar,
} from "../../_skeletons";

export default function CohortsLoading() {
  return (
    <div>
      <PageHeadingSkeleton />

      <SectionSkeleton title="Cohort retention · weekly cohorts">
        <div className="space-y-2 mb-4 animate-pulse max-w-prose">
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-5/6" />
          <Bar className="h-3 w-2/3" />
        </div>
        <TableSkeleton rows={8} cols={7} />
      </SectionSkeleton>
    </div>
  );
}
