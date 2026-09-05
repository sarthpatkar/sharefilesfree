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
    a: "No — and not in the “we promise not to look” way. Your file is locked before it leaves your device and only opens on theirs. We never hold a copy, because there is nowhere on our side for one to go: we run no file storage at all. There is nothing to lose, nothing to sell, and nothing anyone can ask us to hand over.",
  },
  {
    q: "How do you make money if everything is free?",
    a: "Advertising on this page, once there are enough people here for it to be worth an advertiser's time. Never by charging you, never by capping your file size, never by inventing a paid tier. It works because most sends cost us nothing to run — your file doesn't pass through anything we pay for. If that ever has to change, you'll read it here first.",
  },
  {
    q: "Is there a file size limit?",
    a: "None at all. Your file goes straight from your device to theirs, so we aren't paying for the megabytes and have no reason to count them — nothing in the way counts them either. The only ceiling is the free space on the device receiving it. This isn't generosity, it's arithmetic: a transfer that never touches our machines costs us nothing however big it is, so there is no number we'd gain anything by capping it at.",
  },
  {
    q: "Do I really not need an account?",
    a: "None at all. No sign-up, no login, no email box — not here and not on any of the tools. No account also means no mailing list, no password of yours to leak, and no history with your name on it.",
  },
  {
    q: "What if the person I'm sending to isn't online right now?",
    a: "Choose a longer code when you create it — ten minutes by default, up to two hours — and leave the tab open. They can pick it up whenever they get to it, and the file waits on your own device rather than ours. A longer code is eight digits instead of six, because something guessable for two hours needs a bigger haystack, so send it as a link or QR rather than reading it out. What we can't do is hold the file after you close the page. That's the honest cost of never storing anything: if you can't both be online within two hours, use something that keeps a copy — and know that it's keeping one.",
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
    a: "Honestly: very little, and by design. Files pass directly between two browsers and never reach us, so there is nothing for us to scan even if we wanted to. What we do have are limits on how many transfers one connection can start, codes that expire and can't be guessed, and no storage at all — nothing can sit here waiting to be found by anyone. That's a genuine trade-off of the private route, and we'd rather name it than pretend it isn't there.",
  },
];
