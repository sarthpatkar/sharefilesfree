import type { Metadata } from "next";
import { Sigmar, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AdSlot } from "@/components/ads/AdSlot";
import "./globals.css";

/**
 * Sigmar — heavy, rounded, poster-weight display. Carries every headline,
 * the six-digit code, and the oversized section numerals. It is the loudest
 * thing on the site and everything else stays quiet around it.
 *
 * Caprasino was the other face requested but it isn't distributable through
 * Google Fonts and no licensed file is present, so it can't be wired up yet.
 * Drop a .woff2 into src/fonts and it swaps in via next/font/local.
 */
const sigmar = Sigmar({
  variable: "--font-sigmar",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * Outfit — geometric, wide, even colour. Deliberately plain: against a face
 * as characterful as Sigmar, a second personality would fight it.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const title = "ShareFilesFree — Send big files free, no sign-up";
const description =
  "Send any file to any device with a six-digit code. No account, no app, no size limit. Plus 19 free tools to fix your file before it goes.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sharefilesfree.com"),
  title,
  description,
  keywords: ["send large files free", "file sharing no signup", "free file transfer", "send big files"],
  openGraph: { title, description, url: "/", siteName: "ShareFilesFree", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${sigmar.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        {/* The site-wide unit. Deliberately in normal flow at the foot of the
            page rather than fixed to the bottom of the viewport: an oversized
            sticky ad is a Coalition for Better Ads violation on mobile web,
            and a violation gets ads blocked across the whole site by Chrome —
            which would cost far more than the unit earns. */}
        <AdSlot slotId="site-footer" format="anchor" className="px-5 py-6 sm:px-8" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
