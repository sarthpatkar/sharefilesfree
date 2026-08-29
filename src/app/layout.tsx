import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
