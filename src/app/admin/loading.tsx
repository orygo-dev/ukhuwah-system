export default function AdminLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-4 w-80 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="hidden h-10 w-32 animate-pulse rounded-xl bg-slate-100 sm:block" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm"
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
          <div className="h-64 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
      </div>
    </div>
  );
}
