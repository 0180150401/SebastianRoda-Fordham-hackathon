import { Suspense } from "react";
import { SignInFlo } from "@/components/ui/sign-in-flo";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <SignInFlo />
    </Suspense>
  );
}
