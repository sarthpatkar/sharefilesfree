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
    q: "Do both devices need to be open at the same time?",
    a: "Yes, and this is the one real cost of how it works, so it is worth being straight about rather than burying it. Your file goes directly from your device to theirs — it is never parked on a server in between, because there is no server holding files. That means both pages have to be open while it travels, the way a phone call needs both people on the line. Everything people like about this follows from the same fact: no size limit, no account, no waiting, nothing kept afterwards, and nothing that can leak later because nothing is stored. If the other person genuinely cannot be there, pick a longer code, send them the link, and leave your tab open — they can collect any time in the next two hours.",
  },
  {
    q: "Can I send the same file to several devices at once?",
    a: "Yes — that is what the Group share page is for. Pick a file, say how many devices should get it (up to 20), and share the code, the link or the QR. Everyone who joins gets their own copy sent straight from your device as they arrive, so somebody who joins late still gets the whole file and a slow phone never holds up anyone else. It is kept separate from the normal one-to-one send on purpose, including its code: a group code is six characters rather than six digits, which is about a billion combinations instead of a million, because a code that lets in several devices has to be far harder to stumble onto. You see every device that joins, each with its own code to compare, and you can close the remaining places or disconnect a device whenever you like.",
  },
  {
    q: "How do you make money if everything is free?",
    a: "Advertising on this page, once there are enough people here for it to be worth an advertiser's time. Never by charging you, never by capping your file size, never by inventing a paid tier. It works because most sends cost us nothing to run — your file doesn't pass through anything we pay for. If that ever has to change, you'll read it here first.",
  },
  {
    q: "Is there a file size limit?",
    a: "None at all. Your file goes straight from your device to theirs, so we aren't paying for the megabytes and have no reason to count them — nothing in the way counts them either. The only ceiling is the free space on the device receiving it. A transfer that never touches our machines costs us nothing however big it is, so there's no number we'd gain anything by capping it at.",
  },
  {
    q: "Do I really not need an account?",
    a: "None at all. No sign-up, no login, no email box — not here and not on any of the tools. No account also means no mailing list, no password of yours to leak, and no history with your name on it.",
  },
  {
    q: "What if the person I'm sending to isn't online right now?",
    a: "Choose a longer code when you create it — ten minutes by default, up to two hours — and leave the tab open. They can pick it up whenever they get to it, and the file waits on your own device rather than ours. For anything longer than ten minutes you get a link and a QR code instead of digits to read out: something that stays open for hours needs a key too long to say aloud, or it could simply be guessed. What we can't do is hold the file after you close the page. That's the one thing we give up by never storing anything: if you can't both be online within two hours, use something that keeps a copy — and know that it's keeping one.",
  },
  {
    q: "Does the other person need the same browser or an app?",
    a: "No. Anything modern works — phone to laptop, Windows to Mac, Android to iPhone. There's nothing to install on either end, which is usually the bit that stops a transfer from happening at all.",
  },
  {
    q: "Are the PDF and image tools really free with no watermark?",
    a: "Yes. Every tool does its work on your own device, so each use costs us nothing to run — which is why there is no watermark, no daily limit, and nothing to wait for. Your file is never uploaded to be processed in the first place.",
  },
  {
    q: "Is it safe to receive a file from someone?",
    a: "Mostly it comes down to who sent it, and we help you judge that. If a file can run on your device — an app, an installer, a script, a document carrying hidden instructions — we say so clearly before you save it. We also make sure a file can't disguise what it is: there is a known trick that makes a program appear with a photo's name, and files arriving here can't use it. What we can't do is check the contents for viruses, because the file goes straight from their device to yours and never reaches us. So treat anything unexpected the way you'd treat a surprise email attachment: if you're not sure who sent it, don't open it. Once a transfer connects, both of you also see the same short code on screen — reading it to each other is a quick way to be sure the file is coming from the person you think it is.",
  },
  {
    q: "What stops people misusing an anonymous file service?",
    a: "Codes expire on their own and stop working once the right person has used them, guessing at codes gets shut out quickly, and nothing is ever stored here — so there is no pile of files sitting around to be found later, and no link that keeps working after a transfer is done. What we can't do is inspect what's inside a file, because it never reaches us. That's the honest trade of a service that doesn't keep your files: we can't read yours, so we can't read anyone else's either.",
  },
  {
    q: "Is ShareFilesFree actually a free file-sharing website, or is there a catch?",
    a: "It's what the name says: a place to share files free, not a free trial of a paid one. There's no storage limit to hit, no watermark waiting to appear, and no upgrade screen behind the transfer or the tools. Share a file the same way tomorrow, next year, or a hundred times today — the free version is the only version.",
  },
  {
    q: "What's the best way to share files free with someone on a different device?",
    a: "A six-digit code, read out or texted over, is enough — no email attachment size limit to hit and no drive link to set sharing permissions on. Open ShareFilesFree on both devices, drop the file on one, type the code on the other, and it moves straight across. Phone to laptop, Windows to Mac, Android to iPhone: nothing to install, nothing to sign into, and no cap on how large the file is.",
  },
];
