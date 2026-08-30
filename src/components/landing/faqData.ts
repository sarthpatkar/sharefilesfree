/**
 * Shared so the rendered accordion and the FAQPage JSON-LD in app/page.tsx
 * can never drift apart — search engines penalise structured data that
 * doesn't match what's actually on the page.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Do I really not need an account?",
    a: "Correct — there is no sign-up, no login, and no email step anywhere in the product. Open the page, drop a file, share the code. That applies to the file tools too.",
  },
  {
    q: "Is there a file size limit?",
    a: "Not on the direct peer-to-peer path: the file goes browser to browser without passing through our servers, so we don't pay for the bytes and don't cap them. The 'share a link' fallback, which stores the file so it can be picked up later, does have a size cap because that storage costs real money.",
  },
  {
    q: "Can you see the files I send?",
    a: "No. Peer-to-peer transfers are encrypted end to end by the browser's own WebRTC layer — our signalling server only relays the 6-digit code and connection handshake, never file contents. For the link fallback, the file sits in encrypted object storage and is deleted automatically at the expiry you choose.",
  },
  {
    q: "Does the other person need the same browser or an app?",
    a: "No. Any modern browser on any device works — phone to laptop, Windows to Mac, Android to iPhone. Nothing to install on either end.",
  },
  {
    q: "What if the person I'm sending to isn't online right now?",
    a: "Wait about 20 seconds on the sending screen and the option to create a shareable link appears instead. That link can be opened hours later, and you can protect it with a password, set when it expires, or have it delete itself after the first download.",
  },
  {
    q: "Are the PDF and image tools really free with no watermark?",
    a: "Yes. All 19 tools run entirely inside your browser using your own device's processing power, so there's no per-use cost to us, no upload, no queue, no watermark, and no daily limit.",
  },
  {
    q: "How do you make money if everything is free?",
    a: "The intent is unobtrusive advertising on the site, not charging users. Because most transfers are peer-to-peer, our running costs stay low enough that this works without gating file sizes or adding a paid tier.",
  },
  {
    q: "What stops people abusing an anonymous file service?",
    a: "Per-IP rate limits on uploads and code lookups, short automatic expiry on stored files, unguessable download tokens that are never indexed, and a one-click abuse report on every download page that takes the file down immediately.",
  },
];
