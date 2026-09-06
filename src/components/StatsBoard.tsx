"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";

interface Stats {
  since: string;
  visits: number;
  transfers: number;
  files: number;
  bytes: number;
  largestFileBytes: number;
  connectionsDirect: number;
  connectionsRelayed: number;
  connectionsFailed: number;
  relayRatio: number | null;
  connectSuccessRatio: number | null;
  bytesStored: number;
}

/** A number nobody has yet, rendered as an em dash rather than a lie about zero. */
const PENDING = "—";

function percent(ratio: number | null): string {
  if (ratio === null) return PENDING;
  return `${Math.round(ratio * 100)}%`;
}

/**
 * The live numbers, fetched rather than rendered on the server.
 *
 * The page itself is prerendered and cached at Cloudflare's edge like every
 * other page here, which is what keeps it fast and keeps it off the origin. The
 * numbers cannot be baked in at build time — they would be frozen at whatever
 * they were when the site was last deployed — so they arrive separately from
 * /api/metrics, which is never cached.
 */
export function StatsBoard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((data: Stats) => live && setStats(data))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const since = stats ? new Date(stats.since).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="flex flex-col gap-10">
      {/* The headline pair, and the only reason this page is worth publishing.
          One number is large and grows; the other is zero and cannot move. Put
          side by side they say the thing the rest of the site has to argue for
          in paragraphs. */}
      <div className="grid gap-px bg-ink sm:grid-cols-2">
        <div className="flex flex-col gap-2 bg-lime-4 px-6 py-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">Moved between people</span>
          <span className="text-[2.4rem] font-bold leading-none tabular-nums text-black sm:text-[3.2rem]">
            {stats ? formatBytes(stats.bytes) : PENDING}
          </span>
        </div>
        <div className="flex flex-col gap-2 bg-y-max px-6 py-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">Stored on our servers</span>
          <span className="text-[2.4rem] font-bold leading-none tabular-nums text-black sm:text-[3.2rem]">0 B</span>
          <span className="text-[13px] font-medium leading-[1.5] text-black opacity-55">
            Not &ldquo;deleted quickly&rdquo;. There is no storage to delete from.
          </span>
        </div>
      </div>

      {/* Ruled rows rather than a grid of cards — the section already is the
          box, and a card per number would be a box inside a box. */}
      <dl className="flex flex-col border-t border-rule">
        <Row label="Files delivered" value={stats ? stats.files.toLocaleString() : PENDING} />
        <Row label="Transfers completed" value={stats ? stats.transfers.toLocaleString() : PENDING} />
        <Row
          label="Largest single file"
          value={stats && stats.largestFileBytes > 0 ? formatBytes(stats.largestFileBytes) : PENDING}
          note="There is no size cap, so this is only ever the biggest anyone has needed so far."
        />
        <Row
          label="Went device to device"
          value={percent(stats && stats.relayRatio !== null ? 1 - stats.relayRatio : null)}
          note="A direct connection never touches our infrastructure at all. The rest are relayed because a firewall refused a direct route — still encrypted, still never written down."
        />
        <Row
          label="Connections that succeeded"
          value={percent(stats?.connectSuccessRatio ?? null)}
          note="Two browsers finding each other across the open internet is the hard part. This is how often it works."
        />
        <Row label="Browsing sessions" value={stats ? stats.visits.toLocaleString() : PENDING} />
      </dl>

      <div className="flex flex-col gap-3 text-[13px] font-medium leading-[1.6] text-black opacity-70">
        {failed && <p className="font-semibold text-red">Couldn&rsquo;t load the numbers just now. They&rsquo;re fine — this page isn&rsquo;t.</p>}
        {since && <p>Counting since {since}.</p>}
        <p>
          These are running totals and nothing else — seven numbers that go up. There is no record of a transfer
          behind them: no filename, no address, no time, nothing tying any of it to a person. A file&rsquo;s size is
          added into a sum that already holds everyone else&rsquo;s and is never kept on its own.
        </p>
        <p>
          Session count is measured in the browser, so anything blocking scripts is invisible to it — treat that one
          as a floor rather than a measurement. The rest are counted as transfers actually complete.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-rule py-4">
      <div className="flex items-baseline justify-between gap-6">
        <dt className="text-[15px] font-semibold text-black">{label}</dt>
        <dd className="shrink-0 text-[1.5rem] font-bold leading-none tabular-nums text-black">{value}</dd>
      </div>
      {note && <p className="max-w-2xl text-[13px] font-medium leading-[1.5] text-black opacity-55">{note}</p>}
    </div>
  );
}
