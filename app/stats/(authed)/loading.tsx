import {
  HeroSkeleton,
  BigSkeleton,
  ChartSkeleton,
  PageHeadingSkeleton,
  SectionSkeleton,
  Bar,
} from "../_skeletons";

export default function OverviewLoading() {
  return (
    <div>
      <PageHeadingSkeleton subtitle />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <HeroSkeleton key={i} />
        ))}
      </section>

      <SectionSkeleton title="Daily trend">
        <ChartSkeleton />
      </SectionSkeleton>

      <section className="mb-12 animate-pulse">
        <Bar className="h-3 w-44 mb-3" />
        <div className="p-5 rounded-md bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] space-y-2">
          <Bar className="h-3 w-3/4" />
          <Bar className="h-3 w-1/2" />
          <Bar className="h-3 w-2/3" />
          <Bar className="h-3 w-1/3" />
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
        {Array.from({ length: 4 }).map((_, i) => (
          <BigSkeleton key={i} />
        ))}
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <BigSkeleton key={i} />
        ))}
      </section>
    </div>
  );
}
