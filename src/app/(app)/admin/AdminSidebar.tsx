"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/stats", label: "Statistiques" },
  { href: "/admin/diffusion", label: "Diffusion" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/profiles", label: "Profils" },
  { href: "/admin/missions", label: "Annonces" },
  { href: "/admin/ratings", label: "Recommandations" },
  { href: "/admin/deepseek", label: "Appels DeepSeek" },
  { href: "/admin/apl", label: "Données APL" },
  { href: "/admin/config", label: "Configuration" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  // Sur MOBILE, cette barre latérale était simplement `hidden sm:flex` — invisible sous 640 px,
  // et SANS AUCUN REMPLACEMENT. Un administrateur sur téléphone n'avait donc aucun moyen de
  // passer d'une section à l'autre : il pouvait atteindre /admin, et plus rien ensuite.
  // On rend la navigation disponible en bandeau horizontal défilant, au-dessus du contenu.
  return (
    <>
      <nav className="sm:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-gray-200 bg-white">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              pathname.startsWith(item.href)
                ? "bg-red-50 text-red-700 border border-red-200"
                : "text-gray-600 bg-gray-50 border border-transparent"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

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
    </>
  );
}
