import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import LoginPageClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
