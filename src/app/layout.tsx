import type { Metadata } from "next";
import "./globals.css";
import SideNav from "@/app/_components/side-nav";

export const metadata: Metadata = {
  title: "VedaAide",
  description: "AI-powered document assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <SideNav />

        {/* Main content */}
        <main className="flex flex-col flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
