/**
 * Shared so the rendered accordion and the FAQPage JSON-LD in app/page.tsx
 * can never drift apart — search engines penalise structured data that
 * doesn't match what's actually on the page.
 *
 * Order matters: people scan rather than read (BRAND.md §4) and the first
 * item renders expanded, so the two questions that actually block a decision
 * — "can you see my files" and "what's the catch" — lead. Feature trivia
 * goes last.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Can you see the files I send?",
    a: "No — and not in the 'we promise not to look' sense. On a direct transfer the file goes browser to browser, encrypted end to end by WebRTC itself; our server only relays the 6-digit code and the connection handshake, so there is no copy on our side to look at, leak, sell, or be compelled to hand over. If you use the 'share a link' fallback instead, the file does sit in encrypted storage until the expiry you pick, then deletes itself.",
  },
  {
    q: "How do you make money if everything is free?",
    a: "Advertising on the site, once there's enough traffic to bother an ad network — never by charging you, capping your file size, or adding a paid tier. That works because most transfers cost us nothing to run: the file never touches a server we pay for. If that ever has to change, it will say so on this page rather than quietly appearing as a limit.",
  },
  {
    q: "Is there a file size limit?",
    a: "Not on a direct transfer. The file goes straight between the two browsers, so we're not paying for the bytes and have no reason to cap them — send the whole 4GB video. The 'share a link' fallback does have a cap, because that path stores the file on storage we rent and that costs real money.",
  },
  {
    q: "Do I really not need an account?",
    a: "Correct — there is no sign-up, no login, and no email step anywhere in the product. Open the page, drop a file, share the code. The same is true of all 19 file tools. No account also means no email list, no password database, and no history tied to you.",
  },
  {
    q: "What if the person I'm sending to isn't online right now?",
    a: "Wait about 20 seconds on the sending screen and the option to create a shareable link appears instead. That link can be opened hours later, and you can put a password on it, choose when it expires, or have it delete itself the moment it's downloaded once.",
  },
  {
    q: "Does the other person need the same browser or an app?",
    a: "No. Any modern browser on any device works — phone to laptop, Windows to Mac, Android to iPhone. There is nothing to install on either end, which is usually the part that stops a transfer from happening at all.",
  },
  {
    q: "Are the PDF and image tools really free with no watermark?",
    a: "Yes, and there's a structural reason rather than a promotional one: every tool runs on your own device's processor, so each use costs us nothing. That means no upload queue, no watermark, no daily limit — and your file never leaves your machine to be processed in the first place.",
  },
  {
    q: "What stops people abusing an anonymous file service?",
    a: "Per-IP rate limits on uploads and code lookups, short automatic expiry on anything stored, unguessable download tokens that are never indexed, and a one-click abuse report on every download page that takes the file down immediately. Files sent directly between two browsers never reach us, so they can't be scanned — that's a genuine trade-off of the private path, not something we'd rather not mention.",
  },
];
