import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美股财报日历订阅",
  description: "自动更新的 Apple 日历财报订阅，支持按股票代码筛选。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
