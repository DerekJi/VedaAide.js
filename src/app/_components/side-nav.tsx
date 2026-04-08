"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// T28: Sidebar navigation — links between chat (/) and ingest (/ingest).
// Kept as a separate Client Component so the rest of the layout stays RSC.
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/", label: "Chat", icon: "💬" },
  { href: "/ingest", label: "Ingest", icon: "📄" },
] as const;

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-200">
        <span className="text-lg font-bold text-gray-800">VedaAide</span>
      </div>

      {/* Links */}
      <ul className="flex flex-col gap-1 p-2 flex-1">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
