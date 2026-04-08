"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MessageSquare, FileText, Settings, BarChart2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// T2: SideNav — responsive sidebar with mobile hamburger menu.
// Links: Chat, Ingest, Prompts, Evaluation.
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/", label: "Chat", Icon: MessageSquare },
  { href: "/ingest", label: "Ingest", Icon: FileText },
  { href: "/prompts", label: "Prompts", Icon: Settings },
  { href: "/evaluation", label: "Evaluation", Icon: BarChart2 },
] as const;

export default function SideNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800">VedaAide</span>
        {/* Close button on mobile */}
        <button
          className="md:hidden text-gray-400 hover:text-gray-600"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Links */}
      <ul className="flex flex-col gap-1 p-2 flex-1">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-600"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <nav
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0",
        )}
      >
        {navContent}
      </nav>
    </>
  );
}
