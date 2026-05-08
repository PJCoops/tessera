import {
  PageHeadingSkeleton,
  SectionSkeleton,
  TableSkeleton,
} from "../../_skeletons";

export default function HealthLoading() {
  return (
    <div>
      <PageHeadingSkeleton />

      <SectionSkeleton title="Precompute cron · last run">
        <TableSkeleton rows={6} cols={3} />
      </SectionSkeleton>
    </div>
  );
}
