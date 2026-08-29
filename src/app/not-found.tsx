import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <span className="text-4xl">🧭</span>
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-black/60 dark:text-white/60">
        This page doesn&apos;t exist — or a shared link here has expired or been removed.
      </p>
      <Link href="/" className="rounded-full bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500">
        Back to ShareFilesFree
      </Link>
    </main>
  );
}
