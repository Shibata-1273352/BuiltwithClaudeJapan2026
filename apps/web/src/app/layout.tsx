import type { Metadata, Viewport } from "next";
import { EB_Garamond, Klee_One, Noto_Sans_JP, Shippori_Mincho } from "next/font/google";
import "./globals.css";
import { LangProvider } from "./i18n";

// 6.1: three typefaces — mincho / serif headings, gothic / sans body, handwriting for notes.
// Self-hosted by next/font at build time (no runtime CDN; CSP unchanged). CJK files are large,
// so they are not preloaded.
const mincho = Shippori_Mincho({ weight: ["500", "700"], subsets: ["latin"], variable: "--nf-mincho", display: "swap", preload: false });
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--nf-garamond", display: "swap" });
const gothic = Noto_Sans_JP({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--nf-gothic", display: "swap", preload: false });
const hand = Klee_One({ weight: ["400", "600"], subsets: ["latin"], variable: "--nf-hand", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "TSUMUGI",
  description: "一枚の写真から、170年前の目へ。資料をつなぐ前に、時代・場所・言葉が本当につながるかを確かめる。",
};

export const viewport: Viewport = {
  themeColor: "#0E1426",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" suppressHydrationWarning className={`h-full antialiased ${mincho.variable} ${garamond.variable} ${gothic.variable} ${hand.variable}`}>
      <head>
        {/* presenter mode (the video) is applied before the first paint and kept across pages */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("tsumugi_present")==="1"||/[?&]present=1/.test(location.search))document.documentElement.dataset.present="1"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
