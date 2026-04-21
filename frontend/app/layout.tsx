import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "멍냥신고",
  description: "길고양이/유기견 목격 신고 지도 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}