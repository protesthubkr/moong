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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://moong.vercel.app",
  ),
  title: "뭉",
  description: "X에서 기준을 넘긴 공개 글을 도착한 순서대로 모아봅니다.",
  openGraph: {
    title: "뭉",
    description: "기준을 넘긴 공개 글을 도착한 순서대로 모아봅니다.",
    images: ["/moong-logo.png"],
    siteName: "뭉",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
