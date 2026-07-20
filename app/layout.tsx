import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美股财报日历订阅",
  description: "自动更新的 Apple 日历财报订阅，支持按股票代码筛选。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "美股财报日历订阅",
    description: "无需登录，自动更新的 Apple 日历财报订阅。",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "美股财报日历订阅" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
