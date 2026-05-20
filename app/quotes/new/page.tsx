import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import NewQuotePageClient from "./new-quote-client";

export default function NewQuotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <NewQuotePageClient />
    </Suspense>
  );
}
