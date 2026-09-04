export default function DashboardLoading() {
  return (
    <div className="space-y-5 p-4 lg:p-8">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
        <div className="space-y-5">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
