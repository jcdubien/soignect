"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/stats", label: "Statistiques" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/profiles", label: "Profils" },
  { href: "/admin/missions", label: "Annonces" },
  { href: "/admin/ratings", label: "Recommandations" },
  { href: "/admin/apl", label: "Données APL" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0 border-r border-gray-200 bg-white hidden sm:flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Admin</span>
      </div>
      <nav className="p-2 space-y-0.5 flex-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
              pathname.startsWith(item.href)
                ? "bg-red-50 text-red-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
