// Loading-state primitives for the /stats route tree. Each is shaped
// to match a real component in _components.tsx so that swapping from
// skeleton to data doesn't shift the layout. All bars share the same
// pulse animation and use --color-rule (a soft alpha border colour) so
// they read as "placeholder" against the cream cards in both themes.

const BAR = "bg-[color:var(--color-rule)] rounded-sm";

export function Bar({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`${BAR} ${className}`} style={style} />;
}

export function HeroSkeleton() {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-lg p-6 bg-[color:var(--color-cream)] animate-pulse">
      <div className="flex items-baseline justify-between gap-2">
        <Bar className="h-2.5 w-20" />
        <Bar className="h-2.5 w-12" />
      </div>
      <Bar className="h-12 w-32 mt-3" />
      <Bar className="h-2.5 w-44 mt-3" />
    </div>
  );
}

export function BigSkeleton() {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4 animate-pulse">
      <Bar className="h-2.5 w-24" />
      <Bar className="h-7 w-20 mt-2" />
      <Bar className="h-2.5 w-28 mt-2" />
    </div>
  );
}

export function SectionSkeleton({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-2 mb-3">
        {title ? (
          <h2 className="text-sm font-medium text-[color:var(--color-muted)]">
            {title}
          </h2>
        ) : (
          <Bar className="h-3 w-32 animate-pulse" />
        )}
      </div>
      {children}
    </section>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4 animate-pulse">
      <div className="flex items-baseline justify-between mb-4">
        <Bar className="h-2.5 w-24" />
        <div className="flex gap-1.5">
          <Bar className="h-5 w-8 rounded-full" />
          <Bar className="h-5 w-8 rounded-full" />
          <Bar className="h-5 w-8 rounded-full" />
        </div>
      </div>
      <div
        className="w-full bg-[color:var(--color-cream)] rounded-sm"
        style={{ height }}
      />
    </div>
  );
}

export function BarRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Bar className="h-3 w-16" />
          <div className="flex-1 h-3 bg-[color:var(--color-cream)] rounded-sm overflow-hidden">
            <Bar
              className="h-full"
              style={{ width: `${30 + ((i * 17) % 60)}%` }}
            />
          </div>
          <Bar className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

export function TierBarSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <Bar className="h-6 w-full rounded-md" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Bar className="h-2.5 w-2.5 flex-shrink-0" />
            <Bar className="h-2.5 w-16" />
            <Bar className="h-2.5 w-10 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-x-auto animate-pulse">
      <div className="w-full">
        <div className="flex gap-2 pb-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Bar
              key={c}
              className={`h-2.5 ${c === 0 ? "w-24" : "flex-1"}`}
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex gap-2 py-2 border-t border-[color:var(--color-rule)]"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Bar
                key={c}
                className={`h-3 ${c === 0 ? "w-24" : "flex-1"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeadingSkeleton({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <div className="mb-6 animate-pulse">
      <Bar className="h-7 w-48" />
      {subtitle && <Bar className="h-2.5 w-32 mt-2" />}
    </div>
  );
}
