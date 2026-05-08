import {
  PageHeadingSkeleton,
  SectionSkeleton,
  BigSkeleton,
  Bar,
} from "../../_skeletons";

export default function NotificationsLoading() {
  return (
    <div>
      <PageHeadingSkeleton />

      <SectionSkeleton title="Daily reminder reach + push funnel">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <BigSkeleton key={i} />
          ))}
        </div>
        <div className="mt-4 space-y-2 animate-pulse max-w-prose">
          <Bar className="h-2.5 w-full" />
          <Bar className="h-2.5 w-3/4" />
        </div>
      </SectionSkeleton>
    </div>
  );
}
