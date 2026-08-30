import type { Metadata } from "next";
import { Bodoni_Moda, Archivo, Space_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

/*
 * Type is doing a lot of the identity work here, so none of these are the
 * defaults a Next.js project reaches for. Specifically NOT Geist (Vercel's
 * own face — the single biggest "generated Next app" tell), NOT Inter, and
 * NOT Fraunces/Playfair, which are the stock "tasteful serif" picks.
 */

/**
 * Bodoni Moda — a Didone with extreme thick/thin contrast. At display sizes
 * it's genuinely arresting in a way a humanist serif isn't, and its hairlines
 * pair naturally with a page built out of hairline rules. Variable weight, so
 * the existing font-medium headings still resolve properly.
 */
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

/**
 * Archivo — a grotesque with slightly condensed, squarish proportions. Reads
 * as engineered rather than friendly, which suits a transfer utility, and
 * holds up at the small sizes the tool UIs need.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Space Mono — used only for labels, counters and codes. Its odd curved
 * terminals give the mono small-caps a real voice instead of the neutral
 * monospace every dashboard uses.
 */
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
      className={`${archivo.variable} ${spaceMono.variable} ${bodoni.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
