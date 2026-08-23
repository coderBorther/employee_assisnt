import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "易小简 —— 一个省事靠谱的求职助手",
  description:
    "上传简历 PDF 并粘贴目标岗位描述，AI 帮你分析岗位匹配度、优化简历、生成求职信与面试题参考回答。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router 下在根布局使用 <link> 加载展示字体（Nunito / IBM Plex Mono），
            浏览器端按需加载，离线时自动回退到系统字体；该规则针对 Pages Router。 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <div className="mist-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
