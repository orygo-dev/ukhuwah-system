import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ChatPageClient } from "@/components/chat/chat-page-client";

export default function PesanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ChatPageClient />
    </Suspense>
  );
}
