import type { Metadata } from "next";
import { Sigmar, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AdsNotice } from "@/components/ads/AdsNotice";
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

const title = "ShareFilesFree — Share Files Free, No Sign-Up, No Size Limit";
const description =
  "Share files free with anyone, on any device, with a short code — no account, no app, and no size limit at all, because your file never touches our servers. Free file sharing, plus 24 more free tools that run on your own device.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sharefilesfree.com"),
  title,
  description,
  keywords: [
    "share files free",
    "file sharing free",
    "share file",
    "free file sharing",
    "send large files free",
    "no size limit file transfer",
    "file sharing no signup",
    "free file transfer",
    "send big files",
  ],
  alternates: { canonical: "/" },
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION after adding this property in
  // Search Console (the HTML tag method, not the DNS one) — see
  // .env.local.example for where to get the value. Left unset, Next.js emits
  // no verification tag at all rather than a broken empty one.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: { title, description, url: "/", siteName: "ShareFilesFree", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${sigmar.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* No site-wide ad unit here, deliberately. A slot in the root layout
            lands on EVERY page including /download/[token], which is the one
            page that must carry none (see the note on AdPurpose in lib/ads.ts).
            Ads are placed per page instead, one to a page — which also keeps ad
            density well under the threshold the Better Ads standards care
            about. */}
        {children}
        <AdsNotice />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
