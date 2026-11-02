import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TSUMUGI",
  description: "時代も、場所も、言葉も、空間も越えて、日本を紡ぐ。",
};

export const viewport: Viewport = {
  themeColor: "#0E1426",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
