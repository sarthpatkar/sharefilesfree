import { DownloadPanel } from "@/components/DownloadPanel";

export default async function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-20">
      <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">ShareFilesFree</h1>
      <section className="w-full rounded-2xl border border-border bg-card p-8 shadow-[0_1px_2px_rgba(20,35,29,0.04)]">
        <DownloadPanel token={token} />
      </section>
      <p className="text-center text-xs text-muted">Files are deleted automatically after their link expires.</p>
    </main>
  );
}
