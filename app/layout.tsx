import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "日々是好日",
  description: "一日一日を精一杯生きるための、スケジュール・タスク・アイデア管理ワークスペース",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${jakarta.variable} ${notoJP.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* shadcn/ui の Sidebar コンポーネント（SidebarMenuButton の collapsed
            時 tooltip 等）が要求するためアプリ全体をラップする。 */}
        <TooltipProvider delay={300}>{children}</TooltipProvider>
        <Toaster richColors position="bottom-right" duration={3000} />
      </body>
    </html>
  );
}
