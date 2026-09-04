import { Suspense } from "react";
import { JournalFormClient } from "@/components/journals/journal-form-client";
import { Loader2 } from "lucide-react";

export default function JurnalBaruPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <JournalFormClient mode="create" />
    </Suspense>
  );
}
