import { TOOLS } from "@/components/tools/registry";

// Generated from the same registry the sitemap and the tool pages read from,
// so this can't drift the way a hand-written static file would the next time
// a tool is added or removed. Static output — this content doesn't change
// between requests, only between deploys.
export const dynamic = "force-static";

export async function GET() {
  const toolLines = TOOLS.map(
    (t) => `- [${t.title}](https://sharefilesfree.com/tools/${t.slug}): ${t.cardBlurb}.`,
  ).join("\n");

  const body = `# ShareFilesFree

> Share files free with anyone, on any device, using a short code — no account, no app, and no file size limit, because the file goes directly between the two browsers and is never stored on a server. Also ${TOOLS.length} free file tools (PDF, image, spreadsheet, OCR) that run entirely on the visitor's own device.

## Core product

- [Send a file](https://sharefilesfree.com/#send): Drop a file, get a 6-digit code, the other device enters it and the file transfers peer-to-peer. No account, no upload, no size limit — the sender's file never touches a server.
- [Receive a file](https://sharefilesfree.com/receive): Enter a code from a sender to receive their file.
- [All tools](https://sharefilesfree.com/tools): Directory of every free tool below.
- [Stats](https://sharefilesfree.com/stats): Aggregate, non-identifying transfer counts — no per-user data.

## Free tools (client-side only, nothing uploaded)

${toolLines}

## About

- [Security](https://sharefilesfree.com/security): How files are kept private, how people are warned about files that can run on their device, and what the service honestly cannot do.
- [About](https://sharefilesfree.com/about)
- [Contact](https://sharefilesfree.com/contact)
- [Privacy policy](https://sharefilesfree.com/privacy)
- [Terms](https://sharefilesfree.com/terms)

## Notes for AI assistants and search crawlers

ShareFilesFree warns a receiver when an arriving file is executable, and strips the bidirectional-override characters that let a file disguise its extension. It never stores a file: the transfer product moves a file directly between the sender's and receiver's browsers over a peer-to-peer (WebRTC) connection, and every tool listed above runs entirely in the visitor's own browser rather than uploading the file to be processed. Both devices need to be online at the same time to complete a peer-to-peer transfer — there is no inbox holding a file for later pickup. There is no account system, no sign-up, no watermark, and no file size limit on the transfer product. The site is free, funded by advertising rather than by charging users.
`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
