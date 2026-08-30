import type { Metadata } from "next";
import { Darker_Grotesque, Instrument_Sans, DM_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

/*
 * Display face is Darker Grotesque, chosen from the user's own shortlist —
 * it was the only one of the eight actually available on Google Fonts
 * (Spectre, Komika Axis, Palmore, Montreal, Alcazar, Aquire, Munich,
 * Aquatico and Nordic are all commercial or free-download faces that would
 * need self-hosted files). The other two below are picked to serve it.
 *
 * None of the three are the defaults a Next.js project reaches for: not
 * Geist (Vercel's own face, the biggest "generated Next app" tell) and not
 * Inter.
 */

/**
 * Darker Grotesque — tall, narrow, high x-height, with genuinely odd
 * letterforms at heavy weights. Used large and tightly tracked, it does the
 * job the reference set's display faces do: carry all the personality so
 * everything around it can stay quiet. Variable 300–900.
 */
const darkerGrotesque = Darker_Grotesque({
  variable: "--font-darker",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Instrument Sans — the quiet half of the pair. Deliberately *wider* than
 * the display face, because two condensed grotesques stacked together read
 * as one muddled voice; the width contrast is what makes the pairing work.
 * Holds up at the small sizes the 19 tool UIs need.
 */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

/**
 * DM Mono — labels, counters and codes only. Chosen over Space Mono now that
 * the display face is loud: Space Mono's quirks competed with it, and the
 * mono's job here is to be precise, not characterful.
 */
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const title = "ShareFilesFree — Send large files free, no signup, no login";
const description =
  "Share files instantly between devices with a 6-digit code. No account, no app install, no size limit games. Fast peer-to-peer transfer, right in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sharefilesfree.com"),
  title,
  description,
  keywords: ["send large files free", "file sharing no signup", "wetransfer alternative", "peer to peer file transfer"],
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "ShareFilesFree",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${dmMono.variable} ${darkerGrotesque.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
