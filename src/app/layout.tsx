import type { Metadata } from "next";
import "./globals.css";
import SideNav from "@/app/_components/side-nav";
import { QueryProvider } from "@/lib/providers/query-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "VedaAide",
  description: "AI-powered document assistant",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50 overflow-hidden">
        <QueryProvider>
          <ToastProvider>
            {/* Sidebar */}
            <SideNav />

            {/* Main content — takes remaining space */}
            <main className="flex flex-col flex-1 overflow-hidden md:pl-0 pl-0">{children}</main>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
