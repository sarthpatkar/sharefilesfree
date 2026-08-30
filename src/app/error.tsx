"use client";

import { IconWarning } from "@/components/icons";

// Next.js requires this to be a Client Component and to accept exactly these
// props — it's the catch-all boundary for any uncaught error thrown while
// rendering a page (not for our own handled transfer/upload errors, which
// already have their own inline UI in each component).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <IconWarning className="h-9 w-9 text-danger" />
      <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Something went wrong</h1>
      <p className="text-muted">
        That&apos;s on us, not your file or your connection. Try again — if it keeps happening, the transfer itself
        (P2P or a shared link) should still work fine even if this page hiccups.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center justify-center bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[4px_4px_0_var(--ink)] sff-press hover:bg-accent-hover"
      >
        Try again
      </button>
    </main>
  );
}
