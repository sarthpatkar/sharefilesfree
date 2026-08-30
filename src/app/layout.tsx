import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A serif display face for headlines only — pairing it against Geist's plain
// sans for body/UI text is what gives the page an actual point of view
// instead of the single-typeface look most generated interfaces default to.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
