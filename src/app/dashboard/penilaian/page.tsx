import { Suspense } from "react";
import { GradingOverviewClient } from "@/components/grading/grading-overview-client";
import { Loader2 } from "lucide-react";

export default function PenilaianPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <GradingOverviewClient />
    </Suspense>
  );
}
