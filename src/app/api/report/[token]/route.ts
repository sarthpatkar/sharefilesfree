// Lets anyone with a shared link's token flag it as abusive — the plan calls
// this out as non-negotiable from day one, not a "v2" feature, since an
// anonymous no-login service is exactly the profile abusers look for (see
// the Firefox Send case study in the plan). Takes effect immediately: no
// human-review queue gates it, since fast/automatic takedown matters more
// here than protecting against the rare bad-faith report — see the comment
// on markReported() in lib/r2.ts for the reasoning.
//
// Deliberately logs to stdout rather than nothing: until a real moderation
// dashboard exists, `journalctl`/host logs are the operator's only visibility
// into what got reported and why.
import { NextResponse } from "next/server";
import { readMetadata, markReported, isR2Configured } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const REPORT_LIMIT = 20;
const REPORT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isR2Configured() || !/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (isRateLimited(clientIpFromHeaders(request.headers), REPORT_LIMIT, REPORT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many reports from this connection. Try again later." }, { status: 429 });
  }

  const meta = await readMetadata(token);
  if (!meta) {
    return NextResponse.json({ error: "This link doesn't exist or has already expired." }, { status: 404 });
  }

  const ok = await markReported(token);
  console.warn(`[abuse-report] token=${token} name=${JSON.stringify(meta.name)} ip=${clientIpFromHeaders(request.headers)}`);

  return ok
    ? NextResponse.json({ blocked: true })
    : NextResponse.json({ error: "Could not process the report." }, { status: 500 });
}
