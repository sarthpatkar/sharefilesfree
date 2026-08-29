import { DownloadPanel } from "@/components/DownloadPanel";

export default async function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-20">
      <h1 className="text-2xl font-bold tracking-tight">ShareFilesFree</h1>
      <section className="w-full rounded-3xl border border-black/10 p-8 dark:border-white/10">
        <DownloadPanel token={token} />
      </section>
      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Files are deleted automatically after their link expires.
      </p>
    </main>
  );
}
