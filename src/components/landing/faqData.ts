/**
 * Shared so the rendered accordion and the FAQPage structured data in
 * app/page.tsx can never drift apart — search engines penalise structured
 * data that doesn't match the page.
 *
 * Order matters: the first item renders open, so the two questions that
 * actually block a decision — can you read my files, and what's the catch —
 * lead. Everything else follows.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Can you see the files I send?",
    a: "No — and not in the “we promise not to look” way. When you send with a code, your file is locked before it leaves your device and only opens on theirs. We never hold a copy, so there is nothing on our side to lose, to sell, or to be asked to hand over. Use a shareable link instead and the file waits in locked storage, then deletes itself on the schedule you choose.",
  },
  {
    q: "How do you make money if everything is free?",
    a: "Advertising on this page, once there are enough people here for it to be worth an advertiser's time. Never by charging you, never by capping your file size, never by inventing a paid tier. It works because most sends cost us nothing to run — your file doesn't pass through anything we pay for. If that ever has to change, you'll read it here first.",
  },
  {
    // Describes the windows every link gets, which is the whole story while no
    // ad network is configured. Once ads are switched on, senders can also buy
    // a longer window with a couple more ad views (see lib/retention.ts) — this
    // answer needs one sentence about that on the day that goes live.
    q: "Is there a file size limit?",
    a: "Not when you send with a code. Your file goes straight from your device to theirs, so we aren't paying for the megabytes and have no reason to count them — nothing in the way counts them either. The only ceiling is the free space on the device receiving it. A shareable link works differently, because that route parks your file on storage we rent: up to 50GB, but the bigger it is the shorter it stays. Up to 2GB keeps for a week, up to 10GB for a day, up to 50GB for six hours. What costs us money is the size multiplied by the time, so that's the thing we ration — not your file.",
  },
  {
    q: "Do I really not need an account?",
    a: "None at all. No sign-up, no login, no email box — not here and not on any of the 19 tools. No account also means no mailing list, no password of yours to leak, and no history with your name on it.",
  },
  {
    q: "What if the person I'm sending to isn't online right now?",
    a: "Wait about twenty seconds on the sending screen and the option to make a shareable link appears instead. They can open it hours later, and you can put a password on it, choose when it expires, or have it delete itself the moment it's been downloaded once.",
  },
  {
    q: "Does the other person need the same browser or an app?",
    a: "No. Anything modern works — phone to laptop, Windows to Mac, Android to iPhone. There's nothing to install on either end, which is usually the bit that stops a transfer from happening at all.",
  },
  {
    q: "Are the PDF and image tools really free with no watermark?",
    a: "Yes, and for a structural reason rather than a promotional one: every tool does its work on your own device, so each use costs us nothing. No queue, no watermark, no daily limit — and your file never leaves your machine to be processed in the first place.",
  },
  {
    q: "What stops people abusing an anonymous file service?",
    a: "Limits on how much any one connection can send, short expiry on anything stored, links that can't be guessed and are never listed anywhere, and a one-tap report on every download page that pulls the file immediately. Files sent straight between two people never reach us, so those we can't check — that's a genuine trade-off of the private route, and we'd rather name it than pretend it isn't there.",
  },
];
