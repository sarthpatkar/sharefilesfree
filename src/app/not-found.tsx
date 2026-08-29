import Link from "next/link";
import { IconCompass } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <IconCompass className="h-9 w-9 text-muted" />
      <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Page not found</h1>
      <p className="text-muted">This page doesn&apos;t exist — or a shared link here has expired or been removed.</p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[0_1px_2px_rgba(11,110,79,0.25)] transition hover:bg-accent-hover active:scale-[0.98]"
      >
        Back to ShareFilesFree
      </Link>
    </main>
  );
}
